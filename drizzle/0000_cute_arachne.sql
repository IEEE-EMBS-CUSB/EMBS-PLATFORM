CREATE TYPE "public"."committee_category" AS ENUM('technical', 'non_technical');--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('attendance', 'task', 'event', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('hr_admin', 'committee_head', 'member', 'attendee');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."snapshot_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_punctual" boolean DEFAULT true NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"override_reason" text
);
--> statement-breakpoint
CREATE TABLE "branch_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"committee_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"checkin_code" text,
	"checkin_expires_at" timestamp with time zone,
	"checkin_open" boolean DEFAULT false NOT NULL,
	"punctuality_cutoff_minutes" integer DEFAULT 15 NOT NULL,
	"base_points" integer DEFAULT 10 NOT NULL,
	"punctuality_bonus" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" "committee_category" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_warning" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" "snapshot_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"committee_id" uuid,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"month" text NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" text,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"max_points" integer NOT NULL,
	"weight" numeric(5, 2) DEFAULT '1.0' NOT NULL,
	"leaders_only" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "season_status" DEFAULT 'draft' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "task_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"effort_score" integer,
	"quality_score" integer,
	"timeliness_score" integer,
	"total_points" integer,
	"notes" text,
	"graded_by" uuid,
	"graded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"committee_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_at" timestamp with time zone NOT NULL,
	"max_points" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_branch_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."branch_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_sessions" ADD CONSTRAINT "branch_sessions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_sessions" ADD CONSTRAINT "branch_sessions_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_feedback" ADD CONSTRAINT "hr_feedback_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_feedback" ADD CONSTRAINT "hr_feedback_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_feedback" ADD CONSTRAINT "hr_feedback_created_by_roster_memberships_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD CONSTRAINT "monthly_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD CONSTRAINT "monthly_snapshots_published_by_roster_memberships_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."roster_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_created_by_roster_memberships_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."roster_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_rubrics" ADD CONSTRAINT "scoring_rubrics_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_graded_by_roster_memberships_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."roster_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_member_idx" ON "attendance_records" USING btree ("session_id","membership_id");--> statement-breakpoint
CREATE INDEX "attendance_membership_id_idx" ON "attendance_records" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "attendance_session_id_idx" ON "attendance_records" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "branch_sessions_season_id_idx" ON "branch_sessions" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "branch_sessions_committee_id_idx" ON "branch_sessions" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "branch_sessions_starts_at_idx" ON "branch_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "committees_season_slug_idx" ON "committees" USING btree ("season_id","slug");--> statement-breakpoint
CREATE INDEX "committees_season_id_idx" ON "committees" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "hr_feedback_membership_id_idx" ON "hr_feedback" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "hr_feedback_season_id_idx" ON "hr_feedback" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "hr_feedback_published_idx" ON "hr_feedback" USING btree ("is_published","is_warning");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshots_season_month_idx" ON "monthly_snapshots" USING btree ("season_id","month");--> statement-breakpoint
CREATE INDEX "monthly_snapshots_status_idx" ON "monthly_snapshots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_season_email_idx" ON "roster_memberships" USING btree ("season_id","email");--> statement-breakpoint
CREATE INDEX "roster_season_id_idx" ON "roster_memberships" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "roster_email_idx" ON "roster_memberships" USING btree ("email");--> statement-breakpoint
CREATE INDEX "roster_committee_id_idx" ON "roster_memberships" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "roster_role_idx" ON "roster_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "score_ledger_season_month_idx" ON "score_ledger" USING btree ("season_id","month");--> statement-breakpoint
CREATE INDEX "score_ledger_membership_id_idx" ON "score_ledger" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "score_ledger_source_idx" ON "score_ledger" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "score_ledger_source_unique_idx" ON "score_ledger" USING btree ("membership_id","source_type","source_id") WHERE "score_ledger"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "scoring_rubrics_season_id_idx" ON "scoring_rubrics" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_rubrics_season_name_idx" ON "scoring_rubrics" USING btree ("season_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_name_idx" ON "seasons" USING btree ("name");--> statement-breakpoint
CREATE INDEX "seasons_status_idx" ON "seasons" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "task_submissions_task_member_idx" ON "task_submissions" USING btree ("task_id","membership_id");--> statement-breakpoint
CREATE INDEX "task_submissions_membership_id_idx" ON "task_submissions" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "task_submissions_task_id_idx" ON "task_submissions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_season_id_idx" ON "tasks" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "tasks_committee_id_idx" ON "tasks" USING btree ("committee_id");