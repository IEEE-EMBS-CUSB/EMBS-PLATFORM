CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"password_changed_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "persons_email_idx" ON "persons" USING btree ("email");--> statement-breakpoint
CREATE INDEX "persons_is_active_idx" ON "persons" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN "person_id" uuid;--> statement-breakpoint
INSERT INTO "persons" (
	"email",
	"full_name",
	"password_hash",
	"must_change_password",
	"password_changed_at",
	"is_active",
	"created_at",
	"updated_at"
)
SELECT DISTINCT ON (lower(btrim(rm."email")))
	lower(btrim(rm."email")) AS "email",
	btrim(rm."full_name") AS "full_name",
	rm."password_hash",
	rm."must_change_password",
	rm."password_changed_at",
	true AS "is_active",
	rm."created_at",
	now() AS "updated_at"
FROM "roster_memberships" rm
INNER JOIN "seasons" s ON s."id" = rm."season_id"
WHERE rm."email" IS NOT NULL AND btrim(rm."email") <> ''
ORDER BY
	lower(btrim(rm."email")),
	CASE WHEN s."status" = 'active' THEN 0 ELSE 1 END ASC,
	rm."password_changed_at" DESC NULLS LAST,
	rm."must_change_password" ASC,
	s."start_date" DESC,
	rm."created_at" DESC
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint
UPDATE "roster_memberships" rm
SET "person_id" = p."id"
FROM "persons" p
WHERE rm."person_id" IS NULL
	AND lower(btrim(rm."email")) = p."email";--> statement-breakpoint
ALTER TABLE "roster_memberships" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "roster_season_email_idx";--> statement-breakpoint
DROP INDEX "roster_email_idx";--> statement-breakpoint
ALTER TABLE "roster_memberships" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_memberships" ALTER COLUMN "full_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_person_id_idx" ON "roster_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_global_role_uniq" ON "roster_memberships" USING btree ("season_id","person_id","role") WHERE "roster_memberships"."role" IN ('master_admin', 'hr_admin');--> statement-breakpoint
CREATE UNIQUE INDEX "roster_director_global_uniq" ON "roster_memberships" USING btree ("season_id","person_id") WHERE "roster_memberships"."role" = 'director' AND "roster_memberships"."managed_track_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roster_director_track_uniq" ON "roster_memberships" USING btree ("season_id","person_id","managed_track_id") WHERE "roster_memberships"."role" = 'director' AND "roster_memberships"."managed_track_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roster_committee_role_uniq" ON "roster_memberships" USING btree ("season_id","person_id","role","committee_id") WHERE "roster_memberships"."role" IN ('committee_head', 'hr_member', 'member', 'attendee') AND "roster_memberships"."committee_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roster_unassigned_role_uniq" ON "roster_memberships" USING btree ("season_id","person_id","role") WHERE "roster_memberships"."role" IN ('committee_head', 'hr_member', 'member', 'attendee') AND "roster_memberships"."committee_id" IS NULL;
