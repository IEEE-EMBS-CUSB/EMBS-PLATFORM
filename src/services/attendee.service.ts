import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type {
  AttendeeAssignment,
  AttendeeDashboardData,
  AttendeeParticipationSummary,
  AttendeeProfile,
  AttendeeSessionRecord,
} from "@/types";

export async function getAttendeeProfile(
  attendeeId: string
): Promise<AttendeeProfile | null> {
  try {
    const rows = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.persons.fullName,
        role: schema.rosterMemberships.role,
        committeeName: schema.committees.name,
        seasonName: schema.seasons.name,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .leftJoin(
        schema.seasons,
        eq(schema.rosterMemberships.seasonId, schema.seasons.id)
      )
      .where(
        and(
          eq(schema.rosterMemberships.id, attendeeId),
          eq(schema.rosterMemberships.isActive, true),
          eq(schema.persons.isActive, true),
          eq(schema.rosterMemberships.role, "attendee")
        )
      )
      .limit(1);

    const attendee = rows[0];
    if (attendee) {
      return {
        id: attendee.id,
        displayId: `ATT-${attendee.id.slice(0, 6).toUpperCase()}`,
        fullName: attendee.fullName,
        programTrack: attendee.committeeName
          ? `${attendee.committeeName} Track`
          : "IEEE EMBS CUSB Workshop Track",
        cohortLabel: attendee.seasonName ?? "Active Season",
      };
    }
  } catch {
    // Graceful fallback
  }
  return null;
}

export async function getAttendeeAttendance(
  attendeeId: string
): Promise<AttendeeSessionRecord[]> {
  try {
    const records = await db
      .select({
        record: schema.attendanceRecords,
        session: schema.branchSessions,
        committee: schema.committees,
      })
      .from(schema.attendanceRecords)
      .innerJoin(
        schema.branchSessions,
        eq(schema.attendanceRecords.sessionId, schema.branchSessions.id)
      )
      .leftJoin(
        schema.committees,
        eq(schema.branchSessions.committeeId, schema.committees.id)
      )
      .where(eq(schema.attendanceRecords.membershipId, attendeeId))
      .orderBy(desc(schema.branchSessions.startsAt));

    if (records.length > 0) {
      return records.map(({ record, session, committee }) => ({
        id: record.id,
        date: session.startsAt.toISOString().slice(0, 10),
        sessionTitle: session.title,
        committeeName: committee?.name ?? "General Chapter",
        deliveredBy: "EMBS Chapter Lead",
        status: "attended" as const,
        arrival: record.isPunctual ? ("on_time" as const) : ("late" as const),
        slideDeckUrl: session.slideDeckUrl ?? null,
        webConferencingUrl: session.webConferencingUrl ?? null,
      }));
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getAttendeeAssignments(
  attendeeId: string
): Promise<AttendeeAssignment[]> {
  try {
    const tasks = await db
      .select({
        submission: schema.taskSubmissions,
        task: schema.tasks,
        committee: schema.committees,
      })
      .from(schema.taskSubmissions)
      .innerJoin(
        schema.tasks,
        eq(schema.taskSubmissions.taskId, schema.tasks.id)
      )
      .leftJoin(
        schema.committees,
        eq(schema.tasks.committeeId, schema.committees.id)
      )
      .where(eq(schema.taskSubmissions.membershipId, attendeeId))
      .orderBy(desc(schema.tasks.dueAt));

    if (tasks.length > 0) {
      return tasks.map(({ submission, task, committee }) => ({
        id: task.id,
        title: task.title,
        sessionTitle: committee?.name ?? "Workshop Track Deliverable",
        dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
        submittedAt: submission.submittedAt
          ? submission.submittedAt.toISOString().slice(0, 10)
          : undefined,
        status: submission.gradedAt
          ? ("graded" as const)
          : submission.submittedAt
          ? ("submitted" as const)
          : ("pending" as const),
        mark: submission.totalPoints,
        maxMark: task.maxPoints,
        instructorNote: submission.notes
          ? submission.notes
          : submission.qualityScore
          ? `Quality: ${submission.qualityScore}/5`
          : undefined,
      }));
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getAttendeeDashboard(
  attendeeId: string
): Promise<AttendeeDashboardData | null> {
  const profile = await getAttendeeProfile(attendeeId);
  if (!profile) return null;

  const [sessions, assignments] = await Promise.all([
    getAttendeeAttendance(attendeeId),
    getAttendeeAssignments(attendeeId),
  ]);

  const sessionsAttended = sessions.filter(
    (s) => s.status === "attended"
  ).length;
  const assignmentsCompleted = assignments.filter(
    (a) => a.status === "graded" || a.status === "submitted"
  ).length;

  const totalEarnedMarks = assignments.reduce(
    (sum, a) => sum + (a.mark ?? 0),
    0
  );
  const totalPossibleMarks = assignments.reduce(
    (sum, a) => sum + (a.maxMark ?? 0),
    0
  );

  const participation: AttendeeParticipationSummary = {
    sessionsAttended,
    totalSessions: sessions.length,
    assignmentsCompleted,
    totalAssignments: assignments.length,
    marksSummaryLabel:
      totalPossibleMarks > 0
        ? `${totalEarnedMarks} / ${totalPossibleMarks}`
        : "No graded assignments yet",
    participationStanding:
      sessionsAttended >= 2 ? "Active Participant" : "Enrolled Participant",
    nextMilestoneNote:
      "Complete all track workshops and assignments for certification.",
  };

  return {
    profile,
    participation,
    recentSessions: sessions.slice(0, 5),
    recentAssignments: assignments.slice(0, 5),
  };
}
