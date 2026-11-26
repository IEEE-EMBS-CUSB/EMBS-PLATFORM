import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("HR member multi-committee tracking schema & migration 0019", () => {
  it("defines season-scoped hr_member_tracked_committees table in Drizzle schema", () => {
    expect("hrMemberTrackedCommittees" in schema).toBe(true);
    const table = (
      schema as unknown as {
        hrMemberTrackedCommittees: Parameters<typeof getTableConfig>[0];
      }
    ).hrMemberTrackedCommittees;
    const cfg = getTableConfig(table);

    expect(cfg.name).toBe("hr_member_tracked_committees");
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toEqual(
      expect.arrayContaining([
        "id",
        "season_id",
        "membership_id",
        "committee_id",
        "created_at",
      ])
    );

    const uniqueIdx = cfg.indexes.find(
      (idx) => idx.config.unique && idx.config.name === "hr_tracked_committees_membership_committee_uniq"
    );
    expect(uniqueIdx).toBeDefined();
  });

  it("registers strictly forward-only, backfill-safe migration 0019 in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.idx === 19);
    expect(entry).toBeDefined();
    expect(entry?.tag).toMatch(/^0019_/);

    const sqlText = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${entry!.tag}.sql`),
      "utf8"
    );
    expect(sqlText).toMatch(/CREATE TABLE IF NOT EXISTS "hr_member_tracked_committees"/i);
    expect(sqlText).toMatch(/"season_id" uuid NOT NULL REFERENCES "seasons"\("id"\)/i);
    expect(sqlText).toMatch(/"membership_id" uuid NOT NULL REFERENCES "roster_memberships"\("id"\)/i);
    expect(sqlText).toMatch(/"committee_id" uuid NOT NULL REFERENCES "committees"\("id"\)/i);
    expect(sqlText).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "hr_tracked_committees_membership_committee_uniq"/i);
    // Idempotent backfill from roster_memberships.tracked_committee_id
    expect(sqlText).toMatch(/INSERT INTO "hr_member_tracked_committees"/i);
    expect(sqlText).toMatch(/ON CONFLICT .* DO NOTHING/i);
    // Strictly forward-only: never drops existing columns or tables
    expect(sqlText).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(sqlText).not.toMatch(/\bTRUNCATE\b/i);
  });
});
