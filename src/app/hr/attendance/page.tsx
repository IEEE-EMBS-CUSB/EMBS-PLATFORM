import {
  AttendanceManagerView,
  type SessionItem,
} from "@/components/hr/attendance-manager-view";
import { HrShell } from "@/components/hr/hr-shell";
import { requireOperationalSession } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { count, desc } from "drizzle-orm";

export default async function HrAttendancePage() {
  const { profile } = await requireOperationalSession();

  let dbSessionsList: SessionItem[] = [];
  let dbCommitteesList: Array<{ id: string; name: string }> = [];

  try {
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
        .orderBy(desc(schema.branchSessions.startsAt)),
      db.select().from(schema.committees),
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
    dbCommitteesList = dbCommittees.map((c) => ({ id: c.id, name: c.name }));

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
  } catch {
    // If DB is offline during build
  }

  const sampleSessions: SessionItem[] = [
    {
      id: "sess-1",
      title: "Season Opening General Meeting",
      committeeName: "Branch-wide",
      startsAt: new Date("2026-09-05T17:00:00Z"),
      checkinOpen: true,
      checkinCode: "847291",
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 42,
    },
    {
      id: "sess-2",
      title: "AI & ML Workshop 1",
      committeeName: "AI and Machine Learning",
      startsAt: new Date("2026-09-12T16:00:00Z"),
      checkinOpen: false,
      checkinCode: null,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 14,
    },
    {
      id: "sess-3",
      title: "Web Dev Workshop: Next.js Fundamentals",
      committeeName: "Web Development",
      startsAt: new Date("2026-09-15T18:00:00Z"),
      checkinOpen: false,
      checkinCode: null,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 12,
    },
    {
      id: "sess-4",
      title: "Officers & Committee Heads Sync",
      committeeName: "Leadership Only",
      startsAt: new Date("2026-09-20T19:00:00Z"),
      checkinOpen: false,
      checkinCode: null,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 8,
    },
  ];

  const sessions =
    dbSessionsList.length > 0 ? dbSessionsList : sampleSessions;

  return (
    <HrShell
      activeTab="attendance"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <AttendanceManagerView
        sessions={sessions}
        currentUserRole={profile.role}
        currentUserCommitteeId={profile.committeeId}
        currentUserCommitteeName={profile.committeeName}
        committees={dbCommitteesList}
      />
    </HrShell>
  );
}
