-- Forward-only migration: release polish columns for attendance status,
-- task self-report vs hr-only completion mode + creator tracking,
-- and feedback category + optional bonus/deduction points delta.

ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'present' NOT NULL;
--> statement-breakpoint

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "completion_mode" text DEFAULT 'self_report' NOT NULL;
--> statement-breakpoint

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_created_by_roster_memberships_id_fk'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_created_by_roster_memberships_id_fk"
      FOREIGN KEY ("created_by")
      REFERENCES "public"."roster_memberships"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "hr_feedback"
  ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'recognition' NOT NULL;
--> statement-breakpoint

ALTER TABLE "hr_feedback"
  ADD COLUMN IF NOT EXISTS "points_delta" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Preserve all existing unpublished notes and legacy private warnings as hidden internal_note
UPDATE "hr_feedback"
SET "category" = 'internal_note'
WHERE "is_published" = false;
