-- Separate transaction from 0011 so PostgreSQL allows referencing the newly added 'assignment' enum value (avoids SQLSTATE 55P04)
UPDATE "score_ledger" sl
SET "source_type" = 'assignment'::"ledger_source_type"
FROM "task_submissions" ts
INNER JOIN "tasks" t ON t."id" = ts."task_id"
WHERE sl."source_type" = 'task'
	AND sl."source_id" = ts."id"::text
	AND t."work_type" = 'assignment';--> statement-breakpoint
UPDATE "score_ledger" sl
SET "source_type" = 'assignment'::"ledger_source_type"
FROM "tasks" t
WHERE sl."source_type" = 'task'
	AND sl."source_id" = t."id"::text
	AND t."work_type" = 'assignment';
