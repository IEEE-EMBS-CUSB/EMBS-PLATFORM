import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Migration 0020: hr_admin home committee backfill", () => {
  it("registers strictly forward-only migration 0020 in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.idx === 20);
    expect(entry).toBeDefined();
    expect(entry?.tag).toMatch(/^0020_/);

    const sqlText = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry!.tag}.sql`),
      "utf8"
    );
    expect(sqlText).toMatch(/UPDATE "roster_memberships"/i);
    expect(sqlText).toMatch(/'hr_admin'/i);
    expect(sqlText).toMatch(/human-resources/i);
    expect(sqlText).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(sqlText).not.toMatch(/\bTRUNCATE\b/i);
  });
});
