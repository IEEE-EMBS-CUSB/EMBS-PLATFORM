# Neon Schema Shift Runbook — Priority 1: Identity Split (`persons` + `roster_memberships`)

Handoff guide for the agent/operator executing the Priority 1 identity split on Neon PostgreSQL.

## Summary of Schema & Auth Changes

This branch (`feat/identity-split`) introduces two Drizzle migrations:

1. [`drizzle/0009_expand_backfill_persons.sql`](../drizzle/0009_expand_backfill_persons.sql) (**Expand + Backfill + Constraints**):
   - Creates `persons` (`id`, `email` unique normalized, `full_name`, `password_hash`, `must_change_password`, `password_changed_at`, `is_active`, `created_at`, `updated_at`).
   - Adds `roster_memberships.person_id` (nullable first), backfills `persons` from `roster_memberships` using `lower(btrim(email))` with deterministic multi-season conflict resolution (`active` season → `password_changed_at DESC NULLS LAST` → `must_change_password ASC` → `seasons.start_date DESC` → `roster_memberships.created_at DESC`), maps every `roster_memberships.person_id`, then sets `NOT NULL` and adds `ON DELETE RESTRICT` FK to `persons(id)`.
   - Drops `roster_season_email_idx` and `roster_email_idx`, makes legacy `email`/`full_name` nullable, and creates 5 explicit partial unique indexes per role class:
     - `roster_global_role_uniq` (`master_admin`, `hr_admin`)
     - `roster_director_global_uniq` (`director` where `managed_track_id IS NULL`)
     - `roster_director_track_uniq` (`director` where `managed_track_id IS NOT NULL`)
     - `roster_committee_role_uniq` (`committee_head`, `hr_member`, `member`, `attendee` where `committee_id IS NOT NULL`)
     - `roster_unassigned_role_uniq` (`committee_head`, `hr_member`, `member`, `attendee` where `committee_id IS NULL`)
2. [`drizzle/0010_contract_roster_identity.sql`](../drizzle/0010_contract_roster_identity.sql) (**Contract**):
   - Drops the 5 legacy columns from `roster_memberships`: `email`, `full_name`, `password_hash`, `must_change_password`, `password_changed_at`.
3. **Session revocation on cutover**:
   - `CURRENT_SESSION_KEY_VERSION` in `src/services/session.service.ts` was bumped from `1` to `2` and now carries `personId` (`uid`). All pre-cutover cookies are cleanly rejected and cleared on next request (one-time re-login for active users).

---

## Mandatory Safety Rules

- **NEVER run this first on the Neon production/main branch.** Create an isolated Neon branch from production first, point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in `.env.local` at that Neon branch, and prove every assertion below before scheduling production cutover.
- **Keep `roster_memberships.id` untouched**: Neither migration changes any `roster_memberships.id`, so all historical FKs (`attendance_records`, `task_submissions`, `score_ledger`, `hr_feedback`, `events`, `monthly_snapshots`, `member_activities`, `seasonal_evaluations`) remain intact.

---

## Step 1 — Pre-Flight Audit Queries (Run BEFORE Migration)

Run these read-only queries against the target Neon branch and record the output:

```sql
-- 1A. Baseline row counts across all tables
SELECT 'roster_memberships' AS tbl, count(*) FROM roster_memberships
UNION ALL SELECT 'distinct_norm_emails', count(DISTINCT lower(btrim(email))) FROM roster_memberships
UNION ALL SELECT 'attendance_records', count(*) FROM attendance_records
UNION ALL SELECT 'task_submissions', count(*) FROM task_submissions
UNION ALL SELECT 'score_ledger', count(*) FROM score_ledger
UNION ALL SELECT 'hr_feedback', count(*) FROM hr_feedback
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'monthly_snapshots', count(*) FROM monthly_snapshots
UNION ALL SELECT 'member_activities', count(*) FROM member_activities
UNION ALL SELECT 'seasonal_evaluations', count(*) FROM seasonal_evaluations;

-- 1B. Check for unnormalized emails (whitespace or uppercase)
SELECT id, season_id, email
FROM roster_memberships
WHERE email <> lower(btrim(email)) OR email IS NULL OR btrim(email) = '';

-- 1C. Check for same-season duplicate emails after normalization (must be 0 rows)
SELECT season_id, lower(btrim(email)) AS norm_email, count(*)
FROM roster_memberships
GROUP BY season_id, lower(btrim(email))
HAVING count(*) > 1;

-- 1D. Surface any cross-season password conflicts (same email, different non-null hashes)
SELECT
  lower(btrim(rm.email)) AS norm_email,
  count(DISTINCT rm.password_hash) AS distinct_hashes,
  array_agg(s.name || ':' || s.status || ':must_change=' || rm.must_change_password ORDER BY s.start_date DESC) AS seasons
FROM roster_memberships rm
INNER JOIN seasons s ON s.id = rm.season_id
WHERE rm.password_hash IS NOT NULL
GROUP BY lower(btrim(rm.email))
HAVING count(DISTINCT rm.password_hash) > 1;
```

- If **1B** returns blank/null emails or **1C** returns any rows, stop and resolve those rows before migrating.
- If **1D** returns rows, review which season's password hash will win under `0009`'s `DISTINCT ON` precedence (`active` season → latest `password_changed_at` → `must_change_password = false` → latest `start_date`).

---

## Step 2 — Execute Migrations on the Neon Branch

To verify the full Drizzle migration chain (`0009` + `0010`) cleanly:

```bash
pnpm db:migrate
```

*(Optional staged verification: if you want to inspect the database between expand and contract before running `0010`, you may test `0009` inside a transaction or on a scratch Neon branch first, run Step 3, then run `pnpm db:migrate`.)*

---

## Step 3 — Post-Migration Validation Queries (Prove Lossless)

Run these queries immediately after migration and verify every assertion:

```sql
-- 3A. Verify zero unlinked memberships (must be 0)
SELECT count(*) AS null_person_id_count
FROM roster_memberships
WHERE person_id IS NULL;

-- 3B. Verify persons count matches pre-flight distinct_norm_emails exactly
SELECT count(*) AS persons_count FROM persons;

-- 3C. Verify every operational table row count matches Step 1A exactly
SELECT 'roster_memberships' AS tbl, count(*) FROM roster_memberships
UNION ALL SELECT 'attendance_records', count(*) FROM attendance_records
UNION ALL SELECT 'task_submissions', count(*) FROM task_submissions
UNION ALL SELECT 'score_ledger', count(*) FROM score_ledger
UNION ALL SELECT 'hr_feedback', count(*) FROM hr_feedback
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'monthly_snapshots', count(*) FROM monthly_snapshots
UNION ALL SELECT 'member_activities', count(*) FROM member_activities
UNION ALL SELECT 'seasonal_evaluations', count(*) FROM seasonal_evaluations;

-- 3D. Verify zero orphaned FKs across all referencing tables (every count must be 0)
SELECT 'attendance_orphans' AS chk, count(*) FROM attendance_records ar LEFT JOIN roster_memberships rm ON rm.id = ar.membership_id WHERE rm.id IS NULL
UNION ALL SELECT 'submission_orphans', count(*) FROM task_submissions ts LEFT JOIN roster_memberships rm ON rm.id = ts.membership_id WHERE rm.id IS NULL
UNION ALL SELECT 'ledger_orphans', count(*) FROM score_ledger sl LEFT JOIN roster_memberships rm ON rm.id = sl.membership_id WHERE rm.id IS NULL
UNION ALL SELECT 'feedback_orphans', count(*) FROM hr_feedback hf LEFT JOIN roster_memberships rm ON rm.id = hf.membership_id WHERE rm.id IS NULL
UNION ALL SELECT 'membership_person_orphans', count(*) FROM roster_memberships rm LEFT JOIN persons p ON p.id = rm.person_id WHERE p.id IS NULL;

-- 3E. Verify partial unique indexes exist and legacy unique index is gone
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('persons', 'roster_memberships')
ORDER BY tablename, indexname;
```

---

## Step 4 — Run Full Automated Verification Against the Migrated Neon Branch

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Pay particular attention to these DB-backed suites (skipped when `DATABASE_URL` was absent during offline authoring):

- `src/db/__tests__/identity-split-migration.test.ts` (real-Postgres partial unique index & `ON DELETE RESTRICT` assertions)
- `src/lib/__tests__/roster-actions.test.ts` (multi-hat person reuse, password preservation, and cross-hat `hr_admin` password-reset protection)
- `src/app/api/session/__tests__/route.test.ts` (v2 session cookie DB validation against `persons` + `roster_memberships`)
- `src/services/__tests__/security-and-integrity.test.ts`
- `src/services/__tests__/member.service.test.ts` & `src/services/__tests__/attendee.service.test.ts`
- `src/lib/__tests__/publishing-actions.test.ts`, `qr-rotation.test.ts`, `session-checkin-actions.test.ts`, `task-assignment-actions.test.ts`, `season-settings-and-tracks.test.ts`

---

## Step 5 — Rollback SQL (If Needed Before Multi-Hat Rows Exist)

If you need to roll back `0010` + `0009` on a branch where **no person holds multiple memberships in the same season**:

```sql
BEGIN;

-- Reverse 0010 (restore legacy columns from persons)
ALTER TABLE "roster_memberships"
  ADD COLUMN IF NOT EXISTS "email" text,
  ADD COLUMN IF NOT EXISTS "full_name" text,
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;

UPDATE "roster_memberships" rm
SET
  "email" = p."email",
  "full_name" = p."full_name",
  "password_hash" = p."password_hash",
  "must_change_password" = p."must_change_password",
  "password_changed_at" = p."password_changed_at"
FROM "persons" p
WHERE rm."person_id" = p."id";

ALTER TABLE "roster_memberships"
  ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "full_name" SET NOT NULL;

-- Reverse 0009
DROP INDEX IF EXISTS "roster_global_role_uniq";
DROP INDEX IF EXISTS "roster_director_global_uniq";
DROP INDEX IF EXISTS "roster_director_track_uniq";
DROP INDEX IF EXISTS "roster_committee_role_uniq";
DROP INDEX IF EXISTS "roster_unassigned_role_uniq";
DROP INDEX IF EXISTS "roster_person_id_idx";

ALTER TABLE "roster_memberships" DROP CONSTRAINT IF EXISTS "roster_memberships_person_id_persons_id_fk";
ALTER TABLE "roster_memberships" DROP COLUMN IF EXISTS "person_id";

CREATE UNIQUE INDEX "roster_season_email_idx" ON "roster_memberships" USING btree ("season_id","email");
CREATE INDEX "roster_email_idx" ON "roster_memberships" USING btree ("email");

DROP TABLE IF EXISTS "persons";

-- Also remove 0009 and 0010 entries from drizzle.__drizzle_migrations if rolling back Drizzle state
COMMIT;
```

> Note: Once real multi-hat rows exist in the same season, `roster_season_email_idx` cannot be recreated without dropping or merging duplicate `(season_id, email)` hats; take a Neon snapshot/branch before production cutover.
