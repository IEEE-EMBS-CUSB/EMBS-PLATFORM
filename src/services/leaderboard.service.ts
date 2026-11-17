import {
  findCommitteeBySlug,
  MOCK_COMMITTEES,
} from "@/data/mock/committees";
import { MOCK_LEADERBOARD_SNAPSHOTS } from "@/data/mock/leaderboards";
import type {
  Committee,
  CommitteeLeaderSpotlight,
  LeaderboardHistorySummary,
  MonthKey,
  MonthlyLeaderboard,
  PublishedMonthOption,
} from "@/types";

export const LEADERBOARD_TOP_LIMIT = 10;

function getPublishedSnapshots() {
  return MOCK_LEADERBOARD_SNAPSHOTS.filter(
    (snapshot) => snapshot.status === "published"
  ).sort((a, b) => b.month.localeCompare(a.month));
}

export async function getCommittees(): Promise<Committee[]> {
  return MOCK_COMMITTEES.map((committee) => ({ ...committee }));
}

export async function getPublishedMonths(): Promise<PublishedMonthOption[]> {
  return getPublishedSnapshots().map((snapshot) => ({
    month: snapshot.month,
    monthLabel: snapshot.monthLabel,
    publishedAt: snapshot.publishedAt,
  }));
}

export async function getOverallLeaderboard(
  month?: MonthKey
): Promise<MonthlyLeaderboard | null> {
  const published = getPublishedSnapshots();
  if (published.length === 0) return null;

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return null;

  return {
    month: target.month,
    monthLabel: target.monthLabel,
    status: target.status,
    publishedAt: target.publishedAt,
    scope: "overall",
    entries: target.entries
      .slice(0, LEADERBOARD_TOP_LIMIT)
      .map((entry, index) => ({
        rank: index + 1,
        previousRank: entry.previousRank,
        memberId: entry.memberId,
        memberName: entry.memberName,
        committeeSlug: entry.committeeSlug,
        committeeName: entry.committeeName,
        role: entry.role,
        monthlyScore: entry.monthlyScore,
      })),
  };
}

export async function getCommitteeLeaderboard(
  committeeSlug: string,
  month?: MonthKey
): Promise<MonthlyLeaderboard | null> {
  const committee = findCommitteeBySlug(committeeSlug);
  if (!committee) return null;

  const published = getPublishedSnapshots();
  if (published.length === 0) return null;

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return null;

  const committeeEntries = target.entries
    .filter((entry) => entry.committeeSlug === committee.slug)
    .slice(0, LEADERBOARD_TOP_LIMIT)
    .map((entry, index) => ({
      rank: index + 1,
      previousRank: entry.previousCommitteeRank,
      memberId: entry.memberId,
      memberName: entry.memberName,
      committeeSlug: entry.committeeSlug,
      committeeName: entry.committeeName,
      role: entry.role,
      monthlyScore: entry.monthlyScore,
    }));

  return {
    month: target.month,
    monthLabel: target.monthLabel,
    status: target.status,
    publishedAt: target.publishedAt,
    scope: "committee",
    committee: { ...committee },
    entries: committeeEntries,
  };
}

export async function getLeaderboardHistory(): Promise<
  LeaderboardHistorySummary[]
> {
  return getPublishedSnapshots().map((snapshot) => {
    const top = snapshot.entries[0] ?? null;
    const committeeSlugs = new Set(
      snapshot.entries.map((entry) => entry.committeeSlug)
    );

    return {
      month: snapshot.month,
      monthLabel: snapshot.monthLabel,
      publishedAt: snapshot.publishedAt,
      totalRankedMembers: snapshot.entries.length,
      topOverall: top
        ? {
            memberName: top.memberName,
            committeeName: top.committeeName,
            monthlyScore: top.monthlyScore,
          }
        : null,
      committeeCount: committeeSlugs.size,
    };
  });
}

export async function getCommitteeLeaders(
  month?: MonthKey
): Promise<CommitteeLeaderSpotlight[]> {
  const published = getPublishedSnapshots();
  if (published.length === 0) return [];

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return [];

  return MOCK_COMMITTEES.map((committee) => {
    const topEntry = target.entries.find(
      (entry) => entry.committeeSlug === committee.slug
    );
    return {
      committee: { ...committee },
      month: target.month,
      monthLabel: target.monthLabel,
      leader: topEntry
        ? {
            memberName: topEntry.memberName,
            role: topEntry.role,
            monthlyScore: topEntry.monthlyScore,
          }
        : null,
    };
  });
}
