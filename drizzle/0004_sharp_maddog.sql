CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"committee_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"event_date" timestamp with time zone NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branch_sessions" ADD COLUMN "checkin_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "branch_sessions" ADD COLUMN "checkin_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD COLUMN "submission_text" text;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD COLUMN "submission_url" text;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "target_group" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_roster_memberships_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."roster_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_season_id_idx" ON "events" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "events_committee_id_idx" ON "events" USING btree ("committee_id");