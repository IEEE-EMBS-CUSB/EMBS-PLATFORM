ALTER TABLE "roster_memberships" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN "password_changed_at" timestamp with time zone;