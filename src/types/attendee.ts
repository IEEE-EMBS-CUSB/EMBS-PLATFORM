import type {
  ArrivalStatus,
  AttendanceStatus,
  AttendeeAssignmentStatus,
} from "./common";
import type { SessionMode } from "@/lib/season-settings";

export interface AttendeeProfile {
  id: string;
  displayId: string;
  fullName: string;
  programTrack: string;
  cohortLabel: string;
}

export interface AttendeeSessionRecord {
  id: string;
  date: string;
  sessionTitle: string;
  committeeName: string;
  deliveredBy: string;
  sessionMode?: SessionMode;
  status: AttendanceStatus;
  arrival?: ArrivalStatus;
  slideDeckUrl?: string | null;
  webConferencingUrl?: string | null;
  locationUrl?: string | null;
  locationAddress?: string | null;
}

export interface AttendeeAssignment {
  id: string;
  title: string;
  sessionTitle: string;
  dueDate: string;
  submittedAt?: string;
  status: AttendeeAssignmentStatus;
  mark: number | null;
  maxMark: number | null;
  instructorNote?: string;
}

export interface AttendeeParticipationSummary {
  sessionsAttended: number;
  totalSessions: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  marksSummaryLabel: string;
  participationStanding: string;
  nextMilestoneNote?: string;
}

/**
 * Intentionally excludes member-only metrics such as monthly scores,
 * leaderboards, committee rankings, bonuses, and seasonal evaluations.
 */
export interface AttendeeDashboardData {
  profile: AttendeeProfile;
  participation: AttendeeParticipationSummary;
  recentSessions: AttendeeSessionRecord[];
  recentAssignments: AttendeeAssignment[];
}
