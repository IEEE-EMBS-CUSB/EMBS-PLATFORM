CREATE TYPE "public"."ledger_posting_scope" AS ENUM('committee', 'open');--> statement-breakpoint
-- Transaction-safe enum expansion (avoids PostgreSQL 55P04 when subsequent migration 0012 runs in Drizzle's single batch transaction)
CREATE TYPE "public"."ledger_source_type_v2" AS ENUM('attendance', 'task', 'assignment', 'event', 'manual_override');--> statement-breakpoint
ALTER TABLE "score_ledger" ALTER COLUMN "source_type" TYPE "public"."ledger_source_type_v2" USING ("source_type"::text::"public"."ledger_source_type_v2");--> statement-breakpoint
DROP TYPE "public"."ledger_source_type";--> statement-breakpoint
ALTER TYPE "public"."ledger_source_type_v2" RENAME TO "ledger_source_type";--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN "tracked_committee_id" uuid;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD COLUMN "posting_scope" "ledger_posting_scope" DEFAULT 'committee' NOT NULL;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD COLUMN "committee_id" uuid;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_tracked_committee_id_committees_id_fk" FOREIGN KEY ("tracked_committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_tracked_committee_id_idx" ON "roster_memberships" USING btree ("tracked_committee_id");--> statement-breakpoint
CREATE INDEX "score_ledger_scope_committee_idx" ON "score_ledger" USING btree ("season_id","posting_scope","committee_id");--> statement-breakpoint
-- Ensure every season with an hr_member has a Human Resources committee row before migrating home vs tracked committee
INSERT INTO "committees" ("season_id", "name", "slug", "category", "is_active")
SELECT DISTINCT rm."season_id", 'Human Resources', 'human-resources', 'non_technical'::"committee_category", true
FROM "roster_memberships" rm
WHERE rm."role" = 'hr_member'
	AND NOT EXISTS (
		SELECT 1 FROM "committees" c
		WHERE c."season_id" = rm."season_id" AND c."slug" = 'human-resources'
	)
ON CONFLICT ("season_id", "slug") DO NOTHING;--> statement-breakpoint
-- Move existing hr_member.committee_id -> tracked_committee_id and anchor hr_member.committee_id to Human Resources
UPDATE "roster_memberships" rm
SET
	"tracked_committee_id" = CASE
		WHEN rm."tracked_committee_id" IS NOT NULL THEN rm."tracked_committee_id"
		WHEN rm."committee_id" IS NOT NULL AND rm."committee_id" <> hr_comm."id" THEN rm."committee_id"
		ELSE NULL
	END,
	"committee_id" = hr_comm."id"
FROM "committees" hr_comm
WHERE rm."role" = 'hr_member'
	AND hr_comm."season_id" = rm."season_id"
	AND hr_comm."slug" = 'human-resources';--> statement-breakpoint
-- Backfill score_ledger posting_scope and committee_id from attendance sources
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN bs."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = bs."committee_id"
FROM "attendance_records" ar
INNER JOIN "branch_sessions" bs ON bs."id" = ar."session_id"
WHERE sl."source_type" = 'attendance'
	AND sl."source_id" = ar."id"::text;--> statement-breakpoint
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN bs."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = bs."committee_id"
FROM "branch_sessions" bs
WHERE sl."source_type" = 'attendance'
	AND sl."committee_id" IS NULL
	AND sl."source_id" = bs."id"::text;--> statement-breakpoint
-- Backfill score_ledger posting_scope and committee_id from task/assignment sources
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN t."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = t."committee_id"
FROM "task_submissions" ts
INNER JOIN "tasks" t ON t."id" = ts."task_id"
WHERE sl."source_type" = 'task'
	AND sl."source_id" = ts."id"::text;--> statement-breakpoint
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN t."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = t."committee_id"
FROM "tasks" t
WHERE sl."source_type" = 'task'
	AND sl."committee_id" IS NULL
	AND sl."source_id" = t."id"::text;--> statement-breakpoint
-- Backfill score_ledger posting_scope and committee_id from event sources
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN e."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = e."committee_id"
FROM "events" e
WHERE sl."source_type" = 'event'
	AND sl."source_id" = e."id"::text;--> statement-breakpoint
-- Backfill remaining rows (manual_override or unmatched legacy rows) from stamped membership's home committee
UPDATE "score_ledger" sl
SET
	"posting_scope" = CASE WHEN rm."committee_id" IS NULL THEN 'open'::"ledger_posting_scope" ELSE 'committee'::"ledger_posting_scope" END,
	"committee_id" = rm."committee_id"
FROM "roster_memberships" rm
WHERE sl."membership_id" = rm."id"
	AND sl."posting_scope" = 'committee'
	AND sl."committee_id" IS NULL;
