import { HrShell } from "@/components/hr/hr-shell";
import {
  PointsLedgerView,
  type LedgerEntryItem,
} from "@/components/hr/points-ledger-view";
import { requireHrModule } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { addManualLedgerEntryAction } from "./actions";

export default async function HrLedgerPage() {
  const { profile } = await requireHrModule("ledger");

  let members: Array<{
    id: string;
    fullName: string;
    committeeName: string;
    email: string;
  }> = [];
  let entries: LedgerEntryItem[] = [];
  let activeSeasonName = "Active Season";
  const defaultMonth = new Date().toISOString().slice(0, 7);

  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
      const seasonId = activeSeason.id;

      const [allSeasonMembers, dbCommittees] = await Promise.all([
        db
          .select()
          .from(schema.rosterMemberships)
          .where(eq(schema.rosterMemberships.seasonId, seasonId)),
        db
          .select()
          .from(schema.committees)
          .where(eq(schema.committees.seasonId, seasonId)),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const memberMap = new Map(allSeasonMembers.map((m) => [m.id, m]));
      const authorMap = new Map(allSeasonMembers.map((m) => [m.id, m.fullName]));

      const visibleMembers = allSeasonMembers.filter((m) => {
        if (!m.isActive || m.role === "attendee") return false;
        if (isCommitteeScoped) {
          return profile.committeeId !== null && m.committeeId === profile.committeeId;
        }
        return true;
      });

      // Exclude self from manual bonus award dropdown
      members = visibleMembers
        .filter((m) => m.id !== profile.id)
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          committeeName: m.committeeId
            ? commMap.get(m.committeeId) ?? "Unassigned"
            : "Unassigned",
        }));

      const visibleMemberIds = visibleMembers.map((m) => m.id);
      const dbLedger =
        visibleMemberIds.length > 0
          ? await db
              .select()
              .from(schema.scoreLedger)
              .where(
                isCommitteeScoped
                  ? and(
                      eq(schema.scoreLedger.seasonId, seasonId),
                      inArray(schema.scoreLedger.membershipId, visibleMemberIds)
                    )
                  : eq(schema.scoreLedger.seasonId, seasonId)
              )
              .orderBy(desc(schema.scoreLedger.createdAt))
          : [];

      entries = dbLedger.map((l) => ({
        id: l.id,
        membershipId: l.membershipId,
        memberName: memberMap.get(l.membershipId)?.fullName ?? "Unknown",
        memberEmail: memberMap.get(l.membershipId)?.email ?? "",
        committeeName:
          commMap.get(memberMap.get(l.membershipId)?.committeeId ?? "") ??
          "Unassigned",
        month: l.month,
        sourceType: l.sourceType,
        points: l.points,
        reason: l.reason,
        createdByName: l.createdBy
          ? authorMap.get(l.createdBy) ?? "System"
          : "System",
        createdAt: l.createdAt.toISOString(),
      }));
    }
  } catch {
    // DB offline
  }

  return (
    <HrShell
      activeTab="ledger"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <PointsLedgerView
        entries={entries}
        members={members}
        currentUserName={profile.fullName}
        defaultMonth={defaultMonth}
        onAddEntry={addManualLedgerEntryAction}
      />
    </HrShell>
  );
}
