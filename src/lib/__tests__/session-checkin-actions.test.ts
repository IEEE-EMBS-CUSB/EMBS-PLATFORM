import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  closeExpiredSessionsForSeason,
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
        slideDeckUrl: "https://docs.google.com/presentation/d/robotics-workshop",
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.session?.title).toBe(title);
    createdSessionIds.push(result.sessionId!);
    expect(result.checkinCode).toHaveLength(6);
    expect(result.checkinEndsAt).toBeDefined();

    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, result.sessionId!));

    expect(session).toBeDefined();
    expect(session.title).toBe(title);
    expect(session.committeeId).toBe(robotics.id);
    expect(session.checkinOpen).toBe(true);
    expect(session.checkinCode).toBe(result.checkinCode);
    expect(new Date(session.checkinEndsAt!).getTime()).toBeGreaterThan(Date.now());
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
        slideDeckUrl: "https://docs.google.com/presentation/d/live-testing",
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
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
        checkinEndsAt: new Date(Date.now() - 3600000),
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
        slideDeckUrl: "https://docs.google.com/presentation/d/toggle-test",
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(createResult.ok).toBe(true);
    createdSessionIds.push(createResult.sessionId!);

    const closeRes = await toggleSessionCheckinAsActor(
      createResult.sessionId!,
      false,
      0,
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(closeRes.ok).toBe(true);
    expect(closeRes.checkinOpen).toBe(false);
    expect(closeRes.checkinEndsAt).toBeNull();

    const openRes = await toggleSessionCheckinAsActor(
      createResult.sessionId!,
      true,
      45,
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );
    expect(openRes.ok).toBe(true);
    expect(openRes.checkinOpen).toBe(true);
    expect(openRes.checkinCode).toHaveLength(6);
    // Persistent 1 code / 1 QR: code is created up front and preserved across open/close/re-open
    expect(createResult.checkinCode).toMatch(/^\d{6}$/);
    expect(openRes.checkinCode).toBe(createResult.checkinCode);
    expect(closeRes.checkinCode).toBe(createResult.checkinCode);
  });

  it("schedules a future session with persistent code that blocks early check-in until startsAt", async () => {
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

    const futureStart = new Date(Date.now() + 60 * 60_000); // +60m
    const createResult = await createSessionAsActor(
      {
        title: `Future Slide QR Session ${Date.now()}`,
        startsAt: futureStart.toISOString(),
        committeeId: omar.committeeId,
        slideDeckUrl: "https://docs.google.com/presentation/d/future-qr",
        checkinWindowMinutes: 30,
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } }
    );
    expect(createResult.ok).toBe(true);
    createdSessionIds.push(createResult.sessionId!);
    expect(createResult.checkinCode).toMatch(/^\d{6}$/);
    expect(createResult.checkinOpen).toBe(true);

    const [row] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, createResult.sessionId!));
    expect(row.checkinStartsAt?.getTime()).toBe(futureStart.getTime());
    expect(row.checkinEndsAt?.getTime()).toBe(futureStart.getTime() + 30 * 60_000);

    // Lazy cleanup must NOT close scheduled future sessions
    await closeExpiredSessionsForSeason(row.seasonId, new Date());
    const [afterCleanup] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, createResult.sessionId!));
    expect(afterCleanup.checkinOpen).toBe(true);
    expect(afterCleanup.checkinCode).toBe(createResult.checkinCode);

    // Member attempting to check in before startsAt is rejected
    const earlyCheckin = await recordMemberCheckin(createResult.checkinCode!, omar.id);
    expect(earlyCheckin.ok).toBe(false);
    expect(earlyCheckin.error).toMatch(/not started yet/i);
  });

  it("cuts from the check-in window when startsAt is in the past and preserves code when elapsed or re-opened", async () => {
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

    // Case A: started 10m ago with 30m window -> ~20m remaining, live immediately
    const recentPastStart = new Date(Date.now() - 10 * 60_000);
    const partialRes = await createSessionAsActor(
      {
        title: `Recent Past Window Session ${Date.now()}`,
        startsAt: recentPastStart.toISOString(),
        committeeId: omar.committeeId,
        slideDeckUrl: "https://docs.google.com/presentation/d/recent-past",
        checkinWindowMinutes: 30,
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } }
    );
    expect(partialRes.ok).toBe(true);
    createdSessionIds.push(partialRes.sessionId!);
    expect(partialRes.checkinOpen).toBe(true);
    expect(partialRes.checkinEndsAt?.getTime()).toBe(
      recentPastStart.getTime() + 30 * 60_000
    );

    // Case B: started 60m ago with 30m window -> initial window already elapsed, still gets persistent code, can be re-opened later with same code
    const oldPastStart = new Date(Date.now() - 60 * 60_000);
    const elapsedRes = await createSessionAsActor(
      {
        title: `Elapsed Past Window Session ${Date.now()}`,
        startsAt: oldPastStart.toISOString(),
        committeeId: omar.committeeId,
        slideDeckUrl: "https://docs.google.com/presentation/d/elapsed-past",
        checkinWindowMinutes: 30,
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } }
    );
    expect(elapsedRes.ok).toBe(true);
    createdSessionIds.push(elapsedRes.sessionId!);
    expect(elapsedRes.checkinOpen).toBe(false);
    expect(elapsedRes.checkinCode).toMatch(/^\d{6}$/);

    // Re-opening later keeps the exact same 6-digit code and can reset punctuality grace period from now
    const reopenRes = await toggleSessionCheckinAsActor(
      elapsedRes.sessionId!,
      true,
      20,
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } },
      { resetPunctualityFromNow: true }
    );
    expect(reopenRes.ok).toBe(true);
    expect(reopenRes.checkinOpen).toBe(true);
    expect(reopenRes.checkinCode).toBe(elapsedRes.checkinCode);
    expect(reopenRes.punctualityStartsAt).toBeDefined();

    // Member checking in immediately after delayed re-open receives punctual credit
    const delayedCheckin = await recordMemberCheckin(elapsedRes.checkinCode!, omar.id);
    expect(delayedCheckin.ok).toBe(true);
    expect(delayedCheckin.isPunctual).toBe(true);

    // Lazy expiration must preserve checkinCode when closing an expired session
    const [row] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, elapsedRes.sessionId!));
    await closeExpiredSessionsForSeason(
      row.seasonId,
      new Date(Date.now() + 30 * 60_000)
    );
    const [expiredRow] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, elapsedRes.sessionId!));
    expect(expiredRow.checkinOpen).toBe(false);
    expect(expiredRow.checkinCode).toBe(elapsedRes.checkinCode);
  });
});
