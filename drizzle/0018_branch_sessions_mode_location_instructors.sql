-- Forward-only migration: add online/offline session_mode, offline location fields
-- (location_url, location_address) on branch_sessions, and season-scoped
-- branch_session_instructors join table.

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "session_mode" text DEFAULT 'offline' NOT NULL;
--> statement-breakpoint

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "location_url" text;
--> statement-breakpoint

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "location_address" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "branch_session_instructors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL REFERENCES "seasons"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "branch_sessions"("id") ON DELETE CASCADE,
  "membership_id" uuid NOT NULL REFERENCES "roster_memberships"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "branch_session_instructors_session_member_idx"
  ON "branch_session_instructors" ("session_id", "membership_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branch_session_instructors_season_id_idx"
  ON "branch_session_instructors" ("season_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branch_session_instructors_session_id_idx"
  ON "branch_session_instructors" ("session_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branch_session_instructors_membership_id_idx"
  ON "branch_session_instructors" ("membership_id");
