import { requireHrModule } from "@/lib/portal-guards";
import {
  RosterManagerView,
  type RosterMemberItem,
  type CommitteeOption,
  type TrackOption,
} from "@/components/hr/roster-manager-view";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureDefaultTracksForSeason } from "@/services/hr-ops/committees.service";
import {
  resetMemberPasswordAction,
  assignMemberRoleAction,
  assignMemberCommitteeAction,
  assignDirectorTrackAction,
  addRosterMemberAction,
  bulkImportRosterAction,
  removeRosterMemberAction,
} from "./actions";

export default async function HrRosterPage() {
  const { profile } = await requireHrModule("roster");
  let members: RosterMemberItem[] = [];
  let availableCommittees: CommitteeOption[] = [];
  let availableTracks: TrackOption[] = [];

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      const dbTracks = await ensureDefaultTracksForSeason(seasonId);

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
      const trackMap = new Map(dbTracks.map((t) => [t.id, t.name]));

      const isTrackDirector =
        profile.role === "director" && Boolean(profile.managedTrackId);
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      availableTracks = dbTracks.map((t) => ({ id: t.id, name: t.name }));
      availableCommittees = dbCommittees
        .filter((c) => !isTrackDirector || c.trackId === profile.managedTrackId)
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));

      members = dbMembers
        .filter((m) => {
          if (!directorTrackCommitteeIds) return true;
          if (m.id === profile.id) return true;
          return m.committeeId !== null && directorTrackCommitteeIds.has(m.committeeId);
        })
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          committeeId: m.committeeId,
          committeeName: m.committeeId
            ? committeeMap.get(m.committeeId) ?? "Unassigned"
            : "Unassigned",
          managedTrackId: m.managedTrackId,
          managedTrackName: m.managedTrackId
            ? trackMap.get(m.managedTrackId) ?? null
            : null,
          role: m.role,
          isActive: m.isActive,
        }));
    }
  } catch {
    // If database is temporarily offline during build
  }

  return (
    <RosterManagerView
      members={members}
      currentUserRole={profile.role}
      scopedTrackName={
        profile.role === "director" ? profile.managedTrackName ?? null : null
      }
      availableCommittees={
        availableCommittees.length > 0 ? availableCommittees : undefined
      }
      availableTracks={availableTracks.length > 0 ? availableTracks : undefined}
      onResetPassword={resetMemberPasswordAction}
      onAssignRole={assignMemberRoleAction}
      onAssignCommittee={assignMemberCommitteeAction}
      onAssignDirectorTrack={assignDirectorTrackAction}
      onAddMember={addRosterMemberAction}
      onBulkImport={bulkImportRosterAction}
      onRemoveMember={removeRosterMemberAction}
    />
  );
}
