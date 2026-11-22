import { afterEach, describe, expect, it } from "vitest";
import * as seasonsActions from "@/app/hr/seasons/actions";
import * as committeesActions from "@/app/hr/committees/actions";
import * as rosterActions from "@/app/hr/roster/actions";
import * as attendanceActions from "@/app/hr/attendance/actions";
import * as tasksActions from "@/app/hr/tasks/actions";
import * as publishingActions from "@/app/hr/publishing/actions";
import { resetMemberPasswordAsActor } from "@/services/hr-ops/roster.service";
import {
  createTaskAsActor,
  gradeTaskSubmissionAsActor,
  submitMemberTask,
} from "@/services/hr-ops/tasks.service";
import { activateSeasonAsActor } from "@/services/hr-ops/seasons.service";
import { addCommitteeAsActor } from "@/services/hr-ops/committees.service";
import { addManualLedgerEntryAsActor } from "@/services/hr-ops/ledger.service";
import { addHrFeedbackAsActor } from "@/services/hr-ops/feedback.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";

describe("Server Action Attack Surface & Core Security Invariants", () => {
  const createdSeasonIds: string[] = [];
  const createdTaskIds: string[] = [];

  afterEach(async () => {
    for (const taskId of createdTaskIds.splice(0)) {
      await db
        .delete(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, taskId));
      await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
    }
    for (const seasonId of createdSeasonIds.splice(0)) {
      await db.delete(schema.seasons).where(eq(schema.seasons.id, seasonId));
    }
  });

  it("never exports *AsActor bypass functions from any 'use server' module", () => {
    const modules = {
      seasons: seasonsActions,
      committees: committeesActions,
      roster: rosterActions,
      attendance: attendanceActions,
      tasks: tasksActions,
      publishing: publishingActions,
    };

    for (const [name, mod] of Object.entries(modules)) {
      const dangerousExports = Object.keys(mod).filter(
        (key) =>
          key.endsWith("AsActor") ||
          key === "getDraftSnapshotForPage" ||
          key === "getAvailableMonthsForPublishing"
      );
      expect(
        dangerousExports,
        `Module ${name}/actions.ts must not export unauthenticated helpers`
      ).toEqual([]);
    }
  });

  it("blocks unauthenticated callers in memberCheckinAction (no client membershipId IDOR)", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
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
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          eq(schema.persons.email, "omar.tarek@cu.edu.eg")
        )
      )
      .limit(1);

    expect(omar).toBeDefined();

    const res = await attendanceActions.memberCheckinAction("123456", omar.id);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unauthorized|sign in/i);
  });

  it("blocks hr_admin from resetting master_admin or director passwords (privilege escalation)", async () => {
    const [master] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.role, "master_admin"))
      .limit(1);
    expect(master).toBeDefined();

    const res = await resetMemberPasswordAsActor(master.id, {
      profile: { role: "hr_admin" },
    });
    expect(res.ok).toBe(false);
    expect(res.tempPassword).toBe("");
    expect(res.error).toMatch(/unauthorized/i);
  });

  it("blocks cross-committee task grading and javascript: XSS submission URLs", async () => {
    const [omar] = await db
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
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"))
      .limit(1);
    const [ai] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.slug, "ai-and-machine-learning"))
      .limit(1);
    expect(omar).toBeDefined();
    expect(ai).toBeDefined();

    const created = await createTaskAsActor(
      {
        title: `Security Grading Test ${Date.now()}`,
        dueAt: "2026-12-30",
        maxPoints: 50,
        targetType: "specific_person",
        assignedToMembershipId: omar.id,
      },
      { profile: { id: "head-1", role: "committee_head", committeeId: omar.committeeId } }
    );
    expect(created.ok).toBe(true);
    createdTaskIds.push(created.taskId!);

    const [sub] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.taskId, created.taskId!));
    expect(sub).toBeDefined();

    // Another committee's head cannot grade Omar's submission
    const otherCommId = omar.committeeId === ai.id ? "00000000-0000-4000-8000-000000000001" : ai.id;
    const gradeCross = await gradeTaskSubmissionAsActor(
      { submissionId: sub.id, effortScore: 5, qualityScore: 5, timelinessScore: 5 },
      { profile: { id: "head-other", role: "committee_head", committeeId: otherCommId } }
    );
    expect(gradeCross.ok).toBe(false);
    expect(gradeCross.error).toMatch(/unauthorized/i);

    // Out-of-range scores rejected
    const badScore = await gradeTaskSubmissionAsActor(
      { submissionId: sub.id, effortScore: 99, qualityScore: -5, timelinessScore: 3 },
      { profile: { id: "head-1", role: "committee_head", committeeId: omar.committeeId } }
    );
    expect(badScore.ok).toBe(false);

    // XSS javascript: URL rejected
    const xssSubmit = await submitMemberTask(
      { taskId: created.taskId!, submissionUrl: "javascript:alert(1)" },
      omar.id
    );
    expect(xssSubmit.ok).toBe(false);
    expect(xssSubmit.error).toMatch(/http/i);
  });

  it("enforces archived season immutability (no re-activation, no committee mutation)", async () => {
    const [archivedSeason] = await db
      .insert(schema.seasons)
      .values({
        name: `Archived Immutable Test ${Date.now()}`,
        status: "archived",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-06-01"),
      })
      .returning();
    createdSeasonIds.push(archivedSeason.id);

    const reactivate = await activateSeasonAsActor(archivedSeason.id, {
      profile: { role: "master_admin" },
    });
    expect(reactivate.ok).toBe(false);
    expect(reactivate.error).toMatch(/archived/i);

    const addComm = await addCommitteeAsActor(
      { name: "Illegal Archived Committee", category: "technical", seasonId: archivedSeason.id },
      { profile: { role: "master_admin" } }
    );
    expect(addComm.ok).toBe(false);
    expect(addComm.error).toMatch(/archived/i);
  });

  it("blocks self-awarding in ledger and private warnings from committee_head", async () => {
    const [omar] = await db
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
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"))
      .limit(1);
    expect(omar).toBeDefined();

    // Self-awarding rejected
    const selfAward = await addManualLedgerEntryAsActor(
      { membershipId: omar.id, points: 50, month: "2099-02", reason: "Self bonus" },
      { profile: { id: omar.id, role: "committee_head", committeeId: omar.committeeId } }
    );
    expect(selfAward.ok).toBe(false);
    expect(selfAward.error).toMatch(/yourself/i);

    // Committee head cannot issue private HR warning
    const headWarning = await addHrFeedbackAsActor(
      { membershipId: omar.id, content: "Private warning", isWarning: true },
      { profile: { id: "head-1", role: "committee_head", committeeId: omar.committeeId } }
    );
    expect(headWarning.ok).toBe(false);
    expect(headWarning.error).toMatch(/unauthorized/i);
  });
});
