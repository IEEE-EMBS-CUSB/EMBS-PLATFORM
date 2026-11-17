import type { Committee, MonthKey } from "./common";

export type LeaderboardStatus = "draft" | "published";

/**
 * Public leaderboard entry. Deliberately excludes member identification numbers
 * (displayId) and authentication credentials.
 */
export interface LeaderboardEntry {
  rank: number;
  previousRank: number | null;
  memberId: string;
  memberName: string;
  committeeSlug: string;
  committeeName: string;
  role: string;
  monthlyScore: number;
}

export interface MonthlyLeaderboard {
  month: MonthKey;
  monthLabel: string;
  status: LeaderboardStatus;
  publishedAt: string;
  scope: "overall" | "committee";
  committee?: Committee;
  entries: LeaderboardEntry[];
}

export interface PublishedMonthOption {
  month: MonthKey;
  monthLabel: string;
  publishedAt: string;
}

export interface LeaderboardHistorySummary {
  month: MonthKey;
  monthLabel: string;
  publishedAt: string;
  totalRankedMembers: number;
  topOverall: Pick<
    LeaderboardEntry,
    "memberName" | "committeeName" | "monthlyScore"
  > | null;
  committeeCount: number;
}

export interface CommitteeLeaderSpotlight {
  committee: Committee;
  month: MonthKey;
  monthLabel: string;
  leader: Pick<LeaderboardEntry, "memberName" | "role" | "monthlyScore"> | null;
}
