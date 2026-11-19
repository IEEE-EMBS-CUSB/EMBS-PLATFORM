import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";
import {
  TaskDelegationView,
  type AssignedTaskItem,
  type EligibleAssignee,
} from "@/components/hr/task-delegation-view";
import { HrShell } from "@/components/hr/hr-shell";
import { requireOperationalSession } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function HrTasksPage() {
  const { profile } = await requireOperationalSession();
  let eligibleMembers: EligibleAssignee[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
  let assignedToMe: AssignedTaskItem[] = [];

  try {
    const [dbMembers, dbCommittees] = await Promise.all([
      db.select().from(schema.rosterMemberships),
      db.select().from(schema.committees),
    ]);
    const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
    dbCommitteesList = dbCommittees.map((c) => ({ id: c.id, name: c.name }));

    eligibleMembers = dbMembers.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      role: m.role,
      committeeId: m.committeeId,
      committeeName: m.committeeId ? commMap.get(m.committeeId) : undefined,
    }));

    // Query tasks assigned to this user
    const dbSubmissions = await db
      .select({
        taskId: schema.tasks.id,
        title: schema.tasks.title,
        dueAt: schema.tasks.dueAt,
        maxPoints: schema.tasks.maxPoints,
        totalPoints: schema.taskSubmissions.totalPoints,
      })
      .from(schema.taskSubmissions)
      .innerJoin(
        schema.tasks,
        eq(schema.taskSubmissions.taskId, schema.tasks.id)
      )
      .where(eq(schema.taskSubmissions.membershipId, profile.id))
      .orderBy(desc(schema.tasks.createdAt));

    assignedToMe = dbSubmissions.map((s) => ({
      id: s.taskId,
      title: s.title,
      assignedByName: "Leadership",
      assignerRole: "director",
      dueAt: s.dueAt,
      maxPoints: s.maxPoints,
      status:
        s.totalPoints !== null
          ? "completed"
          : "in_progress",
    }));
  } catch {
    // If DB is offline during build
  }

  if (eligibleMembers.length === 0) {
    eligibleMembers = [
      { id: "m-dir", fullName: "Khaled Mansour", role: "director" },
      {
        id: "m-hr-admin",
        fullName: "Sara Hassan",
        role: "hr_admin",
        committeeName: "Human Resources",
      },
      {
        id: "m-hr-mem",
        fullName: "Laila Amr",
        role: "hr_member",
        committeeName: "AI and Machine Learning",
      },
      {
        id: "m-head-ai",
        fullName: "Salma El-Sayed",
        role: "committee_head",
        committeeName: "AI and Machine Learning",
      },
      {
        id: "m-head-web",
        fullName: "Ziad Hany",
        role: "committee_head",
        committeeName: "Web Development",
      },
      {
        id: "m-mem-1",
        fullName: "Omar Tarek",
        role: "member",
        committeeName: "Robotics and Automation",
      },
    ];
  }

  const sampleTask = {
    id: "task-summit-campaign",
    title: "Design Summit Social Media Campaign",
    committeeName: "Graphic Design",
    maxPoints: 100,
  };

  const sampleSubmissions = [
    {
      membershipId: "m-5",
      memberName: "Nourhan Khaled",
      effortScore: 4,
      qualityScore: 5,
      timelinessScore: 5,
      totalPoints: 95,
      notes: "Exceptional visual assets delivered ahead of schedule",
    },
    {
      membershipId: "m-4",
      memberName: "Omar Tarek",
      effortScore: 3,
      qualityScore: 4,
      timelinessScore: 3,
      totalPoints: 72,
      notes: "Solid work, minor revisions needed on typography",
    },
    {
      membershipId: "m-2",
      memberName: "Salma El-Sayed",
      effortScore: 5,
      qualityScore: 5,
      timelinessScore: 4,
      totalPoints: 96,
      notes: "Delivered both technical copy and visual layout",
    },
    {
      membershipId: "m-3",
      memberName: "Ziad Hany",
      effortScore: 4,
      qualityScore: 4,
      timelinessScore: 4,
      totalPoints: 80,
      notes: "Consistent effort, on time delivery",
    },
  ];

  return (
    <HrShell
      activeTab="tasks"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
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

        <div className="border-t border-border pt-8">
          <BulkTaskGradingView
            task={sampleTask}
            submissions={sampleSubmissions}
          />
        </div>
      </div>
    </HrShell>
  );
}
