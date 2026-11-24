-- Forward-only migration: consolidate branch_sessions check-in expiration onto
-- canonical checkin_ends_at, add punctuality_starts_at for delayed re-opens,
-- and add status_updated_at on attendance_records to record exact status change timestamps.

UPDATE "branch_sessions"
SET "checkin_ends_at" = "checkin_expires_at"
WHERE "checkin_ends_at" IS NULL AND "checkin_expires_at" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "branch_sessions"
  DROP COLUMN IF EXISTS "checkin_expires_at";
--> statement-breakpoint

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "punctuality_starts_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "status_updated_at" timestamp with time zone;
--> statement-breakpoint

UPDATE "attendance_records"
SET "status_updated_at" = "checked_in_at"
WHERE "status_updated_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "attendance_records"
  ALTER COLUMN "status_updated_at" SET DEFAULT now(),
  ALTER COLUMN "status_updated_at" SET NOT NULL;
