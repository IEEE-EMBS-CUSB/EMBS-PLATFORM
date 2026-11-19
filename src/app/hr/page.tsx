import { requireOperationalSession } from "@/lib/portal-guards";
import { HrShell } from "@/components/hr/hr-shell";
import { RoleOperationalDashboard } from "@/components/hr/role-operational-dashboard";
import type { AssignedTaskItem } from "@/components/hr/task-delegation-view";

export default async function HrOverviewPage() {
  const { profile } = await requireOperationalSession();

  let assignedTasks: AssignedTaskItem[] = [];

  // Dual-role deliverable directives populated based on leadership assignments
  if (profile.role === "committee_head" || profile.role === "hr_admin") {
    assignedTasks = [
      {
        id: "t-dir-1",
        title: "Draft Q2 Committee Roadmap & Milestones",
        assignedByName: "Khaled Mansour",
        assignerRole: "director",
        dueAt: new Date("2026-11-30"),
        maxPoints: 100,
        status: "in_progress",
      },
      {
        id: "t-dir-2",
        title: "Finalize Mid-Season Curriculum & Lab Hardware Kit Order",
        assignedByName: "Khaled Mansour",
        assignerRole: "director",
        dueAt: new Date("2026-12-15"),
        maxPoints: 100,
        status: "in_progress",
      },
    ];
  } else if (profile.role === "hr_member") {
    assignedTasks = [
      {
        id: "t-hr-1",
        title: "Audit Committee Attendance Logs for October",
        assignedByName: "Sara Hassan",
        assignerRole: "hr_admin",
        dueAt: new Date("2026-11-28"),
        maxPoints: 50,
        status: "in_progress",
      },
    ];
  }

  return (
    <HrShell
      activeTab="overview"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <RoleOperationalDashboard
        currentUserRole={profile.role}
        userName={profile.fullName}
        committeeName={profile.committeeName}
        assignedTasks={assignedTasks}
      />
    </HrShell>
  );
}
