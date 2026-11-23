import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { canGradeWorkSubmission } from "@/lib/permissions";
import { computeHrActionableWorkCount } from "@/services/notifications.service";
import {
  createTaskAsActor,
  gradeTaskSubmissionAsActor,
  toggleTaskCompletionAsActor,
} from "@/services/hr-ops/tasks.service";

describe("Multi-hat self-grading and self-verification prevention", () => {
  const createdTaskIds: string[] = [];
  const createdMembershipIds: string[] = [];
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    for (const taskId of createdTaskIds.splice(0)) {
      const subs = await db
        .select({ id: schema.taskSubmissions.id })
        .from(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, taskId));
      if (subs.length > 0) {
        await db.delete(schema.scoreLedger).where(
          inArray(
            schema.scoreLedger.sourceId,
            subs.map((s) => s.id)
          )
        );
      }
      await db
        .delete(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, taskId));
      await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
    }
    for (const id of createdMembershipIds.splice(0)) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, id));
    }
    for (const id of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, id));
    }
  });

  it("blocks grading in canGradeWorkSubmission when actor and submission share personId across different hats", () => {
    const allowed = canGradeWorkSubmission({
      actor: {
        id: "hat-director",
        personId: "person-shared-1",
        email: "dual@cu.edu.eg",
        role: "director",
        committeeId: null,
      },
      workType: "assignment",
      taskCommitteeId: "comm-ai",
      submissionMembershipId: "hat-member",
      submissionPersonId: "person-shared-1",
      memberRole: "member",
      memberCommitteeId: "comm-ai",
    });

    expect(allowed).toBe(false);

    // A different person with the exact same role can grade that submission
    const allowedForPeer = canGradeWorkSubmission({
      actor: {
        id: "hat-other-director",
        personId: "person-other-2",
        email: "peer@cu.edu.eg",
        role: "director",
        committeeId: null,
      },
      workType: "assignment",
      taskCommitteeId: "comm-ai",
      submissionMembershipId: "hat-member",
      submissionPersonId: "person-shared-1",
      memberRole: "member",
      memberCommitteeId: "comm-ai",
    });

    expect(allowedForPeer).toBe(true);
  });

  it("excludes same-person other-hat submissions from HR actionable badge counts", () => {
    const count = computeHrActionableWorkCount({
      actor: {
        id: "hat-hr-member",
        personId: "person-dual-1",
        email: "dual@cu.edu.eg",
        role: "hr_member",
        committeeId: "comm-hr",
        trackedCommitteeId: "comm-ai",
      },
      submissions: [
        {
          submissionId: "sub-own-other-hat",
          membershipId: "hat-ai-member",
          personId: "person-dual-1",
          workType: "task",
          completionMode: "hr_only",
          taskCommitteeId: "comm-ai",
          memberCommitteeId: "comm-ai",
          submittedAt: null,
          gradedAt: null,
        },
        {
          submissionId: "sub-teammate",
          membershipId: "hat-teammate",
          personId: "person-other-2",
          workType: "task",
          completionMode: "hr_only",
          taskCommitteeId: "comm-ai",
          memberCommitteeId: "comm-ai",
          submittedAt: null,
          gradedAt: null,
        },
      ],
      directorTrackCommitteeIds: null,
    });

    expect(count).toBe(1);
  });

  it("refuses grading and HR-only verification across two hats owned by the same person in Postgres", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    const [aiComm] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.seasonId, activeSeason.id),
          eq(schema.committees.slug, "ai-and-machine-learning")
        )
      )
      .limit(1);
    const [hrComm] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.seasonId, activeSeason.id),
          eq(schema.committees.slug, "human-resources")
        )
      )
      .limit(1);

    expect(activeSeason).toBeDefined();
    expect(aiComm).toBeDefined();
    expect(hrComm).toBeDefined();

    // Create one human who holds TWO hats:
    // 1) member in AI committee
    // 2) hr_member tracking AI committee (and also test with a director hat!)
    const [dualPerson] = await db
      .insert(schema.persons)
      .values({
        email: `multihat-selfgrade-${Date.now()}@cu.edu.eg`,
        fullName: "Dual Hat Tester",
        mustChangePassword: false,
        isActive: true,
      })
      .returning();
    createdPersonIds.push(dualPerson.id);

    const [peerPerson] = await db
      .insert(schema.persons)
      .values({
        email: `multihat-peer-${Date.now()}@cu.edu.eg`,
        fullName: "Peer Grader",
        mustChangePassword: false,
        isActive: true,
      })
      .returning();
    createdPersonIds.push(peerPerson.id);

    const [memberHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeason.id,
        personId: dualPerson.id,
        committeeId: aiComm.id,
        role: "member",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(memberHat.id);

    const [directorHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeason.id,
        personId: dualPerson.id,
        committeeId: null,
        role: "director",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(directorHat.id);

    const [hrMemberHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeason.id,
        personId: dualPerson.id,
        committeeId: hrComm.id,
        trackedCommitteeId: aiComm.id,
        role: "hr_member",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(hrMemberHat.id);

    const [peerDirectorHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeason.id,
        personId: peerPerson.id,
        committeeId: null,
        role: "director",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(peerDirectorHat.id);

    const [peerHrMemberHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeason.id,
        personId: peerPerson.id,
        committeeId: hrComm.id,
        trackedCommitteeId: aiComm.id,
        role: "hr_member",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(peerHrMemberHat.id);

    // 1. Assignment assigned to memberHat
    const assignRes = await createTaskAsActor(
      {
        title: `Self-Grade Guard Assignment ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 50,
        workType: "assignment",
        targetType: "specific_person",
        assignedToMembershipId: memberHat.id,
      },
      { profile: { id: peerDirectorHat.id, personId: peerPerson.id, role: "director", committeeId: null } }
    );
    expect(assignRes.ok).toBe(true);
    createdTaskIds.push(assignRes.taskId!);

    const [assignSub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, assignRes.taskId!),
          eq(schema.taskSubmissions.membershipId, memberHat.id)
        )
      )
      .limit(1);
    expect(assignSub).toBeDefined();

    // Same person using directorHat MUST be blocked from grading memberHat's submission
    const selfGrade = await gradeTaskSubmissionAsActor(
      {
        submissionId: assignSub.id,
        effortScore: 5,
        qualityScore: 5,
        timelinessScore: 5,
      },
      {
        profile: {
          id: directorHat.id,
          personId: dualPerson.id,
          role: "director",
          committeeId: null,
        },
      }
    );
    expect(selfGrade.ok).toBe(false);
    expect(selfGrade.error).toMatch(/cannot grade your own/i);

    // Even if a caller omits personId on actor.profile, DB lookup on actor.profile.id still blocks it!
    const selfGradeWithoutPersonId = await gradeTaskSubmissionAsActor(
      {
        submissionId: assignSub.id,
        effortScore: 5,
        qualityScore: 5,
        timelinessScore: 5,
      },
      {
        profile: {
          id: directorHat.id,
          role: "director",
          committeeId: null,
        },
      }
    );
    expect(selfGradeWithoutPersonId.ok).toBe(false);
    expect(selfGradeWithoutPersonId.error).toMatch(/cannot grade your own/i);

    // A DIFFERENT person with the exact same director role CAN grade it (proves refusal was self-grading)
    const peerGrade = await gradeTaskSubmissionAsActor(
      {
        submissionId: assignSub.id,
        effortScore: 4,
        qualityScore: 5,
        timelinessScore: 4,
      },
      {
        profile: {
          id: peerDirectorHat.id,
          personId: peerPerson.id,
          role: "director",
          committeeId: null,
        },
      }
    );
    expect(peerGrade.ok).toBe(true);

    // 2. HR-only task assigned to memberHat
    const hrTaskRes = await createTaskAsActor(
      {
        title: `Self-Verify Guard HR Task ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 20,
        workType: "task",
        completionMode: "hr_only",
        targetType: "specific_person",
        assignedToMembershipId: memberHat.id,
      },
      {
        profile: {
          id: peerHrMemberHat.id,
          personId: peerPerson.id,
          role: "hr_member",
          committeeId: hrComm.id,
          trackedCommitteeId: aiComm.id,
        },
      }
    );
    expect(hrTaskRes.ok).toBe(true);
    createdTaskIds.push(hrTaskRes.taskId!);

    const [taskSub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, hrTaskRes.taskId!),
          eq(schema.taskSubmissions.membershipId, memberHat.id)
        )
      )
      .limit(1);
    expect(taskSub).toBeDefined();

    // Same person using hrMemberHat MUST be blocked from verifying memberHat's HR-only task
    const selfVerify = await toggleTaskCompletionAsActor(
      { submissionId: taskSub.id, completed: true },
      {
        profile: {
          id: hrMemberHat.id,
          personId: dualPerson.id,
          role: "hr_member",
          committeeId: hrComm.id,
          trackedCommitteeId: aiComm.id,
        },
      }
    );
    expect(selfVerify.ok).toBe(false);
    expect(selfVerify.error).toMatch(/cannot verify your own/i);

    // Peer hr_member CAN verify it
    const peerVerify = await toggleTaskCompletionAsActor(
      { submissionId: taskSub.id, completed: true },
      {
        profile: {
          id: peerHrMemberHat.id,
          personId: peerPerson.id,
          role: "hr_member",
          committeeId: hrComm.id,
          trackedCommitteeId: aiComm.id,
        },
      }
    );
    expect(peerVerify.ok).toBe(true);
  });
});
