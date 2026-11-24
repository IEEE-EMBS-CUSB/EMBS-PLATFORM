-- Forward-only migration: add nullable slide_deck_url and web_conferencing_url
-- to branch_sessions so session materials and meeting links appear in HR and member views.

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "slide_deck_url" text;
--> statement-breakpoint

ALTER TABLE "branch_sessions"
  ADD COLUMN IF NOT EXISTS "web_conferencing_url" text;
