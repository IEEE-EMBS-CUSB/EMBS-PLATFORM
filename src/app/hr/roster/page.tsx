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
  assignHrTrackedCommitteesAction,
  assignDirectorTrackAction,
  addRosterMemberAction,
  bulkImportRosterAction,
  removeRosterMemberAction,
  updatePersonPhoneAction,
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

      const [dbMembers, dbCommittees, dbHrTrackedRows, dbPersons] =
        await Promise.all([
          db
            .select({
              id: schema.rosterMemberships.id,
              personId: schema.persons.id,
              fullName: schema.persons.fullName,
              email: schema.persons.email,
              phoneNumber: schema.persons.phoneNumber,
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
          db
            .select({
              membershipId: schema.hrMemberTrackedCommittees.membershipId,
              committeeId: schema.hrMemberTrackedCommittees.committeeId,
            })
            .from(schema.hrMemberTrackedCommittees)
            .where(eq(schema.hrMemberTrackedCommittees.seasonId, seasonId)),
          profile.role === "master_admin"
            ? db
                .select({
                  id: schema.persons.id,
                  fullName: schema.persons.fullName,
                  email: schema.persons.email,
                  phoneNumber: schema.persons.phoneNumber,
                })
                .from(schema.persons)
                .where(eq(schema.persons.isActive, true))
                .orderBy(asc(schema.persons.fullName))
            : Promise.resolve([]),
        ]);

      peopleDirectory = dbPersons;
      const committeeMap = new Map(dbCommittees.map((c) => [c.id, c]));
      const trackMap = new Map(dbTracks.map((t) => [t.id, t.name]));

      const trackedIdsByMembership = new Map<string, string[]>();
      for (const row of dbHrTrackedRows) {
        if (!committeeMap.has(row.committeeId)) continue;
        const list = trackedIdsByMembership.get(row.membershipId) ?? [];
        if (!list.includes(row.committeeId)) {
          list.push(row.committeeId);
        }
        trackedIdsByMembership.set(row.membershipId, list);
      }

      const resolveHrTrackedIds = (m: {
        id: string;
        role: string;
        trackedCommitteeId: string | null;
      }): string[] => {
        if (m.role !== "hr_member") return [];
        const fromJoin = trackedIdsByMembership.get(m.id);
        if (fromJoin && fromJoin.length > 0) {
          return [...fromJoin].sort((a, b) =>
            (committeeMap.get(a)?.name ?? "").localeCompare(
              committeeMap.get(b)?.name ?? ""
            )
          );
        }
        return m.trackedCommitteeId && committeeMap.has(m.trackedCommitteeId)
          ? [m.trackedCommitteeId]
          : [];
      };

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
          if (m.role === "hr_member") {
            const trackedIds = resolveHrTrackedIds(m);
            if (trackedIds.some((cid) => directorTrackCommitteeIds.has(cid))) {
              return true;
            }
          }
          return (
            m.committeeId !== null &&
            directorTrackCommitteeIds.has(m.committeeId)
          );
        })
        .map((m) => {
          const isHrMember = m.role === "hr_member";
          const hrTrackedIds = isHrMember ? resolveHrTrackedIds(m) : [];
          const displayCommitteeId = isHrMember
            ? (hrTrackedIds[0] ?? null)
            : m.committeeId;
          const displayCommittee = displayCommitteeId
            ? committeeMap.get(displayCommitteeId)
            : undefined;
          const trackedNames = hrTrackedIds
            .map((cid) => committeeMap.get(cid)?.name)
            .filter((name): name is string => Boolean(name));
          const displayCommitteeName = isHrMember
            ? trackedNames.length > 0
              ? `Tracks ${trackedNames.join(", ")}`
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
            phoneNumber: m.phoneNumber ?? null,
            committeeId: displayCommitteeId,
            trackedCommitteeIds: isHrMember ? hrTrackedIds : undefined,
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
      onAssignHrTrackedCommittees={assignHrTrackedCommitteesAction}
      onAssignDirectorTrack={assignDirectorTrackAction}
      onAddMember={addRosterMemberAction}
      onBulkImport={bulkImportRosterAction}
      onRemoveMember={removeRosterMemberAction}
      onUpdatePhone={updatePersonPhoneAction}
    />
  );
}
