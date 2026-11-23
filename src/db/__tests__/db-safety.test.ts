import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  assertSafeSeedDatabaseUrl,
  assertSafeTestDatabaseUrl,
  DEFAULT_LOCAL_TEST_DATABASE_URL,
  isLocalDatabaseUrl,
} from "@/db/db-safety";

describe("Database safety guards (test & seed isolation)", () => {
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    for (const id of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, id));
    }
  });

  it("recognizes local Postgres hostnames and rejects remote Neon URLs", () => {
    expect(
      isLocalDatabaseUrl("postgresql://postgres:pass@localhost:5432/embs_portal_test")
    ).toBe(true);
    expect(
      isLocalDatabaseUrl("postgresql://postgres:pass@127.0.0.1:5432/embs_portal_test")
    ).toBe(true);
    expect(
      isLocalDatabaseUrl(
        "postgresql://user:pass@ep-cool-branch-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe(false);
    expect(isLocalDatabaseUrl("not-a-valid-url")).toBe(false);
  });

  it("isolates Vitest onto local test DB even when .env.local sets DATABASE_URL to Neon", () => {
    const resolved = assertSafeTestDatabaseUrl({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://user:pass@ep-live-showcase-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require",
    });
    expect(resolved).toBe(DEFAULT_LOCAL_TEST_DATABASE_URL);
  });

  it("refuses remote TEST_DATABASE_URL unless ALLOW_REMOTE_TEST_DB=true", () => {
    const neonUrl =
      "postgresql://user:pass@ep-test-123.eu-central-1.aws.neon.tech/neondb?sslmode=require";

    expect(() =>
      assertSafeTestDatabaseUrl({
        NODE_ENV: "test",
        TEST_DATABASE_URL: neonUrl,
      })
    ).toThrow(/refusing to run tests against non-local database/i);

    expect(
      assertSafeTestDatabaseUrl({
        NODE_ENV: "test",
        TEST_DATABASE_URL: neonUrl,
        ALLOW_REMOTE_TEST_DB: "true",
      })
    ).toBe(neonUrl);
  });

  it("unconditionally blocks seeding in production and blocks remote DBs without explicit opt-in", () => {
    const localUrl = "postgresql://postgres:postgrespassword@localhost:5432/embs_portal";
    const neonUrl =
      "postgresql://user:pass@ep-live-123.eu-central-1.aws.neon.tech/neondb?sslmode=require";

    expect(() =>
      assertSafeSeedDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: localUrl,
        ALLOW_REMOTE_SEED: "true",
      })
    ).toThrow(/production/i);

    expect(() =>
      assertSafeSeedDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: neonUrl,
      })
    ).toThrow(/refusing to seed non-local database/i);

    expect(
      assertSafeSeedDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: localUrl,
      })
    ).toBe(localUrl);

    expect(
      assertSafeSeedDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: neonUrl,
        ALLOW_REMOTE_SEED: "true",
      })
    ).toBe(neonUrl);
  });

  it("preserves non-seeded real user passwords when seedDatabase() runs on local DB", async () => {
    const email = `non-seeded-real-user-${Date.now()}@cu.edu.eg`;
    const customPassword = "RealUserSecret#2026!";
    const originalHash = hashPassword(customPassword);

    const [created] = await db
      .insert(schema.persons)
      .values({
        email,
        fullName: "Real Unseeded User",
        passwordHash: originalHash,
        mustChangePassword: false,
        isActive: true,
      })
      .returning();
    createdPersonIds.push(created.id);

    await seedDatabase();

    const [afterSeed] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, created.id))
      .limit(1);

    expect(afterSeed.passwordHash).toBe(originalHash);
    expect(afterSeed.mustChangePassword).toBe(false);
    expect(verifyPassword(customPassword, afterSeed.passwordHash)).toBe(true);
    expect(verifyPassword("EMBS2026!", afterSeed.passwordHash)).toBe(false);
  });
});
