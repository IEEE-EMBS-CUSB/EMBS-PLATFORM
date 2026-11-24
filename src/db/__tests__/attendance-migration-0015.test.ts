import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attendanceRecords, branchSessions } from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Attendance schema consolidation & forward-only migration 0015", () => {
  it("consolidates branch_sessions expiration to checkin_ends_at, adds punctuality_starts_at, and adds status_updated_at to attendance_records", () => {
    const sessionCols = getTableConfig(branchSessions).columns.map(
      (c) => c.name
    );
    expect(sessionCols).toContain("checkin_starts_at");
    expect(sessionCols).toContain("checkin_ends_at");
    expect(sessionCols).toContain("punctuality_starts_at");
    expect(sessionCols).not.toContain("checkin_expires_at");

    const attendanceCols = getTableConfig(attendanceRecords).columns.map(
      (c) => c.name
    );
    expect(attendanceCols).toContain("checked_in_at");
    expect(attendanceCols).toContain("status_updated_at");
  });

  it("registers backfill-safe forward-only migration 0015 in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.idx === 15);
    expect(entry).toBeDefined();
    expect(entry?.tag).toMatch(/^0015_/);

    const sqlText = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry!.tag}.sql`),
      "utf8"
    );
    // Backfill checkin_ends_at from checkin_expires_at before dropping checkin_expires_at
    expect(sqlText).toMatch(/SET "checkin_ends_at" = "checkin_expires_at"/i);
    expect(sqlText).toMatch(/DROP COLUMN IF EXISTS "checkin_expires_at"/i);
    // Add punctuality_starts_at on branch_sessions
    expect(sqlText).toMatch(
      /ADD COLUMN IF NOT EXISTS "punctuality_starts_at"/i
    );
    // Add and backfill status_updated_at on attendance_records from checked_in_at
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "status_updated_at"/i);
    expect(sqlText).toMatch(/SET "status_updated_at" = "checked_in_at"/i);
  });
});
