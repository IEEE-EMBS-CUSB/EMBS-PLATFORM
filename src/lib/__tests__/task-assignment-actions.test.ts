import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { createTaskAsActor } from "@/services/hr-ops/tasks.service";

describe("Task Assignment Actions (Database-backed Groups & Individuals)", () => {
  const createdTaskIds: string[] = [];

  afterEach(async () => {
    for (const taskId of createdTaskIds.splice(0)) {
      await db
        .delete(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, taskId));
      await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
    }
  });

  it("assigns task to a specific person and verifies task_submission in DB", async () => {
    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    const title = `Individual Task ${Date.now()}`;
    const result = await createTaskAsActor(
      {
        title,
        description: "Assigned specifically to Omar",
        dueAt: "2026-12-25",
        maxPoints: 50,
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBe(1);
    createdTaskIds.push(result.taskId!);

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, result.taskId!));
    expect(task).toBeDefined();
    expect(task.title).toBe(title);

    const [sub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, task.id));
    expect(sub).toBeDefined();
    expect(sub.membershipId).toBe(omar.id);
  });

  it("assigns task to a group: all heads across the chapter", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));

    const title = `Leadership All Heads Task ${Date.now()}`;
    const result = await createTaskAsActor(
      {
        title,
        description: "Assigned to all committee heads",
        dueAt: "2026-12-30",
        maxPoints: 100,
        targetType: "group",
        targetGroup: "all_heads",
      },
      { profile: { role: "director", committeeId: null, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);
    createdTaskIds.push(result.taskId!);

    const heads = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          eq(schema.rosterMemberships.role, "committee_head"),
          eq(schema.rosterMemberships.isActive, true)
        )
      );

    const headIds = heads.map((h) => h.id);
    const submissions = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, result.taskId!));

    expect(submissions.length).toBe(heads.length);
    for (const sub of submissions) {
      expect(headIds).toContain(sub.membershipId);
    }
  });

  it("assigns task to a committee group: committee_members for a specific committee", async () => {
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

    const title = `Robotics Members Sprint Task ${Date.now()}`;
    const result = await createTaskAsActor(
      {
        title,
        description: "Assigned to Robotics committee members",
        dueAt: "2026-12-28",
        maxPoints: 80,
        targetType: "group",
        targetGroup: "committee_members",
        targetCommitteeId: robotics.id,
      },
      { profile: { role: "committee_head", committeeId: robotics.id, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);
    createdTaskIds.push(result.taskId!);

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, result.taskId!));
    expect(task.committeeId).toBe(robotics.id);

    const roboticsMembers = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          eq(schema.rosterMemberships.committeeId, robotics.id),
          eq(schema.rosterMemberships.role, "member"),
          eq(schema.rosterMemberships.isActive, true)
        )
      );
    const roboticsMemberIds = roboticsMembers.map((m) => m.id);

    const submissions = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, task.id));

    expect(submissions.length).toBe(roboticsMemberIds.length);
    for (const sub of submissions) {
      expect(roboticsMemberIds).toContain(sub.membershipId);
    }
  });

  it("assigns task to 'everyone' by master_admin while excluding attendees", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));

    const title = `All-Chapter Mandatory Survey ${Date.now()}`;
    const result = await createTaskAsActor(
      {
        title,
        description: "Assigned to everyone in the season",
        dueAt: "2026-12-31",
        maxPoints: 20,
        targetType: "group",
        targetGroup: "everyone",
      },
      { profile: { role: "master_admin", committeeId: null, id: "test" } }
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);
    createdTaskIds.push(result.taskId!);

    const activeMembers = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          eq(schema.rosterMemberships.isActive, true),
          ne(schema.rosterMemberships.role, "attendee")
        )
      );

    expect(result.assignedCount).toBe(activeMembers.length);
  });

  it("rejects unauthorized task creation by regular member", async () => {
    const result = await createTaskAsActor(
      {
        title: "Malicious Member Task",
        dueAt: "2026-12-31",
        targetType: "group",
        targetGroup: "everyone",
      },
      { profile: { role: "member", committeeId: null, id: "test" } }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("rejects committee head attempting to assign cross-chapter group", async () => {
    const result = await createTaskAsActor(
      {
        title: "Illegal Head Broadcast",
        dueAt: "2026-12-31",
        targetType: "group",
        targetGroup: "everyone",
      },
      { profile: { role: "committee_head", committeeId: "some-comm-id", id: "test" } }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot assign/i);
  });

  it("enforces Assignments vs Tasks workType rules across director, head, hr_member, hr_admin, and master_admin", async () => {
    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    // Committee Head cannot create a 'task' (only 'assignment')
    const headTask = await createTaskAsActor(
      {
        title: "Illegal Head HR Task",
        dueAt: "2026-12-31",
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
        workType: "task",
      },
      { profile: { role: "committee_head", committeeId: omar.committeeId, id: "test-head" } }
    );
    expect(headTask.ok).toBe(false);
    expect(headTask.error).toMatch(/assignment/i);

    // Director cannot create a 'task' (only 'assignment')
    const dirTask = await createTaskAsActor(
      {
        title: "Illegal Director HR Task",
        dueAt: "2026-12-31",
        targetType: "group",
        targetGroup: "all_heads",
        workType: "task",
      },
      { profile: { role: "director", committeeId: null, id: "test-dir" } }
    );
    expect(dirTask.ok).toBe(false);
    expect(dirTask.error).toMatch(/assignment/i);

    // HR Member cannot create an 'assignment' (only 'task')
    const hrAssignment = await createTaskAsActor(
      {
        title: "Illegal HR Assignment",
        dueAt: "2026-12-31",
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
        workType: "assignment",
      },
      { profile: { role: "hr_member", committeeId: omar.committeeId, id: "test-hr" } }
    );
    expect(hrAssignment.ok).toBe(false);
    expect(hrAssignment.error).toMatch(/task/i);

    // HR Member CAN create a 'task' for their committee
    const hrTask = await createTaskAsActor(
      {
        title: `HR Committee Task ${Date.now()}`,
        dueAt: "2026-12-31",
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
        workType: "task",
      },
      { profile: { role: "hr_member", committeeId: omar.committeeId, id: "test-hr" } }
    );
    expect(hrTask.ok).toBe(true);
    createdTaskIds.push(hrTask.taskId!);

    const [storedHrTask] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, hrTask.taskId!));
    expect(storedHrTask.workType).toBe("task");

    // HR Admin CAN create both 'assignment' and 'task'
    const [laila] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.role, "hr_member"))
      .limit(1);
    expect(laila).toBeDefined();

    const hrAdminAssignment = await createTaskAsActor(
      {
        title: `HR Admin Assignment ${Date.now()}`,
        dueAt: "2026-12-31",
        targetType: "specific_person",
        assignedToMembershipId: laila.id,
        workType: "assignment",
      },
      { profile: { role: "hr_admin", committeeId: null, id: "test-hr-admin" } }
    );
    expect(hrAdminAssignment.ok).toBe(true);
    createdTaskIds.push(hrAdminAssignment.taskId!);
    const [storedAdminAssignment] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, hrAdminAssignment.taskId!));
    expect(storedAdminAssignment.workType).toBe("assignment");
  });
});
