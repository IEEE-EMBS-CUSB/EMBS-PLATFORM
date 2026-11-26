import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  addRosterMemberAsActor,
  assignHrTrackedCommitteesAsActor,
} from "@/services/hr-ops/roster.service";
import { ensureHrCommitteeForSeason } from "@/services/hr-ops/committees.service";
import { cloneSeasonAsActor } from "@/services/hr-ops/seasons.service";
import {
  createTaskAsActor,
  gradeTaskSubmissionAsActor,
} from "@/services/hr-ops/tasks.service";
import {
  listEligibleContextsForPerson,
  validateMembershipSwitch,
} from "@/services/context.service";
import { getOperationalUserProfile } from "@/services/member.service";
import { canViewWorkSubmission } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";
import type { ActorContext } from "@/lib/action-auth";

const RUN_ID = `multi-hr-${Date.now()}`;

describe("HR member multi-committee tracking & read-only assignment visibility (real Postgres)", () => {
  let seasonId: string;
  let clonedSeasonId: string | null = null;
  let hrCommId: string;
  let commAiId: string;
  let commRoboticsId: string;
  let commWebId: string;
  let masterActor: ActorContext;
  let hrAdminActor: ActorContext;
  let headAiActor: ActorContext;
  let aiMemberMembershipId: string;
  let aiMemberPersonId: string;
  const createdPersonIds: string[] = [];
  const createdCommitteeIds: string[] = [];
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Reuse the existing active season in embs_portal_test (parallel-safe, never archives shared seasons)
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) {
      throw new Error("Expected an active seeded season in embs_portal_test.");
    }
    seasonId = activeSeason.id;

    const hrComm = await ensureHrCommitteeForSeason(seasonId);
    hrCommId = hrComm.id;

    const [commAi, commRobotics, commWeb] = await db
      .insert(schema.committees)
      .values([
        {
          seasonId,
          name: `AI Track ${RUN_ID}`,
          slug: `ai-ml-${RUN_ID}`,
          category: "technical",
          isActive: true,
        },
        {
          seasonId,
          name: `Robotics Track ${RUN_ID}`,
          slug: `robotics-${RUN_ID}`,
          category: "technical",
          isActive: true,
        },
        {
          seasonId,
          name: `Web Track ${RUN_ID}`,
          slug: `web-${RUN_ID}`,
          category: "technical",
          isActive: true,
        },
      ])
      .returning();

    commAiId = commAi.id;
    commRoboticsId = commRobotics.id;
    commWebId = commWeb.id;
    createdCommitteeIds.push(commAiId, commRoboticsId, commWebId);

    const pwHash = hashPassword("TestPass123!");
    const [masterPerson, hrAdminPerson, headAiPerson, memberAiPerson] = await db
      .insert(schema.persons)
      .values([
        {
          email: `master-${RUN_ID}@cu.edu.eg`,
          fullName: "Master Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `hradmin-${RUN_ID}@cu.edu.eg`,
          fullName: "HR Admin Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `headai-${RUN_ID}@cu.edu.eg`,
          fullName: "Head AI Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `memberai-${RUN_ID}@cu.edu.eg`,
          fullName: "Member AI Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
      ])
      .returning();

    createdPersonIds.push(
      masterPerson.id,
      hrAdminPerson.id,
      headAiPerson.id,
      memberAiPerson.id
    );
    aiMemberPersonId = memberAiPerson.id;

    const [masterMem, hrAdminMem, headAiMem, memberAiMem] = await db
      .insert(schema.rosterMemberships)
      .values([
        {
          seasonId,
          personId: masterPerson.id,
          role: "master_admin",
          committeeId: null,
          isActive: true,
        },
        {
          seasonId,
          personId: hrAdminPerson.id,
          role: "hr_admin",
          committeeId: hrCommId,
          isActive: true,
        },
        {
          seasonId,
          personId: headAiPerson.id,
          role: "committee_head",
          committeeId: commAiId,
          isActive: true,
        },
        {
          seasonId,
          personId: memberAiPerson.id,
          role: "member",
          committeeId: commAiId,
          isActive: true,
        },
      ])
      .returning();

    aiMemberMembershipId = memberAiMem.id;

    masterActor = {
      sessionId: "sess-master",
      personId: masterPerson.id,
      participantId: masterMem.id,
      profile: {
        id: masterMem.id,
        personId: masterPerson.id,
        fullName: masterPerson.fullName,
        email: masterPerson.email,
        role: "master_admin",
        committeeId: null,
        trackedCommitteeId: null,
        managedTrackId: null,
        seasonId,
      },
    };

    hrAdminActor = {
      sessionId: "sess-hradmin",
      personId: hrAdminPerson.id,
      participantId: hrAdminMem.id,
      profile: {
        id: hrAdminMem.id,
        personId: hrAdminPerson.id,
        fullName: hrAdminPerson.fullName,
        email: hrAdminPerson.email,
        role: "hr_admin",
        committeeId: hrCommId,
        trackedCommitteeId: null,
        managedTrackId: null,
        seasonId,
      },
    };

    headAiActor = {
      sessionId: "sess-headai",
      personId: headAiPerson.id,
      participantId: headAiMem.id,
      profile: {
        id: headAiMem.id,
        personId: headAiPerson.id,
        fullName: headAiPerson.fullName,
        email: headAiPerson.email,
        role: "committee_head",
        committeeId: commAiId,
        trackedCommitteeId: null,
        managedTrackId: null,
        seasonId,
      },
    };
  });

  afterAll(async () => {
    if (clonedSeasonId) {
      await db
        .delete(schema.seasons)
        .where(eq(schema.seasons.id, clonedSeasonId));
    }
    if (createdTaskIds.length > 0) {
      await db
        .delete(schema.tasks)
        .where(inArray(schema.tasks.id, createdTaskIds));
    }
    if (createdPersonIds.length > 0) {
      await db
        .delete(schema.rosterMemberships)
        .where(inArray(schema.rosterMemberships.personId, createdPersonIds));
      await db
        .delete(schema.persons)
        .where(inArray(schema.persons.id, createdPersonIds));
    }
    if (createdCommitteeIds.length > 0) {
      await db
        .delete(schema.committees)
        .where(inArray(schema.committees.id, createdCommitteeIds));
    }
  });

  it("tracks multiple committees on a single hr_member membership, switches hats safely, clones across seasons, and keeps assignments read-only", async () => {
    // 1. Add ONE hr_member assigned to BOTH AI & ML and Robotics
    const addRes = await addRosterMemberAsActor(
      {
        fullName: "Nourhan Multi HR",
        email: `nourhan-hr-${RUN_ID}@cu.edu.eg`,
        role: "hr_member",
        trackedCommitteeIds: [commAiId, commRoboticsId],
      },
      masterActor
    );
    expect(addRes.ok).toBe(true);
    const hrMemberId = addRes.memberId!;
    const hrPersonId = addRes.personId!;
    createdPersonIds.push(hrPersonId);

    // Must be strictly ONE roster_memberships row in Human Resources
    const memberships = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.personId, hrPersonId));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].committeeId).toBe(hrCommId);

    const joinRows = await db
      .select()
      .from(schema.hrMemberTrackedCommittees)
      .where(eq(schema.hrMemberTrackedCommittees.membershipId, hrMemberId));
    expect(joinRows.map((r) => r.committeeId).sort()).toEqual(
      [commAiId, commRoboticsId].sort()
    );

    // 2. Context service exposes both tracked committees on that single membership hat
    const eligible = await listEligibleContextsForPerson(hrPersonId);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].trackedCommittees?.map((c) => c.id)).toEqual([
      commAiId,
      commRoboticsId,
    ]);

    // 3. Valid switch to Robotics succeeds; unassigned Web Development is FORBIDDEN
    const okSwitch = await validateMembershipSwitch(
      hrPersonId,
      hrMemberId,
      commRoboticsId
    );
    expect(okSwitch.ok).toBe(true);
    if (okSwitch.ok) {
      expect(okSwitch.context.trackedCommitteeId).toBe(commRoboticsId);
      expect(okSwitch.context.trackedCommitteeName).toBe(
        `Robotics Track ${RUN_ID}`
      );
    }

    const forbiddenSwitch = await validateMembershipSwitch(
      hrPersonId,
      hrMemberId,
      commWebId
    );
    expect(forbiddenSwitch.ok).toBe(false);

    // 4. getOperationalUserProfile resolves active tracked committee from session choice
    const profileRobotics = await getOperationalUserProfile(
      hrMemberId,
      commRoboticsId
    );
    expect(profileRobotics?.trackedCommitteeId).toBe(commRoboticsId);
    expect(profileRobotics?.trackedCommitteeName).toBe(
      `Robotics Track ${RUN_ID}`
    );
    expect(profileRobotics?.trackedCommitteeIds).toEqual([
      commAiId,
      commRoboticsId,
    ]);

    const profileAi = await getOperationalUserProfile(hrMemberId, commAiId);
    expect(profileAi?.trackedCommitteeId).toBe(commAiId);
    expect(profileAi?.trackedCommitteeName).toBe(`AI Track ${RUN_ID}`);

    // 5. Committee Head creates an assignment for AI & ML members -> HR Member can view it read-only, NOT create/grade
    const assignRes = await createTaskAsActor(
      {
        title: "Build Classifier Baseline",
        workType: "assignment",
        targetType: "group",
        targetGroup: "committee_members",
        targetCommitteeId: commAiId,
        dueAt: "2026-12-01",
        maxPoints: 50,
      },
      headAiActor
    );
    expect(assignRes.ok).toBe(true);
    createdTaskIds.push(assignRes.taskId!);

    const [memberSub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, assignRes.taskId!));
    expect(memberSub?.membershipId).toBe(aiMemberMembershipId);

    const hrOnAiActor: ActorContext = {
      sessionId: "sess-hr-ai",
      personId: hrPersonId,
      participantId: hrMemberId,
      profile: profileAi!,
    };

    // Read-only view allowed for AI member's assignment when holding AI hat, hidden when holding Robotics hat
    expect(
      canViewWorkSubmission({
        actor: profileAi!,
        workType: "assignment",
        taskCommitteeId: commAiId,
        submissionMembershipId: aiMemberMembershipId,
        submissionPersonId: aiMemberPersonId,
        memberRole: "member",
        memberCommitteeId: commAiId,
      })
    ).toBe(true);
    expect(
      canViewWorkSubmission({
        actor: profileRobotics!,
        workType: "assignment",
        taskCommitteeId: commAiId,
        submissionMembershipId: aiMemberMembershipId,
        submissionPersonId: aiMemberPersonId,
        memberRole: "member",
        memberCommitteeId: commAiId,
      })
    ).toBe(false);

    // Server actions still strictly refuse HR Member grading or creating assignments
    const gradeAttempt = await gradeTaskSubmissionAsActor(
      {
        submissionId: memberSub.id,
        effortScore: 5,
        qualityScore: 5,
        timelinessScore: 5,
      },
      hrOnAiActor
    );
    expect(gradeAttempt.ok).toBe(false);
    expect(gradeAttempt.error).toMatch(/unauthorized|only grade/i);

    const createAssignAttempt = await createTaskAsActor(
      {
        title: "Illegal HR Assignment",
        workType: "assignment",
        targetType: "group",
        targetGroup: "committee_members",
        targetCommitteeId: commAiId,
        dueAt: "2026-12-01",
        maxPoints: 20,
      },
      hrOnAiActor
    );
    expect(createAssignAttempt.ok).toBe(false);
    expect(createAssignAttempt.error).toMatch(/unauthorized|only create tasks/i);

    // 6. HR Admin updates tracked committees to Robotics + Web (ignoring HR home committee if passed);
    //    Committee Head cannot reassign HR tracked committees.
    const unauthorizedUpdate = await assignHrTrackedCommitteesAsActor(
      hrMemberId,
      [commWebId],
      headAiActor
    );
    expect(unauthorizedUpdate.ok).toBe(false);

    const updateRes = await assignHrTrackedCommitteesAsActor(
      hrMemberId,
      [commRoboticsId, commWebId, hrCommId],
      hrAdminActor
    );
    expect(updateRes.ok).toBe(true);

    const updatedJoinRows = await db
      .select()
      .from(schema.hrMemberTrackedCommittees)
      .where(eq(schema.hrMemberTrackedCommittees.membershipId, hrMemberId));
    expect(updatedJoinRows.map((r) => r.committeeId).sort()).toEqual(
      [commRoboticsId, commWebId].sort()
    );

    // 7. Cloning the season with includeRoster preserves all tracked committees in the new season
    const cloneRes = await cloneSeasonAsActor(
      seasonId,
      `Multi HR Cloned ${RUN_ID}`,
      masterActor,
      { includeRoster: true }
    );
    expect(cloneRes.ok).toBe(true);
    clonedSeasonId = cloneRes.seasonId!;

    const [clonedHrMembership] = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, clonedSeasonId),
          eq(schema.rosterMemberships.personId, hrPersonId)
        )
      );
    expect(clonedHrMembership).toBeDefined();

    const clonedTracked = await db
      .select()
      .from(schema.hrMemberTrackedCommittees)
      .where(
        eq(
          schema.hrMemberTrackedCommittees.membershipId,
          clonedHrMembership.id
        )
      );
    expect(clonedTracked).toHaveLength(2);
  });
});
