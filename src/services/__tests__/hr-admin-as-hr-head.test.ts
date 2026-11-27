import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  addRosterMemberAsActor,
  assignMemberCommitteeAsActor,
  assignMemberRoleAsActor,
} from "@/services/hr-ops/roster.service";
import { ensureHrCommitteeForSeason } from "@/services/hr-ops/committees.service";
import { createTaskAsActor } from "@/services/hr-ops/tasks.service";
import { createSessionAsActor } from "@/services/hr-ops/attendance.service";
import { hashPassword } from "@/lib/password";
import type { ActorContext } from "@/lib/action-auth";

const RUN_ID = `hr-head-${Date.now()}`;

describe("HR Admin as HR Head & Human Resources committee role exclusivity (real Postgres)", () => {
  let seasonId: string;
  let hrCommId: string;
  let commAiId: string;
  let masterActor: ActorContext;
  let directorActor: ActorContext;
  const createdPersonIds: string[] = [];
  const createdCommitteeIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdSessionIds: string[] = [];

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

    const hrComm = await ensureHrCommitteeForSeason(seasonId);
    hrCommId = hrComm.id;

    const [commAi] = await db
      .insert(schema.committees)
      .values({
        seasonId,
        name: `AI Head Test ${RUN_ID}`,
        slug: `ai-head-test-${RUN_ID}`,
        category: "technical",
        isActive: true,
      })
      .returning();
    commAiId = commAi.id;
    createdCommitteeIds.push(commAiId);

    const pwHash = hashPassword("TestPass123!");
    const [masterPerson, directorPerson] = await db
      .insert(schema.persons)
      .values([
        {
          email: `master-${RUN_ID}@cu.edu.eg`,
          fullName: "Master HR Head Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
        {
          email: `director-${RUN_ID}@cu.edu.eg`,
          fullName: "Director HR Head Test",
          passwordHash: pwHash,
          mustChangePassword: false,
          isActive: true,
        },
      ])
      .returning();
    createdPersonIds.push(masterPerson.id, directorPerson.id);

    const [masterMem, directorMem] = await db
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
          personId: directorPerson.id,
          role: "director",
          committeeId: null,
          isActive: true,
        },
      ])
      .returning();

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

    directorActor = {
      sessionId: "sess-director",
      personId: directorPerson.id,
      participantId: directorMem.id,
      profile: {
        id: directorMem.id,
        personId: directorPerson.id,
        fullName: directorPerson.fullName,
        email: directorPerson.email,
        role: "director",
        committeeId: null,
        trackedCommitteeId: null,
        managedTrackId: null,
        seasonId,
      },
    };
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await db
        .delete(schema.branchSessions)
        .where(inArray(schema.branchSessions.id, createdSessionIds));
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

  it("auto-binds hr_admin to Human Resources, blocks member/committee_head assignment to HR, and treats hr_admin as HR Head across tasks and sessions", async () => {
    // 1. Adding hr_admin with null or another committee automatically binds them to Human Resources
    const addHrAdmin = await addRosterMemberAsActor(
      {
        fullName: "Yasmine HR Head",
        email: `hr-admin-${RUN_ID}@cu.edu.eg`,
        role: "hr_admin",
        committeeId: null,
      },
      masterActor
    );
    expect(addHrAdmin.ok).toBe(true);
    const hrAdminMemId = addHrAdmin.memberId!;
    createdPersonIds.push(addHrAdmin.personId!);

    const [hrAdminRow] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, hrAdminMemId));
    expect(hrAdminRow.committeeId).toBe(hrCommId);

    // Reassigning hr_admin away from Human Resources is refused
    const reassignHrAdmin = await assignMemberCommitteeAsActor(
      hrAdminMemId,
      commAiId,
      masterActor
    );
    expect(reassignHrAdmin.ok).toBe(false);
    expect(reassignHrAdmin.error).toMatch(/human resources/i);

    // 2. Adding a regular member or committee_head to Human Resources is refused
    const badMember = await addRosterMemberAsActor(
      {
        fullName: "Illegal HR Regular Member",
        email: `bad-member-${RUN_ID}@cu.edu.eg`,
        role: "member",
        committeeId: hrCommId,
      },
      masterActor
    );
    expect(badMember.ok).toBe(false);
    expect(badMember.error).toMatch(/hr member|hr admin/i);

    const badHead = await addRosterMemberAsActor(
      {
        fullName: "Illegal HR Committee Head",
        email: `bad-head-${RUN_ID}@cu.edu.eg`,
        role: "committee_head",
        committeeId: hrCommId,
      },
      masterActor
    );
    expect(badHead.ok).toBe(false);
    expect(badHead.error).toMatch(/hr member|hr admin/i);

    // 3. Reassigning an existing member to Human Resources is also refused,
    //    while promoting them to hr_admin binds them to Human Resources,
    //    and demoting back to member clears committeeId to null (never leaves member in HR).
    const normalMemberRes = await addRosterMemberAsActor(
      {
        fullName: "Tarek Normal",
        email: `tarek-${RUN_ID}@cu.edu.eg`,
        role: "member",
        committeeId: commAiId,
      },
      masterActor
    );
    expect(normalMemberRes.ok).toBe(true);
    const normalMemberId = normalMemberRes.memberId!;
    createdPersonIds.push(normalMemberRes.personId!);

    const badReassign = await assignMemberCommitteeAsActor(
      normalMemberId,
      hrCommId,
      masterActor
    );
    expect(badReassign.ok).toBe(false);
    expect(badReassign.error).toMatch(/hr member|hr admin/i);

    const promoteRes = await assignMemberRoleAsActor(
      normalMemberId,
      "hr_admin",
      masterActor
    );
    expect(promoteRes.ok).toBe(true);
    const [promotedRow] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, normalMemberId));
    expect(promotedRow.committeeId).toBe(hrCommId);

    const demoteRes = await assignMemberRoleAsActor(
      normalMemberId,
      "member",
      masterActor
    );
    expect(demoteRes.ok).toBe(true);
    const [demotedRow] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, normalMemberId));
    expect(demotedRow.committeeId).toBeNull();

    // 4. Add an hr_member so we can verify HR committee_heads vs committee_members
    const addHrMember = await addRosterMemberAsActor(
      {
        fullName: "Hana HR Member",
        email: `hr-mem-${RUN_ID}@cu.edu.eg`,
        role: "hr_member",
        trackedCommitteeIds: [commAiId],
      },
      masterActor
    );
    expect(addHrMember.ok).toBe(true);
    const hrMemberId = addHrMember.memberId!;
    createdPersonIds.push(addHrMember.personId!);

    // 5. Director broadcasting to all_heads includes hr_admin (HR Head)
    const allHeadsRes = await createTaskAsActor(
      {
        title: `All Heads Sync ${RUN_ID}`,
        workType: "assignment",
        targetType: "group",
        targetGroup: "all_heads",
        dueAt: "2026-12-20",
        maxPoints: 30,
      },
      directorActor
    );
    expect(allHeadsRes.ok).toBe(true);
    createdTaskIds.push(allHeadsRes.taskId!);
    const allHeadSubs = await db
      .select({ membershipId: schema.taskSubmissions.membershipId })
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, allHeadsRes.taskId!));
    expect(allHeadSubs.map((s) => s.membershipId)).toContain(hrAdminMemId);

    // 6. committee_heads targeting Human Resources resolves to hr_admin (NOT hr_member)
    const hrHeadsRes = await createTaskAsActor(
      {
        title: `HR Head Review ${RUN_ID}`,
        workType: "assignment",
        targetType: "group",
        targetGroup: "committee_heads",
        targetCommitteeId: hrCommId,
        dueAt: "2026-12-21",
        maxPoints: 25,
      },
      directorActor
    );
    expect(hrHeadsRes.ok).toBe(true);
    createdTaskIds.push(hrHeadsRes.taskId!);
    const hrHeadSubs = await db
      .select({ membershipId: schema.taskSubmissions.membershipId })
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, hrHeadsRes.taskId!));
    expect(hrHeadSubs.map((s) => s.membershipId)).toContain(hrAdminMemId);
    expect(hrHeadSubs.map((s) => s.membershipId)).not.toContain(hrMemberId);

    // 7. committee_members targeting Human Resources resolves to hr_member (NOT hr_admin)
    const hrMembersRes = await createTaskAsActor(
      {
        title: `HR Members Checklist ${RUN_ID}`,
        workType: "task",
        targetType: "group",
        targetGroup: "committee_members",
        targetCommitteeId: hrCommId,
        dueAt: "2026-12-22",
        maxPoints: 15,
      },
      masterActor
    );
    expect(hrMembersRes.ok).toBe(true);
    createdTaskIds.push(hrMembersRes.taskId!);
    const hrMemberSubs = await db
      .select({ membershipId: schema.taskSubmissions.membershipId })
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, hrMembersRes.taskId!));
    expect(hrMemberSubs.map((s) => s.membershipId)).toContain(hrMemberId);
    expect(hrMemberSubs.map((s) => s.membershipId)).not.toContain(hrAdminMemId);

    // 8. Creating a Human Resources committee session accepts hr_admin as the session instructor
    const hrSessionRes = await createSessionAsActor(
      {
        title: `HR Weekly Onboarding ${RUN_ID}`,
        committeeId: hrCommId,
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
        sessionMode: "offline",
        locationAddress: "Room 204",
        instructorMembershipIds: [hrAdminMemId],
      },
      masterActor
    );
    expect(hrSessionRes.ok).toBe(true);
    createdSessionIds.push(hrSessionRes.sessionId!);
  });
});
