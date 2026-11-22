import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getMemberActivities,
  getMemberAttendance,
  getMemberDashboard,
  getMemberEvaluations,
  getMemberFeedback,
  getMemberMonthlyScores,
  getMemberProfile,
  getMemberTasks,
  getOperationalUserProfile,
} from "@/services/member.service";

let salmaId = "";

beforeAll(async () => {
  const [salma] = await db
    .select({ id: schema.rosterMemberships.id })
    .from(schema.rosterMemberships)
    .innerJoin(
      schema.persons,
      eq(schema.rosterMemberships.personId, schema.persons.id)
    )
    .where(eq(schema.persons.email, "salma.elsayed@cu.edu.eg"));
  salmaId = salma.id;
});

describe("member.service (Database-Backed & Privacy Guarded)", () => {
  it("loads member profile, dashboard, attendance, tasks, activities, and monthly scores", async () => {
    const profile = await getMemberProfile(salmaId);
    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBe("Salma El-Sayed");
    expect(profile?.role).toBe("Head");
    expect(profile?.committee.name).toBe("AI and Machine Learning");

    const dashboard = await getMemberDashboard(salmaId);
    expect(dashboard).not.toBeNull();
    expect(dashboard?.currentMonthScore?.month).toBe("2026-10");
    expect(dashboard?.currentMonthScore?.totalScore).toBe(62);
    expect(dashboard?.currentMonthScore?.overallRank).toBe(1);
    expect(dashboard?.currentMonthScore?.committeeRank).toBe(1);

    const attendance = await getMemberAttendance(salmaId);
    expect(attendance.length).toBeGreaterThan(0);

    const tasks = await getMemberTasks(salmaId);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]?.effort).toBeGreaterThanOrEqual(1);

    const activities = await getMemberActivities(salmaId);
    expect(activities.length).toBeGreaterThan(0);

    const scores = await getMemberMonthlyScores(salmaId);
    expect(scores.map((s) => s.month)).toEqual(["2026-10"]);

    const evaluations = await getMemberEvaluations(salmaId);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.seasonLabel).toBe("Fall 2026");
    expect(evaluations[0]?.grade).toBe("Outstanding");
  });

  it("strictly filters out unpublished internal feedback and HR warnings from member queries", async () => {
    const feedbackList = await getMemberFeedback(salmaId);
    expect(feedbackList.length).toBeGreaterThan(0);
    expect(feedbackList.every((item) => item.visibility === "published")).toBe(true);
    expect(feedbackList.some((item) => item.id.includes("internal") || item.id.includes("warning"))).toBe(false);

    const dashboard = await getMemberDashboard(salmaId);
    expect(
      dashboard?.recentFeedback.every((item) => item.visibility === "published")
    ).toBe(true);
  });

  it("does not resolve an attendee identifier as a member profile or dashboard", async () => {
    const [attendee] = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "mariam.yassin@gmail.com"));
    expect(await getMemberProfile(attendee.id)).toBeNull();
    expect(await getMemberDashboard(attendee.id)).toBeNull();
  });

  it("retrieves operational user profiles with exact role and committee metadata", async () => {
    const operationalUser = await getOperationalUserProfile(salmaId);
    expect(operationalUser).not.toBeNull();
    expect(operationalUser?.fullName).toBe("Salma El-Sayed");
    expect(operationalUser?.role).toBe("committee_head");
    expect(operationalUser?.committeeName).toBe("AI and Machine Learning");

    expect(await getOperationalUserProfile("non-existent-id")).toBeNull();
  });

  it("assembles complete member dashboard with engagement metrics from profile and scores", async () => {
    const dashboard = await getMemberDashboard(salmaId);
    expect(dashboard).not.toBeNull();
    expect(dashboard?.profile.fullName).toBe("Salma El-Sayed");
    expect(dashboard?.currentMonthScore?.month).toBe("2026-10");
    expect(dashboard?.engagement).toBeDefined();
    expect(dashboard?.engagement?.attendanceStreak).toBeGreaterThanOrEqual(1);
    expect(dashboard?.engagement?.committeeCompletionRate).toBeGreaterThanOrEqual(0);
  });
});
