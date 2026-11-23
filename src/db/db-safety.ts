const LOCAL_POSTGRES_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
]);

export const DEFAULT_LOCAL_TEST_DATABASE_URL =
  "postgresql://postgres:postgrespassword@localhost:5432/embs_portal_test";

/**
 * Returns true only when `rawUrl` parses cleanly and targets a local Postgres host.
 */
export function isLocalDatabaseUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return LOCAL_POSTGRES_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Resolves the database URL for automated Vitest runs.
 * Always prefers `TEST_DATABASE_URL` and defaults to the local Docker test database
 * so `.env.local` (which may point to a live Neon showcase/production branch) is never mutated.
 */
export function assertSafeTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.TEST_DATABASE_URL?.trim();
  const targetUrl =
    configured && configured.length > 0
      ? configured
      : DEFAULT_LOCAL_TEST_DATABASE_URL;

  if (!isLocalDatabaseUrl(targetUrl) && env.ALLOW_REMOTE_TEST_DB !== "true") {
    throw new Error(
      "Refusing to run tests against non-local database. Point TEST_DATABASE_URL to local Postgres or set ALLOW_REMOTE_TEST_DB=true explicitly."
    );
  }

  return targetUrl;
}

/**
 * Guards demo seeding (`src/db/seed.ts`) so it can never run in production
 * or accidentally overwrite a live remote database without explicit opt-in.
 */
export function assertSafeSeedDatabaseUrl(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run demo seed script in NODE_ENV=production. Use pnpm db:bootstrap for production initialization."
    );
  }

  const targetUrl = env.DATABASE_URL?.trim();
  if (!targetUrl) {
    throw new Error("DATABASE_URL must be configured to run the seed script.");
  }

  if (!isLocalDatabaseUrl(targetUrl) && env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error(
      "Refusing to seed non-local database. Run against local Docker Postgres or pass ALLOW_REMOTE_SEED=true explicitly for a disposable showcase branch."
    );
  }

  return targetUrl;
}
