import { sql } from "drizzle-orm";
import { scoreLedger } from "./schema";

export type LedgerSourceType =
  | "attendance"
  | "task"
  | "assignment"
  | "event"
  | "manual_override";

export type LedgerPostingScope = "committee" | "open";

export interface ScoreLedgerUpsertInput {
  seasonId: string;
  membershipId: string;
  month: string; // YYYY-MM
  sourceType: LedgerSourceType;
  sourceId: string | null;
  postingScope?: LedgerPostingScope;
  committeeId?: string | null;
  points: number;
  reason: string;
  createdBy?: string | null;
}

export interface MinimalLedgerRow {
  month: string;
  sourceType: LedgerSourceType;
  points: number;
}

export interface LedgerTotalsSummary {
  seasonTotal: number;
  monthTotal: number;
  breakdown: Record<LedgerSourceType, number>;
}

/**
 * Validates that non-manual ledger inputs strictly provide a non-empty sourceId
 * to guarantee upsert idempotence and prevent double-counting.
 */
export function validateLedgerInput(input: ScoreLedgerUpsertInput): boolean {
  if (input.sourceType !== "manual_override") {
    if (!input.sourceId || input.sourceId.trim() === "") {
      throw new Error(
        `sourceId is required for non-manual ledger entries (${input.sourceType}) to prevent double-counting.`
      );
    }
  }
  return true;
}

/**
 * Deterministically derives season totals, month totals, and category breakdowns
 * from an array of ledger records.
 */
export function calculateLedgerTotals(
  rows: readonly MinimalLedgerRow[],
  targetMonth: string
): LedgerTotalsSummary {
  let seasonTotal = 0;
  let monthTotal = 0;
  const breakdown: Record<LedgerSourceType, number> = {
    attendance: 0,
    task: 0,
    assignment: 0,
    event: 0,
    manual_override: 0,
  };

  for (const row of rows) {
    seasonTotal += row.points;
    if (row.month === targetMonth) {
      monthTotal += row.points;
      breakdown[row.sourceType] =
        (breakdown[row.sourceType] ?? 0) + row.points;
    }
  }

  return {
    seasonTotal,
    monthTotal,
    breakdown,
  };
}

/**
 * Executes an atomic upsert into `score_ledger` for non-manual entries
 * (attendance, tasks, assignments, events) or a clean insert for manual point overrides.
 *
 * Prevents double-counting when HR edits an existing grade, toggles task completion,
 * or modifies attendance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertScoreLedgerEntry(db: any, input: ScoreLedgerUpsertInput) {
  validateLedgerInput(input);

  const postingScope: LedgerPostingScope =
    input.postingScope ?? (input.committeeId ? "committee" : "open");
  const committeeId =
    postingScope === "open" ? null : (input.committeeId ?? null);

  if (input.sourceType === "manual_override" || !input.sourceId) {
    const [inserted] = await db
      .insert(scoreLedger)
      .values({
        seasonId: input.seasonId,
        membershipId: input.membershipId,
        month: input.month,
        sourceType: input.sourceType,
        sourceId: null,
        postingScope,
        committeeId,
        points: input.points,
        reason: input.reason,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return inserted;
  }

  // Non-manual source with sourceId: upsert using the partial unique constraint
  const [upserted] = await db
    .insert(scoreLedger)
    .values({
      seasonId: input.seasonId,
      membershipId: input.membershipId,
      month: input.month,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      postingScope,
      committeeId,
      points: input.points,
      reason: input.reason,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoUpdate({
      target: [
        scoreLedger.membershipId,
        scoreLedger.sourceType,
        scoreLedger.sourceId,
      ],
      targetWhere: sql`${scoreLedger.sourceId} IS NOT NULL`,
      set: {
        points: input.points,
        reason: input.reason,
        month: input.month,
        postingScope,
        committeeId,
        createdAt: new Date(),
      },
    })
    .returning();

  return upserted;
}
