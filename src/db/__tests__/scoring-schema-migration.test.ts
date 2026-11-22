import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  ledgerPostingScopeEnum,
  ledgerSourceTypeEnum,
  rosterMemberships,
  scoreLedger,
} from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Scoring scope, 5 point sources, and HR tracked committee schema + migration 0011", () => {
  it("defines all 5 confirmed ledger point sources and posting scope enum", () => {
    expect(ledgerSourceTypeEnum.enumValues).toEqual([
      "attendance",
      "task",
      "assignment",
      "event",
      "manual_override",
    ]);
    expect(ledgerPostingScopeEnum.enumValues).toEqual(["committee", "open"]);
  });

  it("adds posting_scope & committee_id to score_ledger and tracked_committee_id to roster_memberships", () => {
    const ledgerCols = getTableConfig(scoreLedger).columns.map((c) => c.name);
    expect(ledgerCols).toContain("posting_scope");
    expect(ledgerCols).toContain("committee_id");

    const rosterCols = getTableConfig(rosterMemberships).columns.map(
      (c) => c.name
    );
    expect(rosterCols).toContain("tracked_committee_id");
  });

  it("registers backfill-safe migration 0011 in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.idx === 11);
    const entry12 = journal.entries.find((e) => e.idx === 12);
    expect(entry).toBeDefined();
    expect(entry?.tag).toMatch(/^0011_/);
    expect(entry12).toBeDefined();
    expect(entry12?.tag).toMatch(/^0012_/);

    const sqlText = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry!.tag}.sql`),
      "utf8"
    );
    const sql12Text = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry12!.tag}.sql`),
      "utf8"
    );
    expect(sqlText).toMatch(/ADD VALUE IF NOT EXISTS 'assignment'/i);
    expect(sqlText).toMatch(/CREATE TYPE "public"\."ledger_posting_scope"/i);
    expect(sqlText).toMatch(/ADD COLUMN "posting_scope"/i);
    expect(sqlText).toMatch(/ADD COLUMN "committee_id"/i);
    expect(sqlText).toMatch(/ADD COLUMN "tracked_committee_id"/i);
    // Backfill creates human-resources committee if missing and migrates hr_member home vs tracked
    expect(sqlText).toMatch(/human-resources/i);
    expect(sqlText).toMatch(/tracked_committee_id/i);
    // 0012 runs in separate transaction to avoid PostgreSQL 55P04 on new enum value
    expect(sql12Text).toMatch(/SET "source_type" = 'assignment'/i);
  });
});
