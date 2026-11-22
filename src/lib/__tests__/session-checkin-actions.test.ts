import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createSessionAsActor,
  toggleSessionCheckinAsActor,
  recordMemberCheckin,
} from "@/services/hr-ops/attendance.service";

describe("Session & Live Check-in Actions (Database-backed)", () => {
  const createdSessionIds: string[] = [];

  afterEach(async () => {
    for (const sessionId of createdSessionIds.splice(0)) {
      const records = await db
        .select({ id: schema.attendanceRecords.id })
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      for (const rec of records) {
        await db
          .delete(schema.scoreLedger)
          .where(eq(schema.scoreLedger.sourceId, rec.id));
      }
      await db
        .delete(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      await db
        .delete(schema.branchSessions)
        .where(eq(schema.branchSessions.id, sessionId));
    }
  });

  it("allows a committee head to create a session with a valid check-in window for their committee", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "robotics-and-automation"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      );
    expect(robotics).toBeDefined();

    const title = `Robotics Workshop ${Date.now()}`;
    const result = await createSessionAsActor(
      {
        title,
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        committeeId: robotics.id,
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        openCheckinImmediately: true,
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeDefined();
    createdSessionIds.push(result.sessionId!);
    expect(result.checkinCode).toHaveLength(6);
    expect(result.checkinExpiresAt).toBeDefined();

    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, result.sessionId!));

    expect(session).toBeDefined();
    expect(session.title).toBe(title);
    expect(session.committeeId).toBe(robotics.id);
    expect(session.checkinOpen).toBe(true);
    expect(session.checkinCode).toBe(result.checkinCode);
    expect(new Date(session.checkinExpiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a committee head attempting to create a session for another committee", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "robotics-and-automation"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      );
    const [ai] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "ai-and-machine-learning"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      );

    expect(robotics).toBeDefined();
    expect(ai).toBeDefined();

    const result = await createSessionAsActor(
      {
        title: "Malicious Cross-Committee Session",
        startsAt: new Date().toISOString(),
        committeeId: ai.id,
        checkinWindowMinutes: 30,
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("rejects unauthorized session creation by regular member", async () => {
    const result = await createSessionAsActor(
      {
        title: "Member Rogue Session",
        startsAt: new Date().toISOString(),
      },
      { profile: { role: "member", committeeId: null, id: "test" } }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("handles member live check-in and records attendance and score_ledger entry", async () => {
    const [omar] = await db
      .select({
        id: schema.rosterMemberships.id,
        committeeId: schema.rosterMemberships.committeeId,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    const createResult = await createSessionAsActor(
      {
        title: `Live Testing Session ${Date.now()}`,
        startsAt: new Date(Date.now() - 300000).toISOString(),
        committeeId: omar.committeeId,
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        openCheckinImmediately: true,
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } }
    );
    expect(createResult.ok).toBe(true);
    createdSessionIds.push(createResult.sessionId!);

    const checkinCode = createResult.checkinCode!;

    const checkinResult = await recordMemberCheckin(checkinCode, omar.id);
    expect(checkinResult.ok).toBe(true);
    expect(checkinResult.pointsAwarded).toBe(15);
    expect(checkinResult.isPunctual).toBe(true);

    const [record] = await db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, createResult.sessionId!),
          eq(schema.attendanceRecords.membershipId, omar.id)
        )
      );
    expect(record).toBeDefined();
    expect(record.pointsAwarded).toBe(15);
    expect(record.isPunctual).toBe(true);

    const [ledger] = await db
      .select()
      .from(schema.scoreLedger)
      .where(
        and(
          eq(schema.scoreLedger.membershipId, omar.id),
          eq(schema.scoreLedger.sourceType, "attendance"),
          eq(schema.scoreLedger.sourceId, record.id)
        )
      );
    expect(ledger).toBeDefined();
    expect(ledger.points).toBe(15);

    const dupResult = await recordMemberCheckin(checkinCode, omar.id);
    expect(dupResult.ok).toBe(false);
    expect(dupResult.error).toMatch(/already checked in/i);
  });

  it("rejects check-in when window is expired", async () => {
    const [omar] = await db
      .select({
        id: schema.rosterMemberships.id,
        committeeId: schema.rosterMemberships.committeeId,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"));

    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));

    const [expiredSession] = await db
      .insert(schema.branchSessions)
      .values({
        seasonId: activeSeason.id,
        committeeId: omar.committeeId,
        title: "Expired Checkin Window Session",
        startsAt: new Date(Date.now() - 7200000),
        checkinOpen: true,
        checkinCode: "112233",
        checkinExpiresAt: new Date(Date.now() - 3600000),
      })
      .returning();
    createdSessionIds.push(expiredSession.id);

    const result = await recordMemberCheckin(expiredSession.checkinCode!, omar.id);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("allows committee head to toggle check-in window on and off", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "robotics-and-automation"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      );

    const createResult = await createSessionAsActor(
      {
        title: "Toggle Checkin Test Session",
        startsAt: new Date().toISOString(),
        committeeId: robotics.id,
        openCheckinImmediately: false,
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(createResult.ok).toBe(true);
    createdSessionIds.push(createResult.sessionId!);

    const openRes = await toggleSessionCheckinAsActor(
      createResult.sessionId!,
      true,
      45,
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(openRes.ok).toBe(true);
    expect(openRes.checkinOpen).toBe(true);
    expect(openRes.checkinCode).toHaveLength(6);

    const closeRes = await toggleSessionCheckinAsActor(
      createResult.sessionId!,
      false,
      0,
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(closeRes.ok).toBe(true);
    expect(closeRes.checkinOpen).toBe(false);
    expect(closeRes.checkinExpiresAt).toBeNull();
  });
});
