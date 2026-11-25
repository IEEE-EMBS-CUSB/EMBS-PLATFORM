import type {
  ArrivalStatus,
  AttendanceStatus,
  Committee,
  MemberTaskStatus,
  MonthKey,
  SessionType,
} from "./common";
import type { SessionMode } from "@/lib/season-settings";

export type MemberRole =
  | "Master Admin"
  | "Director"
  | "HR Admin"
  | "HR Member"
  | "Head"
  | "Member"
  | "Attendee"
  | "Vice"
  | "Chairwoman"
  | "Treasurer";

export type ScoreComponentKey =
  | "attendance"
  | "tasks"
  | "projects"
  | "hackathons"
  | "delivered_sessions"
  | "bonuses";

export interface MemberProfile {
  id: string;
  displayId: string;
  fullName: string;
  committee: Committee;
  role: MemberRole;
  seasonLabel: string;
}

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  /** Score value provided directly by the backend. Frontend does not compute weights. */
  points: number;
  maxPoints?: number;
  detail?: string;
}

export interface MonthlyScoreRecord {
  month: MonthKey;
  monthLabel: string;
  isPublished: boolean;
  /** Total monthly score supplied by the backend scoring engine. */
  totalScore: number;
  overallRank: number | null;
  overallTotal: number | null;
  committeeRank: number | null;
  committeeTotal: number | null;
  previousOverallRank: number | null;
  components: ScoreComponent[];
}

export interface MemberAttendanceRecord {
  id: string;
  month: MonthKey;
  date: string;
  title: string;
  sessionType: SessionType;
  sessionMode?: SessionMode;
  status: AttendanceStatus;
  arrival?: ArrivalStatus;
  excuseReason?: string;
  bonusPoints?: number;
  bonusReason?: string;
  slideDeckUrl?: string | null;
  webConferencingUrl?: string | null;
  locationUrl?: string | null;
  locationAddress?: string | null;
  instructors?: string[];
}

export interface MemberUpcomingSession {
  id: string;
  title: string;
  committeeName: string;
  startsAt: string;
  checkinState: "scheduled" | "live" | "closed";
  sessionMode: SessionMode;
  slideDeckUrl: string | null;
  webConferencingUrl: string | null;
  locationUrl: string | null;
  locationAddress: string | null;
  instructors: string[];
}

export interface MemberTask {
  id: string;
  submissionId?: string;
  month: MonthKey;
  title: string;
  workType?: "assignment" | "task";
  completionMode?: "self_report" | "hr_only";
  assignedDate: string;
  dueDate: string;
  submittedDate?: string;
  completedDate?: string;
  status: MemberTaskStatus;
  /** 1 (small) to 5 (huge), null while ungraded. */
  effort: number | null;
  /** 1 to 5 quality rating once completed. */
  quality: number | null;
  onTime: boolean | null;
  /** Backend-provided task points. */
  taskPoints: number | null;
  maxPoints?: number;
  submissionUrl?: string | null;
  submissionText?: string | null;
  notes?: string;
}

export type ReviewType =
  | "recognition"
  | "performance_review"
  | "score_correction"
  | "excused_absence"
  | "warning"
  | "appeal"
  | "other";

export interface PublishedFeedback {
  id: string;
  month: MonthKey;
  publishedAt: string;
  authorRole: string;
  reviewType: ReviewType;
  message: string;
  decision?: string;
  pointsDelta?: number;
  visibility: "published";
}

export interface MemberAttendanceSummary {
  attendedCount: number;
  totalCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  summaryLabel: string;
}

export interface MemberTaskSummary {
  completedCount: number;
  totalCount: number;
  summaryLabel: string;
}

export interface MemberEngagementMetrics {
  attendanceStreak: number;
  livePoints: number;
  currentRank: number;
  pointsToNextRank: number | null;
  targetRank: number | null;
  activityTier: "Diamond" | "Gold" | "Silver" | "Bronze" | "Member";
  committeeCompletionRate: number;
}

export interface MemberDashboardData {
  profile: MemberProfile;
  currentMonthScore: MonthlyScoreRecord | null;
  monthlyHistory: MonthlyScoreRecord[];
  attendanceSummary: MemberAttendanceSummary;
  taskSummary: MemberTaskSummary;
  bonusesPoints: number;
  recentFeedback: PublishedFeedback[];
  engagement?: MemberEngagementMetrics;
}
