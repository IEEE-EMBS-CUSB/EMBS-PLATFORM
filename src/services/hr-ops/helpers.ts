import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";

export interface HrActor {
  profile: {
    id: string;
    role: MembershipRole;
    committeeId: string | null;
    managedTrackId?: string | null;
    email?: string;
    fullName?: string;
  };
}

/**
 * Returns the set of committee IDs overseen by a Track Director (`director` with `managedTrackId`).
 * Returns `null` when the actor is not track-scoped (e.g. chapter-wide Executive Director).
 */
export async function getDirectorTrackCommitteeIds(
  seasonId: string,
  role: MembershipRole,
  managedTrackId?: string | null
): Promise<Set<string> | null> {
  if (role !== "director" || !managedTrackId) {
    return null;
  }

  const rows = await db
    .select({ id: schema.committees.id })
    .from(schema.committees)
    .where(
      and(
        eq(schema.committees.seasonId, seasonId),
        eq(schema.committees.trackId, managedTrackId),
        eq(schema.committees.isActive, true)
      )
    );

  return new Set(rows.map((r) => r.id));
}

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(month: string): boolean {
  return MONTH_KEY_REGEX.test(month.trim());
}

/**
 * Formats a Date into YYYY-MM in the Cairo University chapter timezone (Africa/Cairo)
 * so late-night sessions/events do not drift across month boundaries due to UTC offset.
 */
export function formatMonthInCairo(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? String(date.getUTCFullYear());
  const month =
    parts.find((p) => p.type === "month")?.value ??
    String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function isValidDateString(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const ts = Date.parse(raw);
  return !Number.isNaN(ts);
}

/**
 * Resolves the active season (when seasonId is omitted) or validates that a provided seasonId
 * exists and is currently active. Archived and draft seasons are rejected.
 */
export async function resolveActiveSeason(
  seasonId?: string
): Promise<{ ok: true; season: typeof schema.seasons.$inferSelect } | { ok: false; error: string }> {
  if (seasonId) {
    const [season] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1);
    if (!season) {
      return { ok: false, error: "Season not found." };
    }
    if (season.status === "archived") {
      return { ok: false, error: "Archived seasons are read-only and cannot be modified." };
    }
    if (season.status !== "active") {
      return { ok: false, error: "Only the active season accepts operational changes." };
    }
    return { ok: true, season };
  }

  const [activeSeason] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.status, "active"))
    .limit(1);

  if (!activeSeason) {
    return { ok: false, error: "No active season found." };
  }
  return { ok: true, season: activeSeason };
}

/**
 * Validates that a season is not archived (allows active or draft seasons for setup operations).
 */
export async function resolveMutableSeason(
  seasonId?: string
): Promise<{ ok: true; season: typeof schema.seasons.$inferSelect } | { ok: false; error: string }> {
  if (!seasonId) {
    return resolveActiveSeason();
  }
  const [season] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);

  if (!season) {
    return { ok: false, error: "Season not found." };
  }
  if (season.status === "archived") {
    return { ok: false, error: "Archived seasons are read-only and cannot be modified." };
  }
  return { ok: true, season };
}

/**
 * Ensures a month's score ledger is not modified after its leaderboard snapshot has been published.
 */
export async function assertMonthNotPublished(
  seasonId: string,
  month: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [published] = await db
    .select({ id: schema.monthlySnapshots.id })
    .from(schema.monthlySnapshots)
    .where(
      and(
        eq(schema.monthlySnapshots.seasonId, seasonId),
        eq(schema.monthlySnapshots.month, month),
        eq(schema.monthlySnapshots.status, "published")
      )
    )
    .limit(1);

  if (published) {
    return {
      ok: false,
      error: `Month ${month} has already been published and frozen. Ledger points cannot be altered.`,
    };
  }
  return { ok: true };
}

export function getPostgresErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause.code === "string") return e.cause.code;
  return undefined;
}

/**
 * Maps database errors to safe, user-facing messages without leaking SQL or schema details.
 */
export function sanitizeDbError(err: unknown, fallback: string): string {
  const code = getPostgresErrorCode(err);
  if (code === "23505") {
    return "A record with these details already exists.";
  }
  if (code === "23503") {
    return "Referenced record was not found or is no longer active.";
  }
  if (code === "22P02") {
    return "Invalid identifier or input format.";
  }
  return fallback;
}
