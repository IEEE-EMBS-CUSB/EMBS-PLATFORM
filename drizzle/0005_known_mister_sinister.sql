CREATE TABLE "member_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"month" text NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"role" text NOT NULL,
	"summary" text NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasonal_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"season_label" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"evaluator_role" text NOT NULL,
	"final_score" integer,
	"out_of" integer DEFAULT 100 NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"grade" text,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_activities" ADD CONSTRAINT "member_activities_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_activities" ADD CONSTRAINT "member_activities_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonal_evaluations" ADD CONSTRAINT "seasonal_evaluations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonal_evaluations" ADD CONSTRAINT "seasonal_evaluations_membership_id_roster_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."roster_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_activities_membership_id_idx" ON "member_activities" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "member_activities_season_id_idx" ON "member_activities" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "seasonal_evaluations_membership_id_idx" ON "seasonal_evaluations" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "seasonal_evaluations_season_id_idx" ON "seasonal_evaluations" USING btree ("season_id");