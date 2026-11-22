# Neon Schema Shift Runbook — Priority 3: Scoring Scope, Assignment Source Type & HR Tracked Committee

Handoff guide for the agent/operator executing migrations `0011` and `0012` on Neon PostgreSQL (after Priority 1's `0009` + `0010` are applied and verified).

## Summary of Schema Changes

1. [`drizzle/0011_scoring_scope_and_hr_tracking.sql`](../drizzle/0011_scoring_scope_and_hr_tracking.sql):
   - Creates `ledger_posting_scope` enum (`'committee' | 'open'`).
   - Replaces `ledger_source_type` enum via a transaction-safe enum swap (`ledger_source_type_v2` → `ALTER COLUMN` → `DROP TYPE` → `RENAME`) to add `'assignment'` (`attendance | task | assignment | event | manual_override`) without hitting PostgreSQL `55P04` during Drizzle's single-transaction batch migration.
   - Adds `score_ledger.posting_scope` (`NOT NULL DEFAULT 'committee'`) and nullable `score_ledger.committee_id` (FK → `committees.id`, `ON DELETE SET NULL`), backfilled from `branch_sessions`, `tasks`, `events`, and `roster_memberships`.
   - Adds `roster_memberships.tracked_committee_id` (FK → `committees.id`, `ON DELETE SET NULL`).
   - Ensures any season containing an `hr_member` has an active `human-resources` committee, moves existing `hr_member.committee_id` → `tracked_committee_id`, and anchors `hr_member.committee_id` to `human-resources`.
2. [`drizzle/0012_backfill_assignment_ledger_source.sql`](../drizzle/0012_backfill_assignment_ledger_source.sql):
   - Re-tags existing `score_ledger` rows backed by `tasks.work_type = 'assignment'` from `'task'` → `'assignment'`.

---

## Step 1 — Pre-Flight Checks (on Disposable Neon Branch)

```sql
-- Check existing hr_member rows and their current committees
SELECT rm.id, s.name AS season, p.email, c.slug AS current_committee_slug
FROM roster_memberships rm
INNER JOIN seasons s ON s.id = rm.season_id
INNER JOIN persons p ON p.id = rm.person_id
LEFT JOIN committees c ON c.id = rm.committee_id
WHERE rm.role = 'hr_member';

-- Verify no person already holds two hr_member rows in the same season
SELECT season_id, person_id, count(*)
FROM roster_memberships
WHERE role = 'hr_member'
GROUP BY season_id, person_id
HAVING count(*) > 1;

-- Baseline score_ledger row count
SELECT source_type, count(*) FROM score_ledger GROUP BY source_type ORDER BY source_type;
```

## Step 2 — Run Migrations

```bash
pnpm db:migrate
```

## Step 3 — Post-Migration Validation Queries

```sql
-- 3A. Every hr_member now has committee_id = human-resources (0 rows expected)
SELECT rm.id, s.name, c.slug
FROM roster_memberships rm
INNER JOIN seasons s ON s.id = rm.season_id
LEFT JOIN committees c ON c.id = rm.committee_id
WHERE rm.role = 'hr_member' AND (c.slug IS NULL OR c.slug <> 'human-resources');

-- 3B. Verify score_ledger total row count is unchanged and posting_scope distribution makes sense
SELECT source_type, posting_scope, count(*)
FROM score_ledger
GROUP BY source_type, posting_scope
ORDER BY source_type, posting_scope;

-- 3C. Verify no committee-scoped ledger row has a NULL committee_id (should be 0)
SELECT count(*) AS invalid_committee_scoped_rows
FROM score_ledger
WHERE posting_scope = 'committee' AND committee_id IS NULL;
```

## Step 4 — Verification Suite

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
