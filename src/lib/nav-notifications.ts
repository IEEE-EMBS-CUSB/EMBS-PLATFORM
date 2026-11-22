export type NavBadgeTone = "purple" | "red" | "amber" | "green";

export interface NavNotificationBadge {
  /** Actionable item count (e.g., assignments due, submissions to grade, months to publish). */
  count: number;
  /** Visual urgency tone. */
  tone?: NavBadgeTone;
  /**
   * Optional ISO timestamps of recent items (last 30 days) for non-DB-tracked
   * seen state (e.g., feedback). When provided alongside `seenKey`, client-side
   * localStorage filters out items at or before the user's last-seen timestamp.
   */
  recentItemDates?: string[];
  /** Optional ISO timestamps of recent official warnings (promotes tone to red if unseen). */
  recentWarningDates?: string[];
  /** localStorage key suffix used to track when the user last visited this route. */
  seenKey?: string;
  /** Optional tooltip / aria description. */
  label?: string;
}

export type NavBadgeMap = Record<string, NavNotificationBadge>;

export interface ResolvedNavBadge {
  count: number;
  tone: NavBadgeTone;
  label?: string;
}

const SEEN_STORAGE_PREFIX = "embs:nav-seen:";
const DEFAULT_MAX_AGE_DAYS = 30;

const TONE_PRIORITY: Record<NavBadgeTone, number> = {
  red: 4,
  amber: 3,
  purple: 2,
  green: 1,
};

export function getSeenStorageKey(seenKey: string): string {
  return `${SEEN_STORAGE_PREFIX}${seenKey}`;
}

export function formatBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(Math.max(0, Math.floor(count)));
}

/**
 * Counts timestamps that are:
 *  1) younger than `maxAgeDays` (default 30 days), AND
 *  2) strictly newer than `seenAtIso` (if the user has previously marked seen).
 */
export function countUnseenRecentItems(
  itemDates: readonly string[],
  seenAtIso: string | null,
  now: Date = new Date(),
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS
): number {
  if (itemDates.length === 0) return 0;

  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  const seenMs = seenAtIso ? new Date(seenAtIso).getTime() : NaN;
  const hasValidSeen = Number.isFinite(seenMs);

  let count = 0;
  for (const iso of itemDates) {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < cutoffMs) continue;
    if (hasValidSeen && ts <= seenMs) continue;
    count += 1;
  }
  return count;
}

export function resolveNavBadge(
  badge: NavNotificationBadge | undefined,
  seenAtIso: string | null,
  now: Date = new Date()
): ResolvedNavBadge | null {
  if (!badge) return null;

  if (badge.recentItemDates && badge.seenKey) {
    const unseenCount = countUnseenRecentItems(
      badge.recentItemDates,
      seenAtIso,
      now
    );
    if (unseenCount <= 0) return null;

    const unseenWarnings = badge.recentWarningDates
      ? countUnseenRecentItems(badge.recentWarningDates, seenAtIso, now)
      : 0;

    return {
      count: unseenCount,
      tone: unseenWarnings > 0 ? "red" : (badge.tone ?? "purple"),
      label: badge.label,
    };
  }

  if (badge.count <= 0) return null;
  return {
    count: badge.count,
    tone: badge.tone ?? "purple",
    label: badge.label,
  };
}

export function aggregateOverflowBadge(
  badges: ReadonlyArray<ResolvedNavBadge | null | undefined>
): ResolvedNavBadge | null {
  let total = 0;
  let topTone: NavBadgeTone = "green";

  for (const b of badges) {
    if (!b || b.count <= 0) continue;
    total += b.count;
    if (TONE_PRIORITY[b.tone] > TONE_PRIORITY[topTone]) {
      topTone = b.tone;
    }
  }

  if (total <= 0) return null;
  return { count: total, tone: topTone };
}
