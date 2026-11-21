import {
  AttendanceManagerView,
  type SessionItem,
} from "@/components/hr/attendance-manager-view";
import { requireHrModule } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, count, desc, eq } from "drizzle-orm";

export default async function HrAttendancePage() {
  const { profile } = await requireHrModule("attendance");

  let dbSessionsList: SessionItem[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];

  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;

      const sessionFilter =
        isCommitteeScoped && profile.committeeId
          ? and(
              eq(schema.branchSessions.seasonId, seasonId),
              eq(schema.branchSessions.committeeId, profile.committeeId)
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
            checkinExpiresAt: schema.branchSessions.checkinExpiresAt,
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
          .groupBy(schema.attendanceRecords.sessionId),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const countMap = new Map(
        attendanceCounts.map((a) => [a.sessionId, Number(a.count)])
      );
      dbCommitteesList = isCommitteeScoped
        ? dbCommittees
            .filter((c) => c.id === profile.committeeId)
            .map((c) => ({ id: c.id, name: c.name }))
        : dbCommittees.map((c) => ({ id: c.id, name: c.name }));

      dbSessionsList = dbSessions.map((s) => ({
        id: s.id,
        title: s.title,
        committeeId: s.committeeId,
        committeeName: s.committeeId
          ? commMap.get(s.committeeId) ?? "Unknown"
          : "Branch-wide",
        startsAt: s.startsAt,
        checkinOpen: s.checkinOpen,
        checkinCode: s.checkinCode,
        checkinExpiresAt: s.checkinExpiresAt,
        basePoints: s.basePoints,
        punctualityBonus: s.punctualityBonus,
        attendanceCount: countMap.get(s.id) ?? 0,
      }));
    }
  } catch {
    // If DB is offline during build
  }

  return (
    <AttendanceManagerView
      sessions={dbSessionsList}
      currentUserRole={profile.role}
      currentUserCommitteeId={profile.committeeId}
      currentUserCommitteeName={profile.committeeName}
      committees={dbCommitteesList}
    />
  );
}
