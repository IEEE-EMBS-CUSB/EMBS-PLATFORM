import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

export interface RateLimitPolicy {
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
}

export const RATE_LIMIT_POLICIES = {
  loginEmail: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    lockoutSeconds: 15 * 60,
  },
  loginIp: {
    maxAttempts: 20,
    windowSeconds: 15 * 60,
    lockoutSeconds: 15 * 60,
  },
  checkinPerson: {
    maxAttempts: 8,
    windowSeconds: 10 * 60,
    lockoutSeconds: 10 * 60,
  },
  checkinIp: {
    maxAttempts: 25,
    windowSeconds: 10 * 60,
    lockoutSeconds: 10 * 60,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export function extractClientIp(
  getHeader: (name: string) => string | null | undefined
): string {
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && first.length <= 64) {
      return first;
    }
  }
  const realIp = getHeader("x-real-ip")?.trim();
  if (realIp && realIp.length <= 64) {
    return realIp;
  }
  return "unknown";
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now: Date = new Date()
): Promise<RateLimitCheckResult> {
  try {
    const [row] = await db
      .select()
      .from(schema.authRateLimits)
      .where(eq(schema.authRateLimits.key, key))
      .limit(1);

    if (!row) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (row.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }

    const windowEndMs = row.windowStartedAt.getTime() + policy.windowSeconds * 1000;
    if (windowEndMs > now.getTime() && row.attempts >= policy.maxAttempts) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowEndMs - now.getTime()) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    // Fail open only if rate-limit storage itself is temporarily unreachable,
    // logging for visibility without locking out legitimate users during DB hiccups.
    console.error("[rate-limit] checkRateLimit error:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function recordRateLimitFailure(
  key: string,
  policy: RateLimitPolicy,
  now: Date = new Date()
): Promise<void> {
  const windowCutoffIso = new Date(
    now.getTime() - policy.windowSeconds * 1000
  ).toISOString();
  const nowIso = now.toISOString();
  const lockoutExpiry = new Date(now.getTime() + policy.lockoutSeconds * 1000);
  const lockoutExpiryIso = lockoutExpiry.toISOString();

  try {
    await db
      .insert(schema.authRateLimits)
      .values({
        key,
        attempts: 1,
        windowStartedAt: now,
        lockedUntil: policy.maxAttempts <= 1 ? lockoutExpiry : null,
      })
      .onConflictDoUpdate({
        target: schema.authRateLimits.key,
        set: {
          attempts: sql`CASE
            WHEN ${schema.authRateLimits.windowStartedAt} < ${windowCutoffIso}::timestamptz
              OR (${schema.authRateLimits.lockedUntil} IS NOT NULL AND ${schema.authRateLimits.lockedUntil} <= ${nowIso}::timestamptz)
            THEN 1
            ELSE ${schema.authRateLimits.attempts} + 1
          END`,
          windowStartedAt: sql`CASE
            WHEN ${schema.authRateLimits.windowStartedAt} < ${windowCutoffIso}::timestamptz
              OR (${schema.authRateLimits.lockedUntil} IS NOT NULL AND ${schema.authRateLimits.lockedUntil} <= ${nowIso}::timestamptz)
            THEN ${nowIso}::timestamptz
            ELSE ${schema.authRateLimits.windowStartedAt}
          END`,
          lockedUntil: sql`CASE
            WHEN (
              CASE
                WHEN ${schema.authRateLimits.windowStartedAt} < ${windowCutoffIso}::timestamptz
                  OR (${schema.authRateLimits.lockedUntil} IS NOT NULL AND ${schema.authRateLimits.lockedUntil} <= ${nowIso}::timestamptz)
                THEN 1
                ELSE ${schema.authRateLimits.attempts} + 1
              END
            ) >= ${policy.maxAttempts}
            THEN ${lockoutExpiryIso}::timestamptz
            ELSE NULL
          END`,
        },
      });
  } catch (err) {
    console.error("[rate-limit] recordRateLimitFailure error:", err);
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await db
      .delete(schema.authRateLimits)
      .where(eq(schema.authRateLimits.key, key));
  } catch (err) {
    console.error("[rate-limit] clearRateLimit error:", err);
  }
}

export function formatRateLimitMessage(
  retryAfterSeconds: number,
  actionLabel: string
): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many failed ${actionLabel} attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
}
