import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";
import {
  TaskDelegationView,
  type AssignedTaskItem,
  type EligibleAssignee,
} from "@/components/hr/task-delegation-view";
import { HrShell } from "@/components/hr/hr-shell";
import { requireHrModule } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { gradeTaskSubmissionAction } from "./actions";

export default async function HrTasksPage() {
  const { profile } = await requireHrModule("tasks");
  let eligibleMembers: EligibleAssignee[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
  let assignedToMe: AssignedTaskItem[] = [];
  let activeSeasonName = "Active Season";

  type BulkTask = {
    id: string;
    title: string;
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

  const isCommitteeHead = profile.role === "committee_head";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
      const seasonId = activeSeason.id;

      const memberFilter =
        isCommitteeHead && profile.committeeId
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
        isCommitteeHead && profile.committeeId
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
      dbCommitteesList = isCommitteeHead
        ? dbCommittees
            .filter((c) => c.id === profile.committeeId)
            .map((c) => ({ id: c.id, name: c.name }))
        : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      eligibleMembers = dbMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        role: m.role,
        committeeId: m.committeeId,
        committeeName: m.committeeId ? commMap.get(m.committeeId) : undefined,
      }));

      assignedToMe = dbMySubmissions.map((s) => ({
        id: s.taskId,
        title: s.title,
        assignedByName: "Leadership",
        assignerRole: "director",
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

        for (const t of dbTasks) {
          bulkTasks.push({
            task: {
              id: t.id,
              title: t.title,
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
    <HrShell
      activeTab="tasks"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <div className="space-y-10">
        <TaskDelegationView
          currentUserRole={profile.role}
          currentUserId={profile.id}
          currentUserCommitteeId={profile.committeeId}
          assignedToMe={assignedToMe}
          eligibleMembers={eligibleMembers}
          committees={dbCommitteesList}
        />

        <div className="border-t border-border pt-8 space-y-10">
          {bulkTasks.map(({ task, submissions }) => (
            <BulkTaskGradingView
              key={task.id}
              task={task}
              submissions={submissions}
              onGrade={gradeTaskSubmissionAction}
            />
          ))}
        </div>
      </div>
    </HrShell>
  );
}
