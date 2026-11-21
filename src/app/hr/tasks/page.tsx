import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";
import {
  TaskDelegationView,
  type AssignedTaskItem,
  type EligibleAssignee,
} from "@/components/hr/task-delegation-view";
import { requireHrModule } from "@/lib/portal-guards";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  type SeasonGradingSettings,
} from "@/lib/season-settings";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { gradeTaskSubmissionAction } from "./actions";

export default async function HrTasksPage() {
  const { profile } = await requireHrModule("tasks");
  let eligibleMembers: EligibleAssignee[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
  let assignedToMe: AssignedTaskItem[] = [];
  let gradingWeights: SeasonGradingSettings = DEFAULT_SEASON_SETTINGS.grading;

  type BulkTask = {
    id: string;
    title: string;
    workType: "assignment" | "task";
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
  };
  const bulkTasks: { task: BulkTask; submissions: BulkSubmission[] }[] = [];

  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";
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

      const memberFilter =
        isCommitteeScoped && profile.committeeId
          ? and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.committeeId, profile.committeeId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            )
          : and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            );

      const taskFilter =
        isCommitteeScoped && profile.committeeId
          ? and(
              eq(schema.tasks.seasonId, seasonId),
              eq(schema.tasks.committeeId, profile.committeeId)
            )
          : eq(schema.tasks.seasonId, seasonId);

      const [dbMembers, dbCommittees, dbMySubmissions, dbTasks] =
        await Promise.all([
          db.select().from(schema.rosterMemberships).where(memberFilter),
          db
            .select()
            .from(schema.committees)
            .where(
              and(
                eq(schema.committees.seasonId, seasonId),
                eq(schema.committees.isActive, true)
              )
            ),
          db
            .select({
              taskId: schema.tasks.id,
              title: schema.tasks.title,
              workType: schema.tasks.workType,
              dueAt: schema.tasks.dueAt,
              maxPoints: schema.tasks.maxPoints,
              totalPoints: schema.taskSubmissions.totalPoints,
              submittedAt: schema.taskSubmissions.submittedAt,
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
            .orderBy(desc(schema.tasks.createdAt)),
          db
            .select()
            .from(schema.tasks)
            .where(taskFilter)
            .orderBy(desc(schema.tasks.createdAt)),
        ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      dbCommitteesList = isCommitteeScoped
        ? dbCommittees
            .filter((c) => c.id === profile.committeeId)
            .map((c) => ({ id: c.id, name: c.name }))
        : directorTrackCommitteeIds
          ? dbCommittees
              .filter((c) => directorTrackCommitteeIds.has(c.id))
              .map((c) => ({ id: c.id, name: c.name }))
          : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      const scopedMembers = directorTrackCommitteeIds
        ? dbMembers.filter(
            (m) =>
              m.committeeId !== null &&
              directorTrackCommitteeIds.has(m.committeeId)
          )
        : dbMembers;

      eligibleMembers = scopedMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        role: m.role,
        committeeId: m.committeeId,
        committeeName: m.committeeId ? commMap.get(m.committeeId) : undefined,
      }));

      assignedToMe = dbMySubmissions.map((s) => ({
        id: s.taskId,
        title: s.title,
        workType: s.workType === "task" ? "task" : "assignment",
        assignedByName: "Leadership",
        assignerRole: s.workType === "task" ? "hr_admin" : "director",
        dueAt: s.dueAt,
        maxPoints: s.maxPoints,
        status:
          s.totalPoints !== null
            ? "completed"
            : s.submittedAt
              ? "in_progress"
              : "not_started",
      }));

      // Load all submissions for visible tasks in a single query (eliminates N+1)
      if (dbTasks.length > 0) {
        const taskIds = dbTasks.map((t) => t.id);
        const allSubs = await db
          .select({
            sub: schema.taskSubmissions,
            member: schema.rosterMemberships,
          })
          .from(schema.taskSubmissions)
          .innerJoin(
            schema.rosterMemberships,
            eq(schema.taskSubmissions.membershipId, schema.rosterMemberships.id)
          )
          .where(inArray(schema.taskSubmissions.taskId, taskIds));

        const subsByTask = new Map<string, BulkSubmission[]>();
        for (const { sub, member } of allSubs) {
          if (
            directorTrackCommitteeIds &&
            (!member.committeeId ||
              !directorTrackCommitteeIds.has(member.committeeId))
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
          });
          subsByTask.set(sub.taskId, list);
        }

        const visibleTasks = directorTrackCommitteeIds
          ? dbTasks.filter(
              (t) =>
                (t.committeeId !== null &&
                  directorTrackCommitteeIds.has(t.committeeId)) ||
                (subsByTask.get(t.id)?.length ?? 0) > 0
            )
          : dbTasks;

        for (const t of visibleTasks) {
          bulkTasks.push({
            task: {
              id: t.id,
              title: t.title,
              workType: t.workType === "task" ? "task" : "assignment",
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
        currentUserCommitteeId={profile.committeeId}
        defaultMaxPoints={gradingWeights.defaultMaxPoints}
        assignedToMe={assignedToMe}
        eligibleMembers={eligibleMembers}
        committees={dbCommitteesList}
      />

      {bulkTasks.length > 0 && (
        <div className="space-y-10 border-t border-border pt-8">
          {bulkTasks.map(({ task, submissions }) => (
            <BulkTaskGradingView
              key={task.id}
              task={task}
              submissions={submissions}
              gradingWeights={gradingWeights}
              onGrade={gradeTaskSubmissionAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
