CREATE TABLE "committee_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "committees" ADD COLUMN "track_id" uuid;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN "managed_track_id" uuid;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "settings_json" jsonb DEFAULT '{"attendance":{"defaultBasePoints":10,"defaultPunctualityBonus":5,"punctualityCutoffMinutes":15,"defaultCheckinWindowMinutes":30,"qrRotationSeconds":60},"grading":{"effortWeight":10,"qualityWeight":8,"timelinessWeight":2,"defaultMaxPoints":100},"leaderboard":{"publicTopN":10,"tierThresholds":{"bronze":50,"silver":150,"gold":300,"diamond":500}}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "committee_tracks" ADD CONSTRAINT "committee_tracks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "committee_tracks_season_slug_idx" ON "committee_tracks" USING btree ("season_id","slug");--> statement-breakpoint
CREATE INDEX "committee_tracks_season_id_idx" ON "committee_tracks" USING btree ("season_id");--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_track_id_committee_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."committee_tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_managed_track_id_committee_tracks_id_fk" FOREIGN KEY ("managed_track_id") REFERENCES "public"."committee_tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "committees_track_id_idx" ON "committees" USING btree ("track_id");