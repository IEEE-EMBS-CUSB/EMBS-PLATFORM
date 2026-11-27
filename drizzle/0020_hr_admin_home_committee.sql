-- Forward-only migration: ensure every season has a human-resources committee
-- and automatically bind all hr_admin memberships to their season's Human Resources
-- committee so hr_admin is unambiguously recognized as HR Head.

INSERT INTO "committees" ("season_id", "name", "slug", "category", "is_active")
SELECT s."id", 'Human Resources', 'human-resources', 'non_technical', true
FROM "seasons" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "committees" c
  WHERE c."season_id" = s."id" AND c."slug" = 'human-resources'
);
--> statement-breakpoint

UPDATE "roster_memberships" rm
SET "committee_id" = hr."id"
FROM "committees" hr
WHERE rm."season_id" = hr."season_id"
  AND hr."slug" = 'human-resources'
  AND rm."role" = 'hr_admin'
  AND rm."committee_id" IS DISTINCT FROM hr."id";
