import { describe, expect, it } from "vitest";
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

describe("member.service (Database-Backed & Privacy Guarded)", () => {
  it("loads member profile, dashboard, attendance, tasks, activities, and monthly scores", async () => {
    const profile = await getMemberProfile("mem-101");
    expect(profile).not.toBeNull();
    expect(profile?.displayId).toBe("M001");
    expect(profile?.role).toBe("Head");
    expect(profile?.committee.name).toBe("AI and Machine Learning");

    const dashboard = await getMemberDashboard("mem-101");
    expect(dashboard).not.toBeNull();
    expect(dashboard?.currentMonthScore?.month).toBe("2026-10");
    expect(dashboard?.currentMonthScore?.totalScore).toBe(94);
    expect(dashboard?.currentMonthScore?.overallRank).toBe(1);
    expect(dashboard?.currentMonthScore?.committeeRank).toBe(1);

    // Middle-80% Engagement Metrics
    expect(dashboard?.engagement).toBeDefined();
    expect(dashboard?.engagement?.attendanceStreak).toBeGreaterThanOrEqual(1);
    expect(dashboard?.engagement?.livePoints).toBeGreaterThanOrEqual(94);
    expect(dashboard?.engagement?.activityTier).toBe("Diamond");

    const attendance = await getMemberAttendance("mem-101");
    expect(attendance.length).toBeGreaterThan(0);

    const tasks = await getMemberTasks("mem-101");
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]?.effort).toBeGreaterThanOrEqual(1);

    const activities = await getMemberActivities("mem-101");
    expect(activities.length).toBeGreaterThan(0);

    const scores = await getMemberMonthlyScores("mem-101");
    expect(scores.map((s) => s.month)).toEqual(["2026-10", "2026-09", "2026-08"]);

    const evaluations = await getMemberEvaluations("mem-101");
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.seasonLabel).toBe("Fall 2026");
    expect(evaluations[0]?.grade).toBe("Outstanding");
  });

  it("strictly filters out unpublished internal feedback and HR warnings from member queries", async () => {
    const feedbackList = await getMemberFeedback("mem-101");
    expect(feedbackList.length).toBeGreaterThan(0);

    // All returned feedback must be published and cannot be an internal warning
    expect(feedbackList.every((item) => item.visibility === "published")).toBe(true);
    expect(feedbackList.some((item) => item.id.includes("internal") || item.id.includes("warning"))).toBe(false);

    const dashboard = await getMemberDashboard("mem-101");
    expect(
      dashboard?.recentFeedback.every((item) => item.visibility === "published")
    ).toBe(true);
  });

  it("does not resolve an attendee identifier as a member profile or dashboard", async () => {
    expect(await getMemberProfile("att-201")).toBeNull();
    expect(await getMemberDashboard("att-201")).toBeNull();
  });

  it("retrieves operational user profiles with exact role and committee metadata", async () => {
    const operationalUser = await getOperationalUserProfile("mem-101");
    expect(operationalUser).not.toBeNull();
    expect(operationalUser?.fullName).toBe("Salma El-Sayed");
    expect(operationalUser?.role).toBe("committee_head");
    expect(operationalUser?.committeeName).toBe("AI and Machine Learning");

    expect(await getOperationalUserProfile("non-existent-id")).toBeNull();
  });

  it("assembles complete member dashboard with engagement metrics from profile and scores", async () => {
    const dashboard = await getMemberDashboard("mem-101");
    expect(dashboard).not.toBeNull();
    expect(dashboard?.profile.fullName).toBe("Salma El-Sayed");
    expect(dashboard?.currentMonthScore?.month).toBe("2026-10");
    expect(dashboard?.engagement).toBeDefined();
    expect(dashboard?.engagement?.attendanceStreak).toBeGreaterThanOrEqual(1);
    expect(dashboard?.engagement?.committeeCompletionRate).toBeGreaterThanOrEqual(0);
  });
});
