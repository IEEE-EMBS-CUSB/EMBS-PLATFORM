import {
  AttendanceManagerView,
  type SessionItem,
} from "@/components/hr/attendance-manager-view";
import { requireHrModule } from "@/lib/portal-guards";
import { getOperationalCommitteeScope } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  type SeasonAttendanceSettings,
} from "@/lib/season-settings";
import {
  closeExpiredSessionsForSeason,
  getSessionCheckinState,
  type InstructorCandidate,
  type SessionInstructorSummary,
} from "@/services/hr-ops/attendance.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

export default async function HrAttendancePage() {
  const { profile } = await requireHrModule("attendance");

  let dbSessionsList: SessionItem[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
  let instructorCandidates: InstructorCandidate[] = [];
  let attendanceDefaults: SeasonAttendanceSettings =
    DEFAULT_SEASON_SETTINGS.attendance;

  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";
  const operationalCommitteeId = getOperationalCommitteeScope(profile);
  const operationalCommitteeName =
    profile.role === "hr_member"
      ? profile.trackedCommitteeName
      : profile.committeeName;

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      const now = new Date();
      // Lazily close any expired check-in windows before reading
      await closeExpiredSessionsForSeason(seasonId, now);

      attendanceDefaults = normalizeSeasonSettings(
        activeSeason.settingsJson
      ).attendance;

      const sessionFilter =
        isCommitteeScoped && operationalCommitteeId
          ? and(
              eq(schema.branchSessions.seasonId, seasonId),
              eq(schema.branchSessions.committeeId, operationalCommitteeId)
            )
          : eq(schema.branchSessions.seasonId, seasonId);

      const skipSessionQuery = isCommitteeScoped && !operationalCommitteeId;

      const instructorCandidateFilter =
        isCommitteeScoped && operationalCommitteeId
          ? and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true),
              eq(schema.rosterMemberships.role, "committee_head"),
              eq(schema.rosterMemberships.committeeId, operationalCommitteeId)
            )
          : and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true),
              inArray(schema.rosterMemberships.role, [
                "committee_head",
                "master_admin",
                "director",
                "hr_admin",
              ])
            );

      const [dbSessions, dbCommittees, attendanceCounts, dbInstructorRows] =
        await Promise.all([
          skipSessionQuery
            ? Promise.resolve([])
            : db
                .select({
                  id: schema.branchSessions.id,
                  title: schema.branchSessions.title,
                  committeeId: schema.branchSessions.committeeId,
                  startsAt: schema.branchSessions.startsAt,
                  checkinOpen: schema.branchSessions.checkinOpen,
                  checkinCode: schema.branchSessions.checkinCode,
                  checkinStartsAt: schema.branchSessions.checkinStartsAt,
                  checkinEndsAt: schema.branchSessions.checkinEndsAt,
                  punctualityStartsAt: schema.branchSessions.punctualityStartsAt,
                  punctualityCutoffMinutes:
                    schema.branchSessions.punctualityCutoffMinutes,
                  basePoints: schema.branchSessions.basePoints,
                  punctualityBonus: schema.branchSessions.punctualityBonus,
                  sessionMode: schema.branchSessions.sessionMode,
                  slideDeckUrl: schema.branchSessions.slideDeckUrl,
                  webConferencingUrl: schema.branchSessions.webConferencingUrl,
                  locationUrl: schema.branchSessions.locationUrl,
                  locationAddress: schema.branchSessions.locationAddress,
                })
                .from(schema.branchSessions)
                .where(sessionFilter)
                .orderBy(desc(schema.branchSessions.startsAt)),
          db
            .select()
            .from(schema.committees)
            .where(
              and(
                eq(schema.committees.seasonId, seasonId),
                eq(schema.committees.isActive, true)
              )
            ),
          skipSessionQuery
            ? Promise.resolve([])
            : db
                .select({
                  sessionId: schema.attendanceRecords.sessionId,
                  count: count(schema.attendanceRecords.id),
                })
                .from(schema.attendanceRecords)
                .where(eq(schema.attendanceRecords.status, "present"))
                .groupBy(schema.attendanceRecords.sessionId),
          skipSessionQuery
            ? Promise.resolve([])
            : db
                .select({
                  membershipId: schema.rosterMemberships.id,
                  personId: schema.rosterMemberships.personId,
                  fullName: schema.persons.fullName,
                  email: schema.persons.email,
                  phoneNumber: schema.persons.phoneNumber,
                  role: schema.rosterMemberships.role,
                  committeeId: schema.rosterMemberships.committeeId,
                })
                .from(schema.rosterMemberships)
                .innerJoin(
                  schema.persons,
                  eq(schema.rosterMemberships.personId, schema.persons.id)
                )
                .where(instructorCandidateFilter)
                .orderBy(asc(schema.persons.fullName)),
        ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const countMap = new Map(
        attendanceCounts.map((a) => [a.sessionId, Number(a.count)])
      );

      const sessionIds = dbSessions.map((s) => s.id);
      const assignedInstructorsBySession = new Map<
        string,
        SessionInstructorSummary[]
      >();
      if (sessionIds.length > 0) {
        const assignedRows = await db
          .select({
            sessionId: schema.branchSessionInstructors.sessionId,
            membershipId: schema.rosterMemberships.id,
            fullName: schema.persons.fullName,
            role: schema.rosterMemberships.role,
          })
          .from(schema.branchSessionInstructors)
          .innerJoin(
            schema.rosterMemberships,
            eq(
              schema.branchSessionInstructors.membershipId,
              schema.rosterMemberships.id
            )
          )
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(inArray(schema.branchSessionInstructors.sessionId, sessionIds))
          .orderBy(asc(schema.persons.fullName));

        for (const row of assignedRows) {
          const list = assignedInstructorsBySession.get(row.sessionId) ?? [];
          list.push({
            membershipId: row.membershipId,
            fullName: row.fullName,
            role: row.role as MembershipRole,
          });
          assignedInstructorsBySession.set(row.sessionId, list);
        }
      }

      instructorCandidates = dbInstructorRows.map((r) => ({
        membershipId: r.membershipId,
        personId: r.personId,
        fullName: r.fullName,
        email: r.email,
        phoneNumber: r.phoneNumber,
        role: r.role as MembershipRole,
        committeeId: r.committeeId,
        committeeName: r.committeeId ? (commMap.get(r.committeeId) ?? null) : null,
        isActive: true,
      }));

      dbCommitteesList = isCommitteeScoped
        ? dbCommittees
            .filter(
              (c) =>
                operationalCommitteeId !== null &&
                c.id === operationalCommitteeId
            )
            .map((c) => ({ id: c.id, name: c.name }))
        : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      dbSessionsList = dbSessions.map((s) => {
        const state = getSessionCheckinState(s, now);
        return {
          id: s.id,
          title: s.title,
          committeeId: s.committeeId,
          committeeName: s.committeeId
            ? commMap.get(s.committeeId) ?? "Unknown"
            : "Branch-wide",
          startsAt: s.startsAt,
          checkinOpen: state !== "closed",
          checkinCode: s.checkinCode,
          checkinStartsAt: s.checkinStartsAt,
          checkinEndsAt: s.checkinEndsAt,
          punctualityStartsAt: s.punctualityStartsAt,
          punctualityCutoffMinutes: s.punctualityCutoffMinutes,
          basePoints: s.basePoints,
          punctualityBonus: s.punctualityBonus,
          sessionMode: s.sessionMode === "online" ? "online" : "offline",
          slideDeckUrl: s.slideDeckUrl ?? null,
          webConferencingUrl: s.webConferencingUrl ?? null,
          locationUrl: s.locationUrl ?? null,
          locationAddress: s.locationAddress ?? null,
          instructors: assignedInstructorsBySession.get(s.id) ?? [],
          attendanceCount: countMap.get(s.id) ?? 0,
        };
      });
    }
  } catch {
    // If DB is offline during build
  }

  return (
    <AttendanceManagerView
      sessions={dbSessionsList}
      currentUserRole={profile.role}
      currentUserCommitteeId={operationalCommitteeId}
      currentUserCommitteeName={operationalCommitteeName}
      committees={dbCommitteesList}
      instructorCandidates={instructorCandidates}
      attendanceDefaults={attendanceDefaults}
    />
  );
}
