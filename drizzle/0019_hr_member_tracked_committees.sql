-- Forward-only migration: add season-scoped hr_member_tracked_committees join table
-- so a single hr_member membership can track multiple committees while keeping
-- one home Human Resources membership row in roster_memberships.

CREATE TABLE IF NOT EXISTS "hr_member_tracked_committees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL REFERENCES "seasons"("id") ON DELETE CASCADE,
  "membership_id" uuid NOT NULL REFERENCES "roster_memberships"("id") ON DELETE CASCADE,
  "committee_id" uuid NOT NULL REFERENCES "committees"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "hr_tracked_committees_membership_committee_uniq"
  ON "hr_member_tracked_committees" ("membership_id", "committee_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hr_tracked_committees_season_id_idx"
  ON "hr_member_tracked_committees" ("season_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hr_tracked_committees_membership_id_idx"
  ON "hr_member_tracked_committees" ("membership_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hr_tracked_committees_committee_id_idx"
  ON "hr_member_tracked_committees" ("committee_id");
--> statement-breakpoint

INSERT INTO "hr_member_tracked_committees" ("season_id", "membership_id", "committee_id")
SELECT "season_id", "id", "tracked_committee_id"
FROM "roster_memberships"
WHERE "role" = 'hr_member' AND "tracked_committee_id" IS NOT NULL
ON CONFLICT ("membership_id", "committee_id") DO NOTHING;
