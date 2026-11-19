import * as store from "@/db/store";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
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
        fullName: schema.rosterMemberships.fullName,
        role: schema.rosterMemberships.role,
      })
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, attendeeId));

    const attendee = rows[0];
    if (attendee && attendee.role === "attendee") {
      return {
        id: attendee.id,
        displayId: `ATT-${attendee.id.slice(0, 6).toUpperCase()}`,
        fullName: attendee.fullName,
        programTrack: "Biomedical AI Foundations Track",
        cohortLabel: "Fall 2026",
      };
    }
  } catch {
    // Fall back to store
  }
  return store.getAttendeeProfile(attendeeId);
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
      .where(eq(schema.attendanceRecords.membershipId, attendeeId));

    if (records.length > 0) {
      return records.map(({ record, session, committee }) => ({
        id: record.id,
        date: session.startsAt.toISOString().slice(0, 10),
        sessionTitle: session.title,
        committeeName: committee?.name ?? "General Chapter",
        deliveredBy: "EMBS Chapter Lead",
        status: "attended" as const,
        arrival: record.isPunctual ? ("on_time" as const) : ("late" as const),
      }));
    }
  } catch {
    // Fall back to store
  }
  return store.getAttendeeAttendance(attendeeId);
}

export async function getAttendeeAssignments(
  attendeeId: string
): Promise<AttendeeAssignment[]> {
  try {
    const tasks = await db
      .select({
        submission: schema.taskSubmissions,
        task: schema.tasks,
      })
      .from(schema.taskSubmissions)
      .innerJoin(
        schema.tasks,
        eq(schema.taskSubmissions.taskId, schema.tasks.id)
      )
      .where(eq(schema.taskSubmissions.membershipId, attendeeId));

    if (tasks.length > 0) {
      return tasks.map(({ submission, task }) => ({
        id: task.id,
        title: task.title,
        sessionTitle: "Foundation Track Milestone",
        dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
        submittedAt: submission.createdAt.toISOString().slice(0, 10),
        status: submission.gradedAt
          ? ("graded" as const)
          : ("submitted" as const),
        mark: submission.totalPoints,
        maxMark: 20,
        instructorNote: submission.qualityScore
          ? `Quality: ${submission.qualityScore}/5`
          : undefined,
      }));
    }
  } catch {
    // Fall back to store
  }
  return store.getAttendeeAssignments(attendeeId);
}

export async function getAttendeeDashboard(
  attendeeId: string
): Promise<AttendeeDashboardData | null> {
  const stored = store.getAttendeeDashboard(attendeeId);
  if (stored) return stored;

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

  const participation: AttendeeParticipationSummary = {
    sessionsAttended,
    totalSessions: Math.max(sessions.length, 1),
    assignmentsCompleted,
    totalAssignments: Math.max(assignments.length, 1),
    marksSummaryLabel: `${assignmentsCompleted * 15} / ${
      Math.max(assignments.length, 1) * 20
    }`,
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
