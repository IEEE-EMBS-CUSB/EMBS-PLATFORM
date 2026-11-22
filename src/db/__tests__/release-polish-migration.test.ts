import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attendanceRecords, hrFeedback, tasks } from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Release polish schema columns & forward-only migration 0013", () => {
  it("adds status to attendance_records, completion_mode + created_by to tasks, and category + points_delta to hr_feedback", () => {
    const attendanceCols = getTableConfig(attendanceRecords).columns.map(
      (c) => c.name
    );
    expect(attendanceCols).toContain("status");

    const taskCols = getTableConfig(tasks).columns.map((c) => c.name);
    expect(taskCols).toContain("completion_mode");
    expect(taskCols).toContain("created_by");

    const feedbackCols = getTableConfig(hrFeedback).columns.map((c) => c.name);
    expect(feedbackCols).toContain("category");
    expect(feedbackCols).toContain("points_delta");
  });

  it("registers backfill-safe migration 0013 in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.idx === 13);
    expect(entry).toBeDefined();
    expect(entry?.tag).toMatch(/^0013_/);

    const sqlText = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry!.tag}.sql`),
      "utf8"
    );
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "status"/i);
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "completion_mode"/i);
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "created_by"/i);
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "category"/i);
    expect(sqlText).toMatch(/ADD COLUMN IF NOT EXISTS "points_delta"/i);
    // Preserve historical private warnings as internal_note so they never leak to members
    expect(sqlText).toMatch(/SET "category" = 'internal_note'/i);
  });
});
