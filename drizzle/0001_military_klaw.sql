ALTER TYPE "public"."membership_role" ADD VALUE 'master_admin' BEFORE 'hr_admin';--> statement-breakpoint
ALTER TYPE "public"."membership_role" ADD VALUE 'hr_member' BEFORE 'committee_head';