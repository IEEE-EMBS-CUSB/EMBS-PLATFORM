import {
  PointsLedgerView,
  type LedgerEntryItem,
} from "@/components/hr/points-ledger-view";
import { requireHrModule } from "@/lib/portal-guards";
import { getOperationalCommitteeScope } from "@/lib/permissions";
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
  const defaultMonth = new Date().toISOString().slice(0, 7);

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

      const [allSeasonMembers, dbCommittees] = await Promise.all([
        db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            fullName: schema.persons.fullName,
            email: schema.persons.email,
            committeeId: schema.rosterMemberships.committeeId,
            role: schema.rosterMemberships.role,
            isActive: schema.rosterMemberships.isActive,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(eq(schema.rosterMemberships.seasonId, seasonId)),
        db
          .select()
          .from(schema.committees)
          .where(eq(schema.committees.seasonId, seasonId)),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const memberMap = new Map(allSeasonMembers.map((m) => [m.id, m]));
      const authorMap = new Map(allSeasonMembers.map((m) => [m.id, m.fullName]));
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      const visibleMembers = allSeasonMembers.filter((m) => {
        if (!m.isActive || m.role === "attendee") return false;
        if (isCommitteeScoped) {
          return (
            operationalCommitteeId !== null &&
            m.committeeId === operationalCommitteeId
          );
        }
        if (directorTrackCommitteeIds) {
          return m.committeeId !== null && directorTrackCommitteeIds.has(m.committeeId);
        }
        return true;
      });

      // Exclude self (across all hats owned by the same person) from manual bonus award dropdown
      members = visibleMembers
        .filter((m) => m.id !== profile.id && m.personId !== profile.personId)
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          committeeName: m.committeeId
            ? commMap.get(m.committeeId) ?? "Unassigned"
            : "Unassigned",
        }));

      const visibleMemberIds = visibleMembers.map((m) => m.id);
      const isMemberScoped = isCommitteeScoped || Boolean(directorTrackCommitteeIds);
      const dbLedger =
        visibleMemberIds.length > 0
          ? await db
              .select()
              .from(schema.scoreLedger)
              .where(
                isMemberScoped
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

  const isReadOnly = profile.role === "director";

  return (
    <PointsLedgerView
      entries={entries}
      members={isReadOnly ? [] : members}
      currentUserName={profile.fullName}
      defaultMonth={defaultMonth}
      readOnly={isReadOnly}
      scopedTrackName={profile.managedTrackName ?? undefined}
      onAddEntry={isReadOnly ? undefined : addManualLedgerEntryAction}
    />
  );
}
