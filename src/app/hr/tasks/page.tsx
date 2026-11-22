import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";
import {
  TaskDelegationView,
  type AssignedTaskItem,
  type EligibleAssignee,
} from "@/components/hr/task-delegation-view";
import { requireHrModule } from "@/lib/portal-guards";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canManageWorkItem,
  getOperationalCommitteeScope,
  type WorkItemType,
} from "@/lib/permissions";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  type SeasonGradingSettings,
  type SeasonTaskSettings,
  type TaskCompletionMode,
} from "@/lib/season-settings";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  gradeTaskSubmissionAction,
  hrToggleTaskCompletionAction,
} from "./actions";

export default async function HrTasksPage() {
  const { profile } = await requireHrModule("tasks");
  let eligibleMembers: EligibleAssignee[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
  let assignedToMe: AssignedTaskItem[] = [];
  let gradingWeights: SeasonGradingSettings = DEFAULT_SEASON_SETTINGS.grading;
  let taskDefaults: SeasonTaskSettings = DEFAULT_SEASON_SETTINGS.tasks;

  type BulkTask = {
    id: string;
    title: string;
    workType: WorkItemType;
    completionMode: TaskCompletionMode;
    committeeName: string;
    maxPoints: number;
  };
  type BulkSubmission = {
    submissionId?: string;
    membershipId: string;
    memberName: string;
    effortScore: number | null;
    qualityScore: number | null;
    timelinessScore: number | null;
    totalPoints: number | null;
    notes: string;
    submissionUrl?: string | null;
    submissionText?: string | null;
    completed?: boolean;
  };
  const bulkTasks: { task: BulkTask; submissions: BulkSubmission[] }[] = [];

  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";
  const operationalCommitteeId = getOperationalCommitteeScope(profile);
  const isTrackDirector =
    profile.role === "director" && Boolean(profile.managedTrackId);

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      const seasonSettings = normalizeSeasonSettings(activeSeason.settingsJson);
      gradingWeights = seasonSettings.grading;
      taskDefaults = seasonSettings.tasks;

      const memberFilter =
        isCommitteeScoped && operationalCommitteeId
          ? and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.committeeId, operationalCommitteeId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            )
          : and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            );

      const shouldSkipTaskQuery = isCommitteeScoped && !operationalCommitteeId;
      const taskFilter =
        isCommitteeScoped && operationalCommitteeId
          ? and(
              eq(schema.tasks.seasonId, seasonId),
              eq(schema.tasks.committeeId, operationalCommitteeId)
            )
          : eq(schema.tasks.seasonId, seasonId);

      const [dbMembers, dbCommittees, dbMySubmissions, dbTasks] =
        await Promise.all([
          db
            .select({
              id: schema.rosterMemberships.id,
              fullName: schema.persons.fullName,
              role: schema.rosterMemberships.role,
              committeeId: schema.rosterMemberships.committeeId,
            })
            .from(schema.rosterMemberships)
            .innerJoin(
              schema.persons,
              eq(schema.rosterMemberships.personId, schema.persons.id)
            )
            .where(and(memberFilter, eq(schema.persons.isActive, true))),
          db
            .select()
            .from(schema.committees)
            .where(
              and(
                eq(schema.committees.seasonId, seasonId),
                eq(schema.committees.isActive, true)
              )
            ),
          profile.role === "hr_admin"
            ? db
                .select({
                  taskId: schema.tasks.id,
                  title: schema.tasks.title,
                  workType: schema.tasks.workType,
                  completionMode: schema.tasks.completionMode,
                  createdBy: schema.tasks.createdBy,
                  dueAt: schema.tasks.dueAt,
                  maxPoints: schema.tasks.maxPoints,
                  totalPoints: schema.taskSubmissions.totalPoints,
                  submittedAt: schema.taskSubmissions.submittedAt,
                  submissionUrl: schema.taskSubmissions.submissionUrl,
                  submissionText: schema.taskSubmissions.submissionText,
                })
                .from(schema.taskSubmissions)
                .innerJoin(
                  schema.tasks,
                  eq(schema.taskSubmissions.taskId, schema.tasks.id)
                )
                .where(
                  and(
                    eq(schema.taskSubmissions.membershipId, profile.id),
                    eq(schema.tasks.seasonId, seasonId)
                  )
                )
                .orderBy(desc(schema.tasks.createdAt))
            : Promise.resolve([]),
          shouldSkipTaskQuery
            ? Promise.resolve([])
            : db
                .select()
                .from(schema.tasks)
                .where(taskFilter)
                .orderBy(desc(schema.tasks.createdAt)),
        ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const hrCommitteeId =
        dbCommittees.find(
          (c) =>
            c.slug === "human-resources" ||
            c.name.toLowerCase() === "human resources"
        )?.id ?? null;
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      dbCommitteesList = isCommitteeScoped
        ? dbCommittees
            .filter(
              (c) =>
                operationalCommitteeId !== null &&
                c.id === operationalCommitteeId
            )
            .map((c) => ({ id: c.id, name: c.name }))
        : directorTrackCommitteeIds
          ? dbCommittees
              .filter((c) => directorTrackCommitteeIds.has(c.id))
              .map((c) => ({ id: c.id, name: c.name }))
          : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      const scopedMembers =
        isCommitteeScoped && !operationalCommitteeId
          ? []
          : directorTrackCommitteeIds
            ? dbMembers.filter((m) => {
                const effectiveCommId =
                  m.committeeId ??
                  (m.role === "hr_admin" ? hrCommitteeId : null);
                return (
                  effectiveCommId !== null &&
                  directorTrackCommitteeIds.has(effectiveCommId)
                );
              })
            : dbMembers;

      eligibleMembers = scopedMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        role: m.role,
        committeeId: m.committeeId,
        committeeName: m.committeeId ? commMap.get(m.committeeId) : undefined,
      }));

      // Resolve creator names & roles for items assigned to current user
      const creatorIds = Array.from(
        new Set(
          dbMySubmissions
            .map((s) => s.createdBy)
            .filter((id): id is string => Boolean(id))
        )
      );
      const creatorMap = new Map<
        string,
        { fullName: string; role: MembershipRole }
      >();
      if (creatorIds.length > 0) {
        const creators = await db
          .select({
            id: schema.rosterMemberships.id,
            role: schema.rosterMemberships.role,
            fullName: schema.persons.fullName,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(inArray(schema.rosterMemberships.id, creatorIds));
        for (const c of creators) {
          creatorMap.set(c.id, { fullName: c.fullName, role: c.role });
        }
      }

      assignedToMe = dbMySubmissions.map((s) => {
        const creator = s.createdBy ? creatorMap.get(s.createdBy) : undefined;
        return {
          id: s.taskId,
          title: s.title,
          workType: s.workType === "task" ? "task" : "assignment",
          completionMode:
            s.completionMode === "hr_only" ? "hr_only" : "self_report",
          assignedByName: creator?.fullName ?? "Leadership",
          assignerRole:
            creator?.role ?? (s.workType === "task" ? "hr_admin" : "director"),
          dueAt: s.dueAt,
          maxPoints: s.maxPoints,
          status:
            s.totalPoints !== null
              ? "completed"
              : s.submittedAt
                ? "in_progress"
                : "not_started",
          submissionUrl: s.submissionUrl,
          submissionText: s.submissionText,
        };
      });

      // Filter tasks strictly by role work-type authority before loading submissions
      const roleAuthorizedTasks = dbTasks.filter((t) => {
        const itemWorkType: WorkItemType =
          t.workType === "task" ? "task" : "assignment";
        return canManageWorkItem(
          {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            committeeId: profile.committeeId,
            trackedCommitteeId: profile.trackedCommitteeId,
          },
          itemWorkType,
          t.committeeId
        );
      });

      // Load all submissions for visible tasks in a single query (eliminates N+1)
      if (roleAuthorizedTasks.length > 0) {
        const taskIds = roleAuthorizedTasks.map((t) => t.id);
        const allSubs = await db
          .select({
            sub: schema.taskSubmissions,
            member: {
              id: schema.rosterMemberships.id,
              role: schema.rosterMemberships.role,
              committeeId: schema.rosterMemberships.committeeId,
              fullName: schema.persons.fullName,
            },
          })
          .from(schema.taskSubmissions)
          .innerJoin(
            schema.rosterMemberships,
            eq(schema.taskSubmissions.membershipId, schema.rosterMemberships.id)
          )
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(inArray(schema.taskSubmissions.taskId, taskIds));

        const subsByTask = new Map<string, BulkSubmission[]>();
        for (const { sub, member } of allSubs) {
          // Never show an officer their own submission in the grading table
          if (member.id === profile.id) {
            continue;
          }
          const effectiveMemberCommId =
            member.committeeId ??
            (member.role === "hr_admin" ? hrCommitteeId : null);
          if (
            directorTrackCommitteeIds &&
            (!effectiveMemberCommId ||
              !directorTrackCommitteeIds.has(effectiveMemberCommId))
          ) {
            continue;
          }
          const list = subsByTask.get(sub.taskId) ?? [];
          list.push({
            submissionId: sub.id,
            membershipId: member.id,
            memberName: member.fullName,
            effortScore: sub.effortScore,
            qualityScore: sub.qualityScore,
            timelinessScore: sub.timelinessScore,
            totalPoints: sub.totalPoints,
            notes: sub.notes ?? "",
            submissionUrl: sub.submissionUrl,
            submissionText: sub.submissionText,
            completed: sub.gradedAt !== null && (sub.totalPoints ?? 0) > 0,
          });
          subsByTask.set(sub.taskId, list);
        }

        const visibleTasks = directorTrackCommitteeIds
          ? roleAuthorizedTasks.filter(
              (t) =>
                (t.committeeId !== null &&
                  directorTrackCommitteeIds.has(t.committeeId)) ||
                (subsByTask.get(t.id)?.length ?? 0) > 0
            )
          : roleAuthorizedTasks.filter(
              (t) =>
                profile.role !== "hr_admin" ||
                (subsByTask.get(t.id)?.length ?? 0) > 0
            );

        for (const t of visibleTasks) {
          bulkTasks.push({
            task: {
              id: t.id,
              title: t.title,
              workType: t.workType === "task" ? "task" : "assignment",
              completionMode:
                t.completionMode === "hr_only" ? "hr_only" : "self_report",
              committeeName: t.committeeId
                ? commMap.get(t.committeeId) ?? "Committee"
                : "Branch-wide",
              maxPoints: t.maxPoints,
            },
            submissions: subsByTask.get(t.id) ?? [],
          });
        }
      }
    }
  } catch {
    // If DB is offline during build
  }

  return (
    <div className="space-y-10">
      <TaskDelegationView
        currentUserRole={profile.role}
        currentUserId={profile.id}
        currentUserCommitteeId={operationalCommitteeId}
        defaultMaxPoints={gradingWeights.defaultMaxPoints}
        taskDefaults={taskDefaults}
        assignedToMe={assignedToMe}
        eligibleMembers={eligibleMembers}
        committees={dbCommitteesList}
      />

      {bulkTasks.length > 0 && (
        <div id="grading" className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight text-[#002855]">
              Assignments &amp; Tasks Grading ({bulkTasks.length})
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click any row to expand the full keyboard grading table or task completion checklist.
            </p>
          </div>
          <div className="space-y-2.5">
            {bulkTasks.map(({ task, submissions }) => (
              <BulkTaskGradingView
                key={task.id}
                task={task}
                submissions={submissions}
                gradingWeights={gradingWeights}
                collapsible
                defaultExpanded={false}
                onGrade={gradeTaskSubmissionAction}
                onToggleTask={hrToggleTaskCompletionAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
