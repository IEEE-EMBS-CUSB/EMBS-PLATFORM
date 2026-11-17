import { MOCK_ATTENDEES } from "@/data/mock/attendees";
import type {
  AttendeeAssignment,
  AttendeeDashboardData,
  AttendeeProfile,
  AttendeeSessionRecord,
} from "@/types";

export async function getAttendeeProfile(
  attendeeId: string
): Promise<AttendeeProfile | null> {
  const dataset = MOCK_ATTENDEES[attendeeId];
  if (!dataset) return null;
  return { ...dataset.profile };
}

export async function getAttendeeAttendance(
  attendeeId: string
): Promise<AttendeeSessionRecord[]> {
  const dataset = MOCK_ATTENDEES[attendeeId];
  if (!dataset) return [];
  return [...dataset.sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({ ...session }));
}

export async function getAttendeeAssignments(
  attendeeId: string
): Promise<AttendeeAssignment[]> {
  const dataset = MOCK_ATTENDEES[attendeeId];
  if (!dataset) return [];
  return [...dataset.assignments]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .map((assignment) => ({ ...assignment }));
}

export async function getAttendeeDashboard(
  attendeeId: string
): Promise<AttendeeDashboardData | null> {
  const dataset = MOCK_ATTENDEES[attendeeId];
  if (!dataset) return null;

  const [profile, sessions, assignments] = await Promise.all([
    getAttendeeProfile(attendeeId),
    getAttendeeAttendance(attendeeId),
    getAttendeeAssignments(attendeeId),
  ]);

  if (!profile) return null;

  return {
    profile,
    participation: { ...dataset.participation },
    recentSessions: sessions.slice(0, 4),
    recentAssignments: assignments.slice(0, 3),
  };
}
