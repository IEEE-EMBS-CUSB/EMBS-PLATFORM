import { requireHrModule } from "@/lib/portal-guards";
import {
  RosterManagerView,
  type RosterMemberItem,
  type CommitteeOption,
  type TrackOption,
  type PersonDirectoryEntry,
} from "@/components/hr/roster-manager-view";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
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
  let peopleDirectory: PersonDirectoryEntry[] = [];

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      const dbTracks = await ensureDefaultTracksForSeason(seasonId);

      const [dbMembers, dbCommittees, dbPersons] = await Promise.all([
        db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.persons.id,
            fullName: schema.persons.fullName,
            email: schema.persons.email,
            committeeId: schema.rosterMemberships.committeeId,
            trackedCommitteeId: schema.rosterMemberships.trackedCommitteeId,
            managedTrackId: schema.rosterMemberships.managedTrackId,
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
          .where(
            and(
              eq(schema.committees.seasonId, seasonId),
              eq(schema.committees.isActive, true)
            )
          ),
        profile.role === "master_admin"
          ? db
              .select({
                id: schema.persons.id,
                fullName: schema.persons.fullName,
                email: schema.persons.email,
              })
              .from(schema.persons)
              .where(eq(schema.persons.isActive, true))
              .orderBy(asc(schema.persons.fullName))
          : Promise.resolve([]),
      ]);

      peopleDirectory = dbPersons;
      const committeeMap = new Map(dbCommittees.map((c) => [c.id, c]));
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
          slug: c.slug,
          trackId: c.trackId ?? null,
        }));

      members = dbMembers
        .filter((m) => {
          if (!directorTrackCommitteeIds) return true;
          if (m.id === profile.id) return true;
          if (m.role === "hr_member" && m.trackedCommitteeId) {
            return directorTrackCommitteeIds.has(m.trackedCommitteeId);
          }
          return (
            m.committeeId !== null &&
            directorTrackCommitteeIds.has(m.committeeId)
          );
        })
        .map((m) => {
          const isHrMember = m.role === "hr_member";
          const displayCommitteeId = isHrMember
            ? m.trackedCommitteeId
            : m.committeeId;
          const displayCommittee = displayCommitteeId
            ? committeeMap.get(displayCommitteeId)
            : undefined;
          const displayCommitteeName = isHrMember
            ? m.trackedCommitteeId
              ? `Tracks ${displayCommittee?.name ?? "Unassigned"}`
              : "Unassigned"
            : displayCommittee?.name ?? "Unassigned";

          const trackId =
            m.role === "director"
              ? m.managedTrackId
              : (displayCommittee?.trackId ?? null);

          return {
            id: m.id,
            personId: m.personId,
            fullName: m.fullName,
            email: m.email,
            committeeId: displayCommitteeId,
            committeeName: displayCommitteeName,
            trackId,
            managedTrackId: m.managedTrackId,
            managedTrackName: m.managedTrackId
              ? trackMap.get(m.managedTrackId) ?? null
              : null,
            role: m.role,
            isActive: m.isActive,
          };
        });
    }
  } catch {
    // If database is temporarily offline during build
  }

  return (
    <RosterManagerView
      members={members}
      peopleDirectory={peopleDirectory}
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
