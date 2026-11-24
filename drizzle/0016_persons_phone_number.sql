-- Forward-only migration: add nullable canonical E.164 phone_number to persons
-- with a partial unique index so phone numbers are usable for login and direct WhatsApp messaging.

ALTER TABLE "persons"
  ADD COLUMN IF NOT EXISTS "phone_number" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "persons_phone_number_idx"
  ON "persons" USING btree ("phone_number")
  WHERE ("persons"."phone_number" IS NOT NULL);
