import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  publishMonthlySnapshotAsActor,
  getSnapshotForPublishingPage,
} from "@/services/hr-ops/publishing.service";
import {
  getCommitteeLeaders,
  getLeaderboardHistory,
  getOverallLeaderboard,
} from "@/services/leaderboard.service";

describe("Monthly leaderboard publishing", () => {
  const testMonthsToClean: string[] = [];

  afterEach(async () => {
    for (const month of testMonthsToClean.splice(0)) {
      await db
        .delete(schema.monthlySnapshots)
        .where(eq(schema.monthlySnapshots.month, month));
      await db
        .delete(schema.scoreLedger)
        .where(eq(schema.scoreLedger.month, month));
    }
  });

  it("calculates a draft snapshot, publishes a month, and renders cleanly on public leaderboards without attendees", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));
    const [hrAdmin] = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.persons.fullName,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "hr.lead@cu.edu.eg"));
    const [omar] = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.persons.fullName,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"));
    const attendees = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          eq(schema.rosterMemberships.role, "attendee")
        )
      );

    expect(hrAdmin).toBeDefined();
    expect(omar).toBeDefined();

    const testMonth = "2026-12";
    testMonthsToClean.push(testMonth);

    await db.insert(schema.scoreLedger).values({
      seasonId: activeSeason.id,
      membershipId: omar.id,
      month: testMonth,
      sourceType: "manual_override",
      sourceId: null,
      points: 75,
      reason: "Publishing E2E test",
    });

    const draft = await getSnapshotForPublishingPage(testMonth);
    expect(draft).not.toBeNull();
    expect(draft?.status).toBe("draft");
    expect(draft?.overallEntries.length).toBeGreaterThan(0);

    // Attendees must never appear in leaderboard draft or published snapshots
    const attendeeIds = new Set(attendees.map((a) => a.id));
    for (const entry of draft!.overallEntries) {
      expect(attendeeIds.has(entry.memberId)).toBe(false);
    }

    const result = await publishMonthlySnapshotAsActor(testMonth, {
      profile: { id: hrAdmin.id, role: "hr_admin" },
    });
    expect(result.ok).toBe(true);

    // Public leaderboard readers must immediately see non-empty entries from UI-published snapshot!
    const overall = await getOverallLeaderboard(testMonth as never);
    expect(overall).not.toBeNull();
    expect(overall!.entries.length).toBeGreaterThan(0);
    expect(overall!.entries[0].memberId).toBe(omar.id);
    expect(overall!.entries[0].monthlyScore).toBe(75);

    const history = await getLeaderboardHistory();
    const historyEntry = history.find((h) => h.month === testMonth);
    expect(historyEntry).toBeDefined();
    expect(historyEntry!.totalRankedMembers).toBeGreaterThan(0);
    expect(historyEntry!.topOverall?.memberName).toBe(omar.fullName);

    const leaders = await getCommitteeLeaders(testMonth as never);
    expect(leaders.some((l) => l.leader !== null)).toBe(true);
  });
});
