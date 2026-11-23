import * as dotenv from "dotenv";
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

export interface MigrateOptions {
  connectionString?: string;
  migrationsFolder?: string;
}

/**
 * Applies Drizzle SQL migrations one transaction per migration file.
 *
 * Uses the exact `drizzle.__drizzle_migrations` schema and SHA-256 hashes as
 * `drizzle-kit migrate` so already-migrated databases stay 100% compatible,
 * while committing each migration individually so PostgreSQL enum additions
 * (`ALTER TYPE ... ADD VALUE` in 0001/0003) are committed before later
 * partial unique indexes reference those enum values on a fresh database.
 */
export async function runMigrations(options: MigrateOptions = {}): Promise<{
  appliedCount: number;
  skippedCount: number;
}> {
  const connectionString =
    options.connectionString ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED or DATABASE_URL must be set to run migrations."
    );
  }

  const migrationsFolder = options.migrationsFolder ?? "./drizzle";
  const migrations = readMigrationFiles({ migrationsFolder });

  const sql = postgres(connectionString, {
    max: 1,
    onnotice: () => {},
  });

  try {
    await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
    await sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    const existing = await sql<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at
      FROM "drizzle"."__drizzle_migrations"
      ORDER BY created_at DESC
    `;

    const appliedHashes = new Set(existing.map((r) => r.hash));
    const latestCreatedAt =
      existing.length > 0 ? Number(existing[0].created_at) : -Infinity;

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      if (
        appliedHashes.has(migration.hash) ||
        latestCreatedAt >= migration.folderMillis
      ) {
        skippedCount++;
        continue;
      }

      await sql.begin(async (tx) => {
        for (const stmt of migration.sql) {
          const trimmed = stmt.trim();
          if (trimmed.length === 0) continue;
          await tx.unsafe(trimmed);
        }
        await tx`
          INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
          VALUES (${migration.hash}, ${migration.folderMillis})
        `;
      });

      appliedCount++;
    }

    return { appliedCount, skippedCount };
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  dotenv.config({ path: ".env.local", quiet: true });
  dotenv.config({ quiet: true });

  runMigrations()
    .then(({ appliedCount, skippedCount }) => {
      console.log(
        `Migrations complete: ${appliedCount} applied, ${skippedCount} already up to date.`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
