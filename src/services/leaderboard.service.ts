import * as store from "@/db/store";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type {
  Committee,
  CommitteeLeaderSpotlight,
  LeaderboardHistorySummary,
  MonthKey,
  MonthlyLeaderboard,
  PublishedMonthOption,
} from "@/types";

export const LEADERBOARD_TOP_LIMIT = store.LEADERBOARD_TOP_LIMIT;

export async function getCommittees(): Promise<Committee[]> {
  try {
    const rows = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.isActive, true));

    if (rows.length > 0) {
      // Map stored committees, preserving descriptions and short names from store if available
      const storeCommittees = store.getCommittees();
      const storeMap = new Map(storeCommittees.map((c) => [c.slug, c]));

      return rows.map((c) => {
        const existing = storeMap.get(c.slug);
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          shortName: existing?.shortName ?? c.name,
          track: c.category as "technical" | "non_technical",
          description: existing?.description ?? "",
        };
      });
    }
  } catch {
    // Graceful fallback to static store
  }
  return store.getCommittees();
}

export async function getPublishedMonths(): Promise<PublishedMonthOption[]> {
  try {
    const snapshots = await db
      .select({
        month: schema.monthlySnapshots.month,
        publishedAt: schema.monthlySnapshots.publishedAt,
        snapshotJson: schema.monthlySnapshots.snapshotJson,
      })
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.status, "published"))
      .orderBy(desc(schema.monthlySnapshots.month));

    if (snapshots.length > 0) {
      return snapshots.map((s) => {
        const json = s.snapshotJson as { monthLabel?: string };
        return {
          month: s.month as MonthKey,
          monthLabel: json.monthLabel ?? s.month,
          publishedAt: s.publishedAt
            ? s.publishedAt.toISOString().slice(0, 10)
            : "",
        };
      });
    }
  } catch {
    // Graceful fallback
  }
  return store.getPublishedMonths();
}

export async function getOverallLeaderboard(
  month?: MonthKey
): Promise<MonthlyLeaderboard | null> {
  try {
    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.status, "published"))
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      const target = month ? rows.find((r) => r.month === month) : rows[0];
      if (!target) return null;

      const json = target.snapshotJson as {
        monthLabel?: string;
        entries: Array<{
          rank: number;
          previousRank: number | null;
          memberId: string;
          memberName: string;
          committeeSlug: string;
          committeeName: string;
          role: string;
          monthlyScore: number;
        }>;
      };

      return {
        month: target.month as MonthKey,
        monthLabel: json.monthLabel ?? target.month,
        status: target.status,
        publishedAt: target.publishedAt
          ? target.publishedAt.toISOString().slice(0, 10)
          : "",
        scope: "overall",
        entries: (json.entries ?? []).slice(0, LEADERBOARD_TOP_LIMIT),
      };
    }
  } catch {
    // Graceful fallback
  }
  return store.getOverallLeaderboard(month);
}

export async function getCommitteeLeaderboard(
  committeeSlug: string,
  month?: MonthKey
): Promise<MonthlyLeaderboard | null> {
  try {
    const comms = await getCommittees();
    const committee = comms.find((c) => c.slug === committeeSlug);
    if (!committee) return null;

    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.status, "published"))
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      const target = month ? rows.find((r) => r.month === month) : rows[0];
      if (!target) return null;

      const json = target.snapshotJson as {
        monthLabel?: string;
        entries: Array<{
          previousRank: number | null;
          previousCommitteeRank?: number | null;
          memberId: string;
          memberName: string;
          committeeSlug: string;
          committeeName: string;
          role: string;
          monthlyScore: number;
        }>;
      };

      const committeeEntries = (json.entries ?? [])
        .filter((entry) => entry.committeeSlug === committee.slug)
        .slice(0, LEADERBOARD_TOP_LIMIT)
        .map((entry, index) => ({
          rank: index + 1,
          previousRank:
            entry.previousCommitteeRank !== undefined
              ? entry.previousCommitteeRank
              : entry.previousRank,
          memberId: entry.memberId,
          memberName: entry.memberName,
          committeeSlug: entry.committeeSlug,
          committeeName: entry.committeeName,
          role: entry.role,
          monthlyScore: entry.monthlyScore,
        }));

      return {
        month: target.month as MonthKey,
        monthLabel: json.monthLabel ?? target.month,
        status: target.status,
        publishedAt: target.publishedAt
          ? target.publishedAt.toISOString().slice(0, 10)
          : "",
        scope: "committee",
        committee: { ...committee },
        entries: committeeEntries,
      };
    }
  } catch {
    // Graceful fallback
  }
  return store.getCommitteeLeaderboard(committeeSlug, month);
}

export async function getLeaderboardHistory(): Promise<
  LeaderboardHistorySummary[]
> {
  try {
    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.status, "published"))
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      return rows.map((snapshot) => {
        const json = snapshot.snapshotJson as {
          monthLabel?: string;
          entries: Array<{
            memberName: string;
            committeeName: string;
            committeeSlug: string;
            monthlyScore: number;
          }>;
        };

        const entries = json.entries ?? [];
        const top = entries[0] ?? null;
        const committeeSlugs = new Set(entries.map((e) => e.committeeSlug));

        return {
          month: snapshot.month as MonthKey,
          monthLabel: json.monthLabel ?? snapshot.month,
          publishedAt: snapshot.publishedAt
            ? snapshot.publishedAt.toISOString().slice(0, 10)
            : "",
          totalRankedMembers: entries.length,
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
  } catch {
    // Graceful fallback
  }
  return store.getLeaderboardHistory();
}

export async function getCommitteeLeaders(
  month?: MonthKey
): Promise<CommitteeLeaderSpotlight[]> {
  try {
    const comms = await getCommittees();
    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.status, "published"))
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      const target = month ? rows.find((r) => r.month === month) : rows[0];
      if (!target) return [];

      const json = target.snapshotJson as {
        monthLabel?: string;
        entries: Array<{
          committeeSlug: string;
          memberName: string;
          role: string;
          monthlyScore: number;
        }>;
      };

      const entries = json.entries ?? [];

      return comms.map((committee) => {
        const topEntry = entries.find(
          (entry) => entry.committeeSlug === committee.slug
        );
        return {
          committee: { ...committee },
          month: target.month as MonthKey,
          monthLabel: json.monthLabel ?? target.month,
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
  } catch {
    // Graceful fallback
  }
  return store.getCommitteeLeaders(month);
}

