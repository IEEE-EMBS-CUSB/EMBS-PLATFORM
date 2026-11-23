import * as store from "@/db/store";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { normalizeSeasonSettings } from "@/lib/season-settings";
import {
  isCommitteeBoardEligibleRole,
  isHrMemberEligibleForCommittee,
} from "@/services/scoring.service";
import type {
  Committee,
  CommitteeLeaderSpotlight,
  LeaderboardEntry,
  LeaderboardHistorySummary,
  MonthKey,
  MonthlyLeaderboard,
  PublishedMonthOption,
} from "@/types";

export const LEADERBOARD_TOP_LIMIT = store.LEADERBOARD_TOP_LIMIT;

interface SnapshotEntryShape {
  rank?: number;
  previousRank?: number | null;
  previousCommitteeRank?: number | null;
  memberId: string;
  memberName: string;
  committeeSlug: string;
  committeeName: string;
  role: string;
  monthlyScore: number;
}

interface SnapshotJsonShape {
  monthLabel?: string;
  entries?: SnapshotEntryShape[];
  overallEntries?: SnapshotEntryShape[];
  committeeEntries?: Record<string, SnapshotEntryShape[]>;
}

/**
 * Extracts ranked entries for a single committee from a published snapshot,
 * keeping `member` and `hr_member` roles only (and restricting `hr_member`
 * strictly to the `human-resources` committee board).
 */
export function extractCommitteeEntriesFromSnapshot(
  json: SnapshotJsonShape,
  committeeSlug: string,
  topLimit?: number
): LeaderboardEntry[] {
  const hasCommitteeEntries = Array.isArray(
    json.committeeEntries?.[committeeSlug]
  );
  const rawCommEntries = hasCommitteeEntries
    ? json.committeeEntries![committeeSlug]
    : (json.entries ?? json.overallEntries ?? []).filter(
        (e) => e.committeeSlug === committeeSlug
      );

  const filtered = rawCommEntries.filter(
    (entry) =>
      isCommitteeBoardEligibleRole(entry.role) &&
      isHrMemberEligibleForCommittee(entry.role, committeeSlug)
  );
  const wasFiltered = filtered.length !== rawCommEntries.length;
  const limited =
    topLimit !== undefined ? filtered.slice(0, topLimit) : filtered;

  return limited.map((entry, index) => ({
    rank:
      hasCommitteeEntries && !wasFiltered
        ? (entry.rank ?? index + 1)
        : index + 1,
    previousRank: wasFiltered
      ? null
      : entry.previousCommitteeRank !== undefined
        ? entry.previousCommitteeRank
        : (entry.previousRank ?? null),
    memberId: entry.memberId,
    memberName: entry.memberName,
    committeeSlug: entry.committeeSlug,
    committeeName: entry.committeeName,
    role: entry.role,
    monthlyScore: entry.monthlyScore,
  }));
}

async function resolvePublicSeason(): Promise<{
  id: string;
  publicTopN: number;
} | null> {
  const [activeSeason] = await db
    .select({ id: schema.seasons.id, settingsJson: schema.seasons.settingsJson })
    .from(schema.seasons)
    .where(eq(schema.seasons.status, "active"))
    .limit(1);

  if (activeSeason) {
    return {
      id: activeSeason.id,
      publicTopN: normalizeSeasonSettings(activeSeason.settingsJson).leaderboard
        .publicTopN,
    };
  }

  // Fallback only to most recent archived season if no season is active
  const [archivedSeason] = await db
    .select({ id: schema.seasons.id, settingsJson: schema.seasons.settingsJson })
    .from(schema.seasons)
    .where(eq(schema.seasons.status, "archived"))
    .orderBy(desc(schema.seasons.startDate))
    .limit(1);

  if (!archivedSeason) return null;
  return {
    id: archivedSeason.id,
    publicTopN: normalizeSeasonSettings(archivedSeason.settingsJson).leaderboard
      .publicTopN,
  };
}

async function resolvePublicSeasonId(): Promise<string | null> {
  const s = await resolvePublicSeason();
  return s?.id ?? null;
}

export async function getCommittees(): Promise<Committee[]> {
  try {
    const seasonId = await resolvePublicSeasonId();
    if (!seasonId) return [];

    const rows = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.seasonId, seasonId),
          eq(schema.committees.isActive, true)
        )
      );

    if (rows.length > 0) {
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
    // Graceful fallback when DB is unreachable
  }
  return [];
}

export async function getPublishedMonths(): Promise<PublishedMonthOption[]> {
  try {
    const seasonId = await resolvePublicSeasonId();
    if (!seasonId) return [];

    const snapshots = await db
      .select({
        month: schema.monthlySnapshots.month,
        publishedAt: schema.monthlySnapshots.publishedAt,
        snapshotJson: schema.monthlySnapshots.snapshotJson,
      })
      .from(schema.monthlySnapshots)
      .where(
        and(
          eq(schema.monthlySnapshots.status, "published"),
          eq(schema.monthlySnapshots.seasonId, seasonId)
        )
      )
      .orderBy(desc(schema.monthlySnapshots.month));

    if (snapshots.length > 0) {
      return snapshots.map((s) => {
        const json = s.snapshotJson as SnapshotJsonShape;
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
  return [];
}

export async function getCommitteeLeaderboard(
  committeeSlug: string,
  month?: MonthKey
): Promise<MonthlyLeaderboard | null> {
  try {
    const comms = await getCommittees();
    const committee = comms.find((c) => c.slug === committeeSlug);
    if (!committee) return null;

    const season = await resolvePublicSeason();
    if (!season) return null;

    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(
        and(
          eq(schema.monthlySnapshots.status, "published"),
          eq(schema.monthlySnapshots.seasonId, season.id)
        )
      )
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      const target = month ? rows.find((r) => r.month === month) : rows[0];
      if (!target) return null;

      const json = target.snapshotJson as SnapshotJsonShape;
      const committeeEntries = extractCommitteeEntriesFromSnapshot(
        json,
        committee.slug,
        season.publicTopN
      );

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
  return null;
}

export async function getLeaderboardHistory(): Promise<
  LeaderboardHistorySummary[]
> {
  try {
    const seasonId = await resolvePublicSeasonId();
    if (!seasonId) return [];

    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(
        and(
          eq(schema.monthlySnapshots.status, "published"),
          eq(schema.monthlySnapshots.seasonId, seasonId)
        )
      )
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      return rows.map((snapshot) => {
        const json = snapshot.snapshotJson as SnapshotJsonShape;
        const committeeSlugs = new Set<string>();
        const distinctMemberIds = new Set<string>();

        if (json.committeeEntries) {
          for (const slug of Object.keys(json.committeeEntries)) {
            const entries = extractCommitteeEntriesFromSnapshot(json, slug);
            if (entries.length > 0) {
              committeeSlugs.add(slug);
              for (const entry of entries) {
                distinctMemberIds.add(entry.memberId);
              }
            }
          }
        } else {
          const fallbackEntries = (json.entries ?? json.overallEntries ?? []).filter(
            (e) =>
              isCommitteeBoardEligibleRole(e.role) &&
              isHrMemberEligibleForCommittee(e.role, e.committeeSlug)
          );
          for (const entry of fallbackEntries) {
            committeeSlugs.add(entry.committeeSlug);
            distinctMemberIds.add(entry.memberId);
          }
        }

        return {
          month: snapshot.month as MonthKey,
          monthLabel: json.monthLabel ?? snapshot.month,
          publishedAt: snapshot.publishedAt
            ? snapshot.publishedAt.toISOString().slice(0, 10)
            : "",
          totalRankedMembers: distinctMemberIds.size,
          committeeCount: committeeSlugs.size,
        };
      });
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getCommitteeLeaders(
  month?: MonthKey
): Promise<CommitteeLeaderSpotlight[]> {
  try {
    const comms = await getCommittees();
    const seasonId = await resolvePublicSeasonId();
    if (!seasonId) return [];

    const rows = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(
        and(
          eq(schema.monthlySnapshots.status, "published"),
          eq(schema.monthlySnapshots.seasonId, seasonId)
        )
      )
      .orderBy(desc(schema.monthlySnapshots.month));

    if (rows.length > 0) {
      const target = month ? rows.find((r) => r.month === month) : rows[0];
      if (!target) return [];

      const json = target.snapshotJson as SnapshotJsonShape;

      return comms.map((committee) => {
        const committeeEntries = extractCommitteeEntriesFromSnapshot(
          json,
          committee.slug,
          1
        );
        const topEntry = committeeEntries[0] ?? null;

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
  return [];
}
