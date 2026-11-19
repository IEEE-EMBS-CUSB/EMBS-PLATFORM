import { HrShell } from "@/components/hr/hr-shell";
import { requireOperationalSession } from "@/lib/portal-guards";
import {
  RosterManagerView,
  type RosterMemberItem,
  type CommitteeOption,
} from "@/components/hr/roster-manager-view";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  resetMemberPasswordAction,
  assignMemberRoleAction,
  assignMemberCommitteeAction,
  addRosterMemberAction,
  removeRosterMemberAction,
} from "./actions";

export default async function HrRosterPage() {
  const { profile } = await requireOperationalSession();
  let members: RosterMemberItem[] = [];
  let availableCommittees: CommitteeOption[] = [];

  try {
    const [dbMembers, dbCommittees] = await Promise.all([
      db.select().from(schema.rosterMemberships),
      db.select().from(schema.committees),
    ]);

    const committeeMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
    availableCommittees = dbCommittees.map((c) => ({ id: c.id, name: c.name }));

    if (dbMembers.length > 0) {
      members = dbMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        committeeId: m.committeeId,
        committeeName: m.committeeId
          ? committeeMap.get(m.committeeId) ?? "Unassigned"
          : "Unassigned",
        role: m.role,
        isActive: m.isActive,
      }));
    }
  } catch {
    // If database is temporarily offline during build or prerender
  }

  if (members.length === 0) {
    members = [
      {
        id: "m-0",
        fullName: "Master Administrator",
        email: "master@cu.edu.eg",
        committeeName: "All Committees",
        role: "master_admin",
        isActive: true,
      },
      {
        id: "m-1",
        fullName: "Sara Hassan",
        email: "hr.lead@cu.edu.eg",
        committeeName: "Human Resources",
        role: "hr_admin",
        isActive: true,
      },
      {
        id: "m-1b",
        fullName: "Laila Amr",
        email: "laila.amr@cu.edu.eg",
        committeeName: "AI and Machine Learning",
        role: "hr_member",
        isActive: true,
      },
      {
        id: "m-2",
        fullName: "Salma El-Sayed",
        email: "salma.elsayed@cu.edu.eg",
        committeeName: "AI and Machine Learning",
        role: "committee_head",
        isActive: true,
      },
      {
        id: "m-3",
        fullName: "Ziad Hany",
        email: "ziad.hany@cu.edu.eg",
        committeeName: "Web Development",
        role: "committee_head",
        isActive: true,
      },
      {
        id: "m-4",
        fullName: "Omar Tarek",
        email: "omar.tarek@cu.edu.eg",
        committeeName: "Robotics and Automation",
        role: "member",
        isActive: true,
      },
      {
        id: "m-5",
        fullName: "Nourhan Khaled",
        email: "nourhan.khaled@cu.edu.eg",
        committeeName: "Graphic Design",
        role: "committee_head",
        isActive: true,
      },
      {
        id: "m-6",
        fullName: "Hana Wael",
        email: "hana.wael@cu.edu.eg",
        committeeName: "Medical Equipment and Planning",
        role: "member",
        isActive: true,
      },
      {
        id: "m-7",
        fullName: "Mariam Yassin",
        email: "mariam.yassin@gmail.com",
        committeeName: "General Track",
        role: "attendee",
        isActive: true,
      },
      {
        id: "m-8",
        fullName: "Youssef Ibrahim",
        email: "youssef.ibrahim@gmail.com",
        committeeName: "General Track",
        role: "attendee",
        isActive: true,
      },
    ];
  }

  return (
    <HrShell
      activeTab="roster"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <RosterManagerView
        members={members}
        currentUserRole={profile.role}
        availableCommittees={
          availableCommittees.length > 0 ? availableCommittees : undefined
        }
        onResetPassword={resetMemberPasswordAction}
        onAssignRole={assignMemberRoleAction}
        onAssignCommittee={assignMemberCommitteeAction}
        onAddMember={addRosterMemberAction}
        onRemoveMember={removeRosterMemberAction}
      />
    </HrShell>
  );
}
