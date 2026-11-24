import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { addManualLedgerEntryAsActor } from "@/services/hr-ops/ledger.service";
import { addHrFeedbackAsActor } from "@/services/hr-ops/feedback.service";
import { setSessionMemberAttendanceAsActor } from "@/services/hr-ops/attendance.service";
import { toggleTaskCompletionAsActor } from "@/services/hr-ops/tasks.service";

describe("HR Member cannot change points for Committee Head (real PostgreSQL)", () => {
  const createdPersonIds: string[] = [];
  let activeSeasonId = "";
  let commId = "";
  let commHrId = "";

  let hrMemberId = "";
  let hrMemberPersonId = "";
  let headId = "";
  let memberId = "";
  let sessionId = "";
  let headTaskSubmissionId = "";
  let memberTaskSubmissionId = "";

  beforeAll(async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) throw new Error("Expected active season");
    activeSeasonId = activeSeason.id;

    const [comm] = await db
      .insert(schema.committees)
      .values({
        seasonId: activeSeasonId,
        name: `HR Guard Comm ${suffix}`,
        slug: `hr-guard-${suffix}`,
        category: "technical",
      })
      .returning();
    commId = comm.id;

    const [existingHr] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, activeSeasonId))
      .limit(1);
    commHrId = existingHr.id;

    const makePerson = async (label: string) => {
      const [p] = await db
        .insert(schema.persons)
        .values({
          email: `hrguard-${label}-${suffix}@cu.edu.eg`,
          fullName: `HRGuard ${label} ${suffix}`,
          mustChangePassword: false,
          isActive: true,
        })
        .returning();
      createdPersonIds.push(p.id);
      return p;
    };

    const pHr = await makePerson("hrmem");
    const pHead = await makePerson("head");
    const pMem = await makePerson("member");
    hrMemberPersonId = pHr.id;

    const [mHr] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHr.id,
        role: "hr_member",
        committeeId: commHrId,
        trackedCommitteeId: commId,
      })
      .returning();
    hrMemberId = mHr.id;

    const [mHead] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHead.id,
        role: "committee_head",
        committeeId: commId,
      })
      .returning();
    headId = mHead.id;

    const [mMem] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pMem.id,
        role: "member",
        committeeId: commId,
      })
      .returning();
    memberId = mMem.id;

    const [sess] = await db
      .insert(schema.branchSessions)
      .values({
        seasonId: activeSeasonId,
        committeeId: commId,
        title: `Guard Session ${suffix}`,
        startsAt: new Date("2099-03-10T14:00:00.000Z"),
        basePoints: 10,
        punctualityBonus: 5,
      })
      .returning();
    sessionId = sess.id;

    const [hrTask] = await db
      .insert(schema.tasks)
      .values({
        seasonId: activeSeasonId,
        committeeId: commId,
        title: `Guard HR Task ${suffix}`,
        dueAt: new Date("2099-03-15T18:00:00.000Z"),
        maxPoints: 15,
        workType: "task",
        completionMode: "hr_only",
      })
      .returning();

    const [subHead] = await db
      .insert(schema.taskSubmissions)
      .values({ taskId: hrTask.id, membershipId: headId })
      .returning();
    headTaskSubmissionId = subHead.id;

    const [subMem] = await db
      .insert(schema.taskSubmissions)
      .values({ taskId: hrTask.id, membershipId: memberId })
      .returning();
    memberTaskSubmissionId = subMem.id;
  });

  afterAll(async () => {
    if (commId) {
      await db.delete(schema.committees).where(eq(schema.committees.id, commId));
    }
    for (const personId of createdPersonIds) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.personId, personId));
      await db.delete(schema.persons).where(eq(schema.persons.id, personId));
    }
  });

  const makeHrActor = () => ({
    profile: {
      id: hrMemberId,
      personId: hrMemberPersonId,
      role: "hr_member" as const,
      committeeId: commHrId,
      trackedCommitteeId: commId,
    },
  });

  it("blocks hr_member from adding manual ledger points for committee_head while allowing regular members", async () => {
    const blocked = await addManualLedgerEntryAsActor(
      {
        membershipId: headId,
        points: 20,
        month: "2099-03",
        reason: "Bonus attempt on head",
      },
      makeHrActor()
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/committee head/i);

    const allowed = await addManualLedgerEntryAsActor(
      {
        membershipId: memberId,
        points: 20,
        month: "2099-03",
        reason: "Bonus on regular member",
      },
      makeHrActor()
    );
    expect(allowed.ok).toBe(true);
  });

  it("blocks hr_member from attaching non-zero pointsDelta on feedback for committee_head while allowing 0-point feedback", async () => {
    const blocked = await addHrFeedbackAsActor(
      {
        membershipId: headId,
        category: "recognition",
        content: "Trying to add points via feedback",
        pointsDelta: 10,
      },
      makeHrActor()
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/committee head/i);

    const allowedZero = await addHrFeedbackAsActor(
      {
        membershipId: headId,
        category: "recognition",
        content: "Zero-point recognition note",
        pointsDelta: 0,
      },
      makeHrActor()
    );
    expect(allowedZero.ok).toBe(true);
  });

  it("blocks hr_member from changing attendance points for committee_head while allowing regular members", async () => {
    const blocked = await setSessionMemberAttendanceAsActor(
      {
        sessionId,
        membershipId: headId,
        status: "on_time",
      },
      makeHrActor()
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/committee head/i);

    const allowed = await setSessionMemberAttendanceAsActor(
      {
        sessionId,
        membershipId: memberId,
        status: "on_time",
      },
      makeHrActor()
    );
    expect(allowed.ok).toBe(true);
  });

  it("blocks hr_member from toggling HR task completion points for committee_head while allowing regular members", async () => {
    const blocked = await toggleTaskCompletionAsActor(
      {
        submissionId: headTaskSubmissionId,
        completed: true,
      },
      makeHrActor()
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/committee head/i);

    const allowed = await toggleTaskCompletionAsActor(
      {
        submissionId: memberTaskSubmissionId,
        completed: true,
      },
      makeHrActor()
    );
    expect(allowed.ok).toBe(true);
  });
});
