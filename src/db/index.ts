import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

let cachedDb: AppDatabase | null = null;
let cachedPgClient: ReturnType<typeof postgres> | null = null;

export function getDb(): AppDatabase {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required to connect to the database."
    );
  }

  // Detect whether to use Neon HTTP driver (stateless HTTPS for serverless)
  // or Postgres.js client (TCP wire protocol for local Docker / standard Postgres)
  const isNeon = connectionString.includes("neon.tech");

  if (isNeon) {
    const sql = neon(connectionString);
    cachedDb = drizzleNeon(sql, { schema });
  } else {
    if (!cachedPgClient) {
      cachedPgClient = postgres(connectionString, { max: 10 });
    }
    cachedDb = drizzlePostgres(cachedPgClient, { schema });
  }

  return cachedDb;
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

