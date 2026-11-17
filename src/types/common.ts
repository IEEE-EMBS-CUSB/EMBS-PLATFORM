export type ParticipantType = "member" | "attendee";

export type MonthKey = `${number}-${string}`;

export type CommitteeTrack = "technical" | "non_technical";

export interface Committee {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  track: CommitteeTrack;
  description: string;
}

export type AttendanceStatus = "attended" | "excused" | "absent";

export type ArrivalStatus = "on_time" | "late";

export type SessionType =
  | "opening"
  | "closing"
  | "all_community_meeting"
  | "officers_meeting"
  | "committee_meeting"
  | "workshop"
  | "event";

export type MemberTaskStatus = "completed" | "in_progress" | "not_started";

export type AttendeeAssignmentStatus =
  | "graded"
  | "submitted"
  | "pending"
  | "missed";
