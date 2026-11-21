import { HrShell } from "@/components/hr/hr-shell";
import { requireHrModule } from "@/lib/portal-guards";
import {
  RosterManagerView,
  type RosterMemberItem,
  type CommitteeOption,
} from "@/components/hr/roster-manager-view";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  resetMemberPasswordAction,
  assignMemberRoleAction,
  assignMemberCommitteeAction,
  addRosterMemberAction,
  bulkImportRosterAction,
  removeRosterMemberAction,
} from "./actions";

export default async function HrRosterPage() {
  const { profile } = await requireHrModule("roster");
  let members: RosterMemberItem[] = [];
  let availableCommittees: CommitteeOption[] = [];
  let activeSeasonName = "Active Season";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
      const seasonId = activeSeason.id;

      const [dbMembers, dbCommittees] = await Promise.all([
        db
          .select()
          .from(schema.rosterMemberships)
          .where(eq(schema.rosterMemberships.seasonId, seasonId)),
        db
          .select()
          .from(schema.committees)
          .where(
            and(
              eq(schema.committees.seasonId, seasonId),
              eq(schema.committees.isActive, true)
            )
          ),
      ]);

      const committeeMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      availableCommittees = dbCommittees.map((c) => ({
        id: c.id,
        name: c.name,
      }));

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
    // If database is temporarily offline during build
  }

  return (
    <HrShell
      activeTab="roster"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
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
        onBulkImport={bulkImportRosterAction}
        onRemoveMember={removeRosterMemberAction}
      />
    </HrShell>
  );
}
