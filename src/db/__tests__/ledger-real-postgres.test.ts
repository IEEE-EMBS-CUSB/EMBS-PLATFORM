import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertScoreLedgerEntry } from "@/db/ledger";

describe("upsertScoreLedgerEntry against real PostgreSQL partial unique index", () => {
  const createdLedgerIds: string[] = [];

  afterEach(async () => {
    for (const id of createdLedgerIds.splice(0)) {
      await db.delete(schema.scoreLedger).where(eq(schema.scoreLedger.id, id));
    }
  });

  it("inserts and updates a task ledger entry on conflict using the partial unique index", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.seasonId, activeSeason.id))
      .limit(1);

    expect(activeSeason).toBeDefined();
    expect(member).toBeDefined();

    const syntheticSourceId = crypto.randomUUID();

    const first = await upsertScoreLedgerEntry(db, {
      seasonId: activeSeason.id,
      membershipId: member.id,
      month: "2099-01",
      sourceType: "task",
      sourceId: syntheticSourceId,
      points: 20,
      reason: "Initial grade",
    });
    createdLedgerIds.push(first.id);
    expect(first.points).toBe(20);

    // Upsert with same (membershipId, sourceType, sourceId) must update in place
    const updated = await upsertScoreLedgerEntry(db, {
      seasonId: activeSeason.id,
      membershipId: member.id,
      month: "2099-01",
      sourceType: "task",
      sourceId: syntheticSourceId,
      points: 35,
      reason: "Revised grade",
    });
    expect(updated.id).toBe(first.id);
    expect(updated.points).toBe(35);
    expect(updated.reason).toBe("Revised grade");
  });
});
