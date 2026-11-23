import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  checkRateLimit,
  clearRateLimit,
  extractClientIp,
  recordRateLimitFailure,
  type RateLimitPolicy,
} from "@/lib/rate-limit";

describe("Postgres-backed brute-force rate limiter", () => {
  const createdKeys: string[] = [];

  afterEach(async () => {
    for (const key of createdKeys.splice(0)) {
      await db
        .delete(schema.authRateLimits)
        .where(eq(schema.authRateLimits.key, key));
    }
  });

  it("extracts leftmost client IP from x-forwarded-for or x-real-ip", () => {
    expect(
      extractClientIp((name) =>
        name === "x-forwarded-for" ? "203.0.113.42, 10.0.0.1" : null
      )
    ).toBe("203.0.113.42");
    expect(
      extractClientIp((name) => (name === "x-real-ip" ? "198.51.100.7" : null))
    ).toBe("198.51.100.7");
    expect(extractClientIp(() => null)).toBe("unknown");
  });

  it("locks out after maxAttempts failures in Postgres, clears on success, and resets after window expiry", async () => {
    const key = `test:login:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    createdKeys.push(key);

    const policy: RateLimitPolicy = {
      maxAttempts: 3,
      windowSeconds: 60,
      lockoutSeconds: 120,
    };

    const t0 = new Date("2026-11-24T10:00:00Z");

    expect((await checkRateLimit(key, policy, t0)).allowed).toBe(true);

    // Failures 1 and 2 remain allowed
    await recordRateLimitFailure(key, policy, t0);
    expect((await checkRateLimit(key, policy, t0)).allowed).toBe(true);

    await recordRateLimitFailure(key, policy, t0);
    expect((await checkRateLimit(key, policy, t0)).allowed).toBe(true);

    // Failure 3 triggers lockout
    await recordRateLimitFailure(key, policy, t0);
    const locked = await checkRateLimit(key, policy, new Date("2026-11-24T10:00:30Z"));
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSeconds).toBeGreaterThanOrEqual(85);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(95);

    // After lockout expires, access is allowed again
    const afterLockout = await checkRateLimit(
      key,
      policy,
      new Date("2026-11-24T10:03:00Z")
    );
    expect(afterLockout.allowed).toBe(true);

    // Clear removes the bucket completely
    await clearRateLimit(key);
    const rows = await db
      .select()
      .from(schema.authRateLimits)
      .where(eq(schema.authRateLimits.key, key));
    expect(rows).toHaveLength(0);
  });
});
