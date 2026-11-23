import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

let cachedDb: AppDatabase | null = null;
let cachedPgClient: ReturnType<typeof postgres> | null = null;
let cachedNeonPool: Pool | null = null;

export function getDb(): AppDatabase {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required to connect to the database."
    );
  }

  // Use Neon serverless WebSocket Pool for Neon URLs so interactive SQL transactions
  // (`db.transaction`) work atomically in serverless/edge runtimes as well as Node 22+,
  // and Postgres.js over TCP for local Docker / standard PostgreSQL.
  const isNeon = connectionString.includes("neon.tech");

  if (isNeon) {
    if (!cachedNeonPool) {
      cachedNeonPool = new Pool({ connectionString });
    }
    cachedDb = drizzleNeon({ client: cachedNeonPool, schema });
  } else {
    if (!cachedPgClient) {
      cachedPgClient = postgres(connectionString, { max: 10 });
    }
    cachedDb = drizzlePostgres(cachedPgClient, { schema });
  }

  return cachedDb;
}

/**
 * Executes `fn` inside a real PostgreSQL `BEGIN ... COMMIT` transaction
 * (rolling back all writes on any thrown error) across both Neon WebSocket Pool
 * and local Postgres.js clients.
 */
export async function withTransaction<T>(
  fn: (tx: AppDatabase) => Promise<T>
): Promise<T> {
  const instance = getDb();
  // Both NeonDatabase and PostgresJsDatabase implement identical `.transaction(tx => ...)`
  // whose `tx` exposes the full Drizzle PgDatabase query builder API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (instance as any).transaction(async (tx: AppDatabase) => fn(tx));
}

/**
 * Default lazy database instance proxy.
 * Safe to import across Server Actions, API routes, and Server Components.
 */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const instance = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (instance as any)[prop];
  },
});
