import { afterEach, describe, expect, it } from "vitest";
import {
  createTaskAsActor,
  submitMemberTask,
  toggleMemberTaskCompletion,
} from "@/services/hr-ops/tasks.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

const MASTER = {
  profile: { id: "master-test", role: "master_admin" as const, committeeId: null },
};

async function loadFixtures() {
  const [season] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.status, "active"))
    .limit(1);
  if (!season) return { season: null, first: null, other: null };

  const activeMembers = await db
    .select({
      id: schema.rosterMemberships.id,
      personId: schema.rosterMemberships.personId,
      committeeId: schema.rosterMemberships.committeeId,
    })
    .from(schema.rosterMemberships)
    .innerJoin(
      schema.persons,
      eq(schema.rosterMemberships.personId, schema.persons.id)
    )
    .where(
      and(
        eq(schema.rosterMemberships.seasonId, season.id),
        eq(schema.rosterMemberships.isActive, true),
        eq(schema.persons.isActive, true),
        ne(schema.rosterMemberships.role, "attendee")
      )
    )
    .limit(10);

  const first = activeMembers[0] ?? null;
  const other =
    activeMembers.find((m) => first && m.personId !== first.personId) ?? null;
  return { season, first, other };
}

describe("Member task checkbox completion & assignment link submission", () => {
  const createdTaskIds: string[] = [];

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
  });

  it("awards full task points when self-reported and refuses hr_only self-check or unassigned members", async () => {
    const { first, other } = await loadFixtures();
    if (!first || !other) return;

    const created = await createTaskAsActor(
      {
        title: `Checkbox Task ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 15,
        workType: "task",
        completionMode: "self_report",
        targetType: "specific_person",
        assignedToMembershipId: first.id,
      },
      MASTER
    );
    expect(created.ok).toBe(true);
    createdTaskIds.push(created.taskId!);

    // A member the task was never assigned to is refused (task itself exists)
    const intruder = await toggleMemberTaskCompletion(
      { taskId: created.taskId!, completed: true },
      other.id
    );
    expect(intruder.ok).toBe(false);

    // Assigned member self-checks -> awards 15 pts
    const done = await toggleMemberTaskCompletion(
      { taskId: created.taskId!, completed: true },
      first.id
    );
    expect(done.ok).toBe(true);
    expect(done.totalPoints).toBe(15);

    const [sub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, created.taskId!),
          eq(schema.taskSubmissions.membershipId, first.id)
        )
      );
    expect(sub.totalPoints).toBe(15);
    expect(sub.gradedAt).not.toBeNull();

    // HR-only task refuses member self-check
    const hrOnly = await createTaskAsActor(
      {
        title: `HR-Only Task ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 15,
        workType: "task",
        completionMode: "hr_only",
        targetType: "specific_person",
        assignedToMembershipId: first.id,
      },
      MASTER
    );
    expect(hrOnly.ok).toBe(true);
    createdTaskIds.push(hrOnly.taskId!);

    const refused = await toggleMemberTaskCompletion(
      { taskId: hrOnly.taskId!, completed: true },
      first.id
    );
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/hr only/i);
  });

  it("refuses checkbox completion for assignments and link submission for tasks", async () => {
    const { first } = await loadFixtures();
    if (!first) return;

    const assignment = await createTaskAsActor(
      {
        title: `Link Assignment ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 40,
        workType: "assignment",
        targetType: "specific_person",
        assignedToMembershipId: first.id,
      },
      MASTER
    );
    const task = await createTaskAsActor(
      {
        title: `Self Check Task ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 10,
        workType: "task",
        targetType: "specific_person",
        assignedToMembershipId: first.id,
      },
      MASTER
    );
    createdTaskIds.push(assignment.taskId!, task.taskId!);

    const checkAssignment = await toggleMemberTaskCompletion(
      { taskId: assignment.taskId!, completed: true },
      first.id
    );
    expect(checkAssignment.ok).toBe(false);

    const submitTask = await submitMemberTask(
      { taskId: task.taskId!, submissionUrl: "https://example.com/x" },
      first.id
    );
    expect(submitTask.ok).toBe(false);
  });
});
