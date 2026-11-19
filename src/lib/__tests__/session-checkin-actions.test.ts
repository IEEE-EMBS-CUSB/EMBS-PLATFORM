import { describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createSessionAction,
  toggleSessionCheckinAction,
  memberCheckinAction,
} from "@/app/hr/attendance/actions";

describe("Session & Live Check-in Actions (Database-backed)", () => {
  it("allows a committee head to create a session with a valid check-in window for their committee", async () => {
    // 1. Get an existing committee
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "robotics-and-automation"));
    expect(robotics).toBeDefined();

    const title = `Robotics Workshop ${Date.now()}`;
    const result = await createSessionAction(
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
      "committee_head",
      robotics.id
    );

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.checkinCode).toHaveLength(6);
    expect(result.checkinExpiresAt).toBeDefined();

    // Verify session in DB
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
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "robotics-and-automation"));
    const [ai] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "ai-and-machine-learning"));

    expect(robotics).toBeDefined();
    expect(ai).toBeDefined();

    const result = await createSessionAction(
      {
        title: "Malicious Cross-Committee Session",
        startsAt: new Date().toISOString(),
        committeeId: ai.id,
        checkinWindowMinutes: 30,
      },
      "committee_head",
      robotics.id // Head belongs to robotics, but trying to create for AI
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("rejects unauthorized session creation by regular member", async () => {
    const result = await createSessionAction(
      {
        title: "Member Rogue Session",
        startsAt: new Date().toISOString(),
      },
      "member"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("handles member live check-in and records attendance and score_ledger entry", async () => {
    // Pick an existing member
    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    // Create a live session for Omar's committee
    const createResult = await createSessionAction(
      {
        title: `Live Testing Session ${Date.now()}`,
        startsAt: new Date(Date.now() - 300000).toISOString(), // Started 5 mins ago (punctual)
        committeeId: omar.committeeId,
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        openCheckinImmediately: true,
      },
      "committee_head",
      omar.committeeId
    );
    expect(createResult.ok).toBe(true);

    const checkinCode = createResult.checkinCode!;

    // Perform check-in as Omar
    const checkinResult = await memberCheckinAction(checkinCode, omar.id);
    expect(checkinResult.ok).toBe(true);
    expect(checkinResult.pointsAwarded).toBe(15); // 10 base + 5 punctuality
    expect(checkinResult.isPunctual).toBe(true);

    // Verify attendance record in DB
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

    // Verify score_ledger entry in DB
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

    // Verify duplicate check-in is rejected
    const dupResult = await memberCheckinAction(checkinCode, omar.id);
    expect(dupResult.ok).toBe(false);
    expect(dupResult.error).toMatch(/already checked in/i);
  });

  it("rejects check-in when window is expired", async () => {
    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));

    // Create session with already expired window
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
        startsAt: new Date(Date.now() - 7200000), // 2 hours ago
        checkinOpen: true,
        checkinCode: "112233",
        checkinExpiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      })
      .returning();

    const result = await memberCheckinAction(expiredSession.checkinCode!, omar.id);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("allows committee head to toggle check-in window on and off", async () => {
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "robotics-and-automation"));

    const createResult = await createSessionAction(
      {
        title: "Toggle Checkin Test Session",
        startsAt: new Date().toISOString(),
        committeeId: robotics.id,
        openCheckinImmediately: false,
      },
      "committee_head",
      robotics.id
    );
    expect(createResult.ok).toBe(true);

    // Open check-in for 45 minutes
    const openRes = await toggleSessionCheckinAction(
      createResult.sessionId!,
      true,
      45,
      "committee_head",
      robotics.id
    );
    expect(openRes.ok).toBe(true);
    expect(openRes.checkinOpen).toBe(true);
    expect(openRes.checkinCode).toHaveLength(6);

    // Close check-in
    const closeRes = await toggleSessionCheckinAction(
      createResult.sessionId!,
      false,
      0,
      "committee_head",
      robotics.id
    );
    expect(closeRes.ok).toBe(true);
    expect(closeRes.checkinOpen).toBe(false);
    expect(closeRes.checkinExpiresAt).toBeNull();
  });
});
