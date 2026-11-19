import { describe, expect, it } from "vitest";
import {
  calculateLedgerTotals,
  type ScoreLedgerUpsertInput,
  validateLedgerInput,
} from "@/db/ledger";

describe("Score Ledger Logic & Validation", () => {
  it("validates that non-manual ledger entries must include a non-empty sourceId", () => {
    const invalidAttendance: ScoreLedgerUpsertInput = {
      seasonId: "season-1",
      membershipId: "mem-1",
      month: "2026-10",
      sourceType: "attendance",
      sourceId: null,
      points: 15,
      reason: "All-Community Meeting Attendance",
    };

    expect(() => validateLedgerInput(invalidAttendance)).toThrow(
      /sourceId is required for non-manual/i
    );

    const validAttendance: ScoreLedgerUpsertInput = {
      seasonId: "season-1",
      membershipId: "mem-1",
      month: "2026-10",
      sourceType: "attendance",
      sourceId: "session-rec-123",
      points: 15,
      reason: "All-Community Meeting Attendance",
    };
    expect(validateLedgerInput(validAttendance)).toBe(true);
  });

  it("allows manual_override entries without a sourceId", () => {
    const manualOverride: ScoreLedgerUpsertInput = {
      seasonId: "season-1",
      membershipId: "mem-1",
      month: "2026-10",
      sourceType: "manual_override",
      sourceId: null,
      points: -5,
      reason: "Late submission penalty applied by HR",
    };
    expect(validateLedgerInput(manualOverride)).toBe(true);
  });

  it("calculates member total and monthly points deterministically from ledger rows", () => {
    const rows = [
      {
        month: "2026-09",
        sourceType: "attendance" as const,
        points: 15,
      },
      {
        month: "2026-09",
        sourceType: "task" as const,
        points: 40,
      },
      {
        month: "2026-10",
        sourceType: "attendance" as const,
        points: 10,
      },
      {
        month: "2026-10",
        sourceType: "manual_override" as const,
        points: -5,
      },
      {
        month: "2026-10",
        sourceType: "task" as const,
        points: 50,
      },
    ];

    const result = calculateLedgerTotals(rows, "2026-10");
    expect(result.seasonTotal).toBe(110);
    expect(result.monthTotal).toBe(55);
    expect(result.breakdown.attendance).toBe(10);
    expect(result.breakdown.task).toBe(50);
    expect(result.breakdown.manual_override).toBe(-5);
  });
});
