import {
  AttendanceManagerView,
  type SessionItem,
} from "@/components/hr/attendance-manager-view";
import { requireHrModule } from "@/lib/portal-guards";
import { getOperationalCommitteeScope } from "@/lib/permissions";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  type SeasonAttendanceSettings,
} from "@/lib/season-settings";
import {
  closeExpiredSessionsForSeason,
  isSessionCheckinLive,
} from "@/services/hr-ops/attendance.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, count, desc, eq } from "drizzle-orm";

export default async function HrAttendancePage() {
  const { profile } = await requireHrModule("attendance");

  let dbSessionsList: SessionItem[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];
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

      const [dbSessions, dbCommittees, attendanceCounts] = await Promise.all([
        db
          .select({
            id: schema.branchSessions.id,
            title: schema.branchSessions.title,
            committeeId: schema.branchSessions.committeeId,
            startsAt: schema.branchSessions.startsAt,
            checkinOpen: schema.branchSessions.checkinOpen,
            checkinCode: schema.branchSessions.checkinCode,
            checkinEndsAt: schema.branchSessions.checkinEndsAt,
            checkinExpiresAt: schema.branchSessions.checkinExpiresAt,
            punctualityCutoffMinutes:
              schema.branchSessions.punctualityCutoffMinutes,
            basePoints: schema.branchSessions.basePoints,
            punctualityBonus: schema.branchSessions.punctualityBonus,
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
        db
          .select({
            sessionId: schema.attendanceRecords.sessionId,
            count: count(schema.attendanceRecords.id),
          })
          .from(schema.attendanceRecords)
          .where(eq(schema.attendanceRecords.status, "present"))
          .groupBy(schema.attendanceRecords.sessionId),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const countMap = new Map(
        attendanceCounts.map((a) => [a.sessionId, Number(a.count)])
      );
      dbCommitteesList = isCommitteeScoped
        ? dbCommittees
            .filter(
              (c) =>
                operationalCommitteeId !== null &&
                c.id === operationalCommitteeId
            )
            .map((c) => ({ id: c.id, name: c.name }))
        : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      dbSessionsList = (
        isCommitteeScoped && !operationalCommitteeId ? [] : dbSessions
      ).map((s) => {
        const isLive = isSessionCheckinLive(s, now);
        return {
          id: s.id,
          title: s.title,
          committeeId: s.committeeId,
          committeeName: s.committeeId
            ? commMap.get(s.committeeId) ?? "Unknown"
            : "Branch-wide",
          startsAt: s.startsAt,
          checkinOpen: isLive,
          checkinCode: isLive ? s.checkinCode : null,
          checkinExpiresAt: s.checkinEndsAt ?? s.checkinExpiresAt,
          punctualityCutoffMinutes: s.punctualityCutoffMinutes,
          basePoints: s.basePoints,
          punctualityBonus: s.punctualityBonus,
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
      attendanceDefaults={attendanceDefaults}
    />
  );
}
