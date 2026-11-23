-- Forward-only migration: PostgreSQL-backed rate limiting table for brute-force
-- protection on login, first-login password setup, and live session check-in codes.

CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_until" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "auth_rate_limits_locked_until_idx"
  ON "auth_rate_limits" USING btree ("locked_until");
