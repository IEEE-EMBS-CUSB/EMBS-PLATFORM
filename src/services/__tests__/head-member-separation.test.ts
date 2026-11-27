import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  createSessionAsActor,
  getSessionAttendanceRosterAsActor,
  setSessionMemberAttendanceAsActor,
} from "@/services/hr-ops/attendance.service";
import { addHrFeedbackAsActor } from "@/services/hr-ops/feedback.service";
import { addManualLedgerEntryAsActor } from "@/services/hr-ops/ledger.service";
import { getAdminStatisticsDatasetForActor } from "@/services/hr-ops/statistics.service";
import {
  getMemberDashboard,
  getMemberMonthlyScores,
} from "@/services/member.service";
import { hashPassword } from "@/lib/password";
import type { ActorContext } from "@/lib/action-auth";

const RUN_ID = `head-sep-${Date.now()}`;

describe("Head vs. Member separation across feedback, attendance, ledger, statistics, and personal rankings (real Postgres)", () => {
  let seasonId: string;
  let commId: string;
  let headAMemId: string;
  let headBMemId: string;
  let member1MemId: string;
  let member2MemId: string;
  let headAActor: ActorContext;
  let sessionId: string;
  const createdPersonIds: string[] = [];

  beforeAll(async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) {
      throw new Error("Expected an active seeded season in embs_portal_test.");
    }
    seasonId = activeSeason.id;

    const [comm] = await db
      .insert(schema.committees)
      .values({
        seasonId,
        name: `Head Separation Comm ${RUN_ID}`,
        slug: `head-sep-${RUN_ID}`,
        category: "technical",
        isActive: true,
      })
      .returning();
    commId = comm.id;

    const pwHash = hashPassword("TestPass123!");
    const [pHeadA, pHeadB, pMem1, pMem2] = await db
      .insert(schema.persons)
      .values([
        {
          email: `heada-${RUN_ID}@cu.edu.eg`,
          fullName: "Head Alpha",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `headb-${RUN_ID}@cu.edu.eg`,
          fullName: "Head Beta",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `mem1-${RUN_ID}@cu.edu.eg`,
          fullName: "Member One",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `mem2-${RUN_ID}@cu.edu.eg`,
          fullName: "Member Two",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
      ])
      .returning();

    createdPersonIds.push(pHeadA.id, pHeadB.id, pMem1.id, pMem2.id);

    const [mHeadA, mHeadB, mMem1, mMem2] = await db
      .insert(schema.rosterMemberships)
      .values([
        {
          seasonId,
          personId: pHeadA.id,
          role: "committee_head",
          committeeId: commId,
          isActive: true,
        },
        {
          seasonId,
          personId: pHeadB.id,
          role: "committee_head",
          committeeId: commId,
          isActive: true,
        },
        {
          seasonId,
          personId: pMem1.id,
          role: "member",
          committeeId: commId,
          isActive: true,
        },
        {
          seasonId,
          personId: pMem2.id,
          role: "member",
          committeeId: commId,
          isActive: true,
        },
      ])
      .returning();

    headAMemId = mHeadA.id;
    headBMemId = mHeadB.id;
    member1MemId = mMem1.id;
    member2MemId = mMem2.id;

    headAActor = {
      sessionId: "sess-heada",
      personId: pHeadA.id,
      participantId: headAMemId,
      profile: {
        id: headAMemId,
        personId: pHeadA.id,
        fullName: pHeadA.fullName,
        email: pHeadA.email,
        role: "committee_head",
        committeeId: commId,
        trackedCommitteeId: null,
        managedTrackId: null,
        seasonId,
      },
    };

    const sessRes = await createSessionAsActor(
      {
        title: `Committee Workshop ${RUN_ID}`,
        committeeId: commId,
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
        sessionMode: "offline",
        slideDeckUrl: "https://slides.example.com/deck",
        locationAddress: "Room 101",
        instructorMembershipIds: [headAMemId],
      },
      headAActor
    );
    if (!sessRes.ok || !sessRes.sessionId) {
      throw new Error(`Failed to create test session: ${sessRes.error}`);
    }
    sessionId = sessRes.sessionId;

    // Seed ledger entries for an isolated future month so head vs. member rankings are deterministic
    await db.insert(schema.scoreLedger).values([
      {
        seasonId,
        membershipId: headAMemId,
        month: "2026-12",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: commId,
        points: 500,
        reason: "Director head directive",
      },
      {
        seasonId,
        membershipId: member1MemId,
        month: "2026-12",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: commId,
        points: 30,
        reason: "Member assignment",
      },
      {
        seasonId,
        membershipId: member2MemId,
        month: "2026-12",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: commId,
        points: 10,
        reason: "Member assignment",
      },
    ]);
  });

  afterAll(async () => {
    if (sessionId) {
      await db
        .delete(schema.branchSessions)
        .where(eq(schema.branchSessions.id, sessionId));
    }
    if (createdPersonIds.length > 0) {
      await db
        .delete(schema.rosterMemberships)
        .where(inArray(schema.rosterMemberships.personId, createdPersonIds));
      await db
        .delete(schema.persons)
        .where(inArray(schema.persons.id, createdPersonIds));
    }
    if (commId) {
      await db
        .delete(schema.committees)
        .where(eq(schema.committees.id, commId));
    }
  });

  it("hides co-heads from a committee_head's attendance sheet, blocks head-to-head attendance/feedback/ledger actions, and excludes heads from member rankings", async () => {
    // 1. Attendance roster for committee_head includes ONLY regular members (no co-heads, no self)
    const rosterRes = await getSessionAttendanceRosterAsActor(
      sessionId,
      headAActor
    );
    expect(rosterRes.ok).toBe(true);
    const rosterIds = (rosterRes.roster ?? []).map((r) => r.membershipId);
    expect(rosterIds).toContain(member1MemId);
    expect(rosterIds).toContain(member2MemId);
    expect(rosterIds).not.toContain(headBMemId);
    expect(rosterIds).not.toContain(headAMemId);

    // 2. committee_head cannot modify co-head attendance
    const attAttempt = await setSessionMemberAttendanceAsActor(
      {
        sessionId,
        membershipId: headBMemId,
        status: "on_time",
      },
      headAActor
    );
    expect(attAttempt.ok).toBe(false);
    expect(attAttempt.error).toMatch(/unauthorized|regular members/i);

    // 3. committee_head cannot give feedback to co-head
    const fbAttempt = await addHrFeedbackAsActor(
      {
        membershipId: headBMemId,
        content: "Peer head feedback attempt",
        category: "recognition",
      },
      headAActor
    );
    expect(fbAttempt.ok).toBe(false);
    expect(fbAttempt.error).toMatch(/unauthorized|regular members/i);

    // 4. committee_head cannot award ledger points to co-head
    const ledgerAttempt = await addManualLedgerEntryAsActor(
      {
        membershipId: headBMemId,
        points: 10,
        month: "2026-12",
        reason: "Peer head bonus attempt",
      },
      headAActor
    );
    expect(ledgerAttempt.ok).toBe(false);
    expect(ledgerAttempt.error).toMatch(/unauthorized|heads|leadership/i);

    // 5. committee_head statistics dataset contains regular members only (no co-heads)
    const stats = await getAdminStatisticsDatasetForActor({
      actor: {
        id: headAMemId,
        personId: headAActor.personId,
        role: "committee_head",
        committeeId: commId,
        committeeName: `Head Separation Comm ${RUN_ID}`,
        trackedCommitteeId: null,
        managedTrackId: null,
      },
    });
    const statMemberIds = stats.members.map((m) => m.id);
    expect(statMemberIds).toContain(member1MemId);
    expect(statMemberIds).toContain(member2MemId);
    expect(statMemberIds).not.toContain(headBMemId);
    expect(statMemberIds).not.toContain(headAMemId);

    // 6. Head personal dashboard & monthly scores show own score WITHOUT member-leaderboard rank comparisons
    const headScores = await getMemberMonthlyScores(headAMemId);
    const headDec = headScores.find((s) => s.month === "2026-12");
    expect(headDec?.totalScore).toBe(500);
    expect(headDec?.overallRank).toBeNull();
    expect(headDec?.overallTotal).toBeNull();
    expect(headDec?.committeeRank).toBeNull();
    expect(headDec?.committeeTotal).toBeNull();

    const headDash = await getMemberDashboard(headAMemId, "2026-12");
    expect(headDash?.engagement?.currentRank).toBeNull();
    expect(headDash?.engagement?.pointsToNextRank).toBeNull();

    // 7. Regular member rankings EXCLUDE committee_head points (member1 with 30 pts is #1 of 2 in committee, NOT behind headA's 500 pts!)
    const mem1Scores = await getMemberMonthlyScores(member1MemId);
    const mem1Dec = mem1Scores.find((s) => s.month === "2026-12");
    expect(mem1Dec?.totalScore).toBe(30);
    expect(mem1Dec?.committeeRank).toBe(1);
    expect(mem1Dec?.committeeTotal).toBe(2);
  });
});
