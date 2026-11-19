import { describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTaskAction } from "@/app/hr/tasks/actions";

describe("Task Assignment Actions (Database-backed Groups & Individuals)", () => {
  it("assigns task to a specific person and verifies task_submission in DB", async () => {
    // Pick an existing member from DB
    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    const title = `Individual Task ${Date.now()}`;
    const result = await createTaskAction(
      {
        title,
        description: "Assigned specifically to Omar",
        dueAt: "2026-12-25",
        maxPoints: 50,
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
      },
      "committee_head",
      omar.committeeId
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBe(1);

    // Verify task exists in DB
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, result.taskId!));
    expect(task).toBeDefined();
    expect(task.title).toBe(title);

    // Verify submission row was created for Omar
    const [sub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, task.id));
    expect(sub).toBeDefined();
    expect(sub.membershipId).toBe(omar.id);
  });

  it("assigns task to a group: all heads across the chapter", async () => {
    const title = `Leadership All Heads Task ${Date.now()}`;
    const result = await createTaskAction(
      {
        title,
        description: "Assigned to all committee heads",
        dueAt: "2026-12-30",
        maxPoints: 100,
        targetType: "group",
        targetGroup: "all_heads",
      },
      "director"
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);

    // Verify submissions were created for each committee head
    const heads = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.role, "committee_head"));

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
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "robotics-and-automation"));
    expect(robotics).toBeDefined();

    const title = `Robotics Members Sprint Task ${Date.now()}`;
    const result = await createTaskAction(
      {
        title,
        description: "Assigned to Robotics committee members",
        dueAt: "2026-12-28",
        maxPoints: 80,
        targetType: "group",
        targetGroup: "committee_members",
        targetCommitteeId: robotics.id,
      },
      "committee_head",
      robotics.id
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);

    // Verify task is scoped to robotics committee
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, result.taskId!));
    expect(task.committeeId).toBe(robotics.id);

    // Verify only robotics members received submissions
    const roboticsMembers = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        eq(schema.rosterMemberships.committeeId, robotics.id)
      );
    const roboticsMemberIds = roboticsMembers
      .filter((m) => m.role === "member")
      .map((m) => m.id);

    const submissions = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, task.id));

    expect(submissions.length).toBe(roboticsMemberIds.length);
    for (const sub of submissions) {
      expect(roboticsMemberIds).toContain(sub.membershipId);
    }
  });

  it("assigns task to 'everyone' by master_admin", async () => {
    const title = `All-Chapter Mandatory Survey ${Date.now()}`;
    const result = await createTaskAction(
      {
        title,
        description: "Assigned to everyone in the season",
        dueAt: "2026-12-31",
        maxPoints: 20,
        targetType: "group",
        targetGroup: "everyone",
      },
      "master_admin"
    );

    expect(result.ok).toBe(true);
    expect(result.assignedCount).toBeGreaterThanOrEqual(1);

    const activeMembers = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.isActive, true));

    expect(result.assignedCount).toBe(activeMembers.length);
  });

  it("rejects unauthorized task creation by regular member", async () => {
    const result = await createTaskAction(
      {
        title: "Malicious Member Task",
        dueAt: "2026-12-31",
        targetType: "group",
        targetGroup: "everyone",
      },
      "member"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it("rejects committee head attempting to assign cross-chapter group", async () => {
    const result = await createTaskAction(
      {
        title: "Illegal Head Broadcast",
        dueAt: "2026-12-31",
        targetType: "group",
        targetGroup: "everyone",
      },
      "committee_head",
      "some-comm-id"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot assign tasks across all committees/i);
  });
});
