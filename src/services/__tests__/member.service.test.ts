import { describe, expect, it } from "vitest";
import { MOCK_MEMBERS } from "@/data/mock/members";
import {
  getMemberActivities,
  getMemberAttendance,
  getMemberDashboard,
  getMemberEvaluations,
  getMemberFeedback,
  getMemberMonthlyScores,
  getMemberProfile,
  getMemberTasks,
} from "@/services/member.service";

describe("member.service", () => {
  it("loads member profile, dashboard, attendance, tasks, activities, monthly scores, and seasonal evaluations", async () => {
    const profile = await getMemberProfile("mem-101");
    expect(profile?.displayId).toBe("M001");
    expect(profile?.role).toBe("Head");
    expect(profile?.committee.name).toBe("AI and Machine Learning");

    const dashboard = await getMemberDashboard("mem-101");
    expect(dashboard?.currentMonthScore?.month).toBe("2026-10");
    expect(dashboard?.currentMonthScore?.totalScore).toBe(94);
    expect(dashboard?.currentMonthScore?.overallRank).toBe(1);
    expect(dashboard?.currentMonthScore?.committeeRank).toBe(1);
    expect(dashboard?.bonusesPoints).toBe(7);
    expect(dashboard?.projectAndHackathonCount).toBeGreaterThanOrEqual(2);

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

  it("filters out unpublished internal feedback and returns only published items", async () => {
    const hasInternalRawNote = MOCK_MEMBERS["mem-101"].feedback.some(
      (item) => item.visibility === "internal"
    );
    expect(hasInternalRawNote).toBe(true);

    const published = await getMemberFeedback("mem-101");
    expect(published.length).toBeGreaterThan(0);
    expect(published.every((item) => item.visibility === "published")).toBe(
      true
    );
    expect(
      published.some((item) => item.id === "fb-m101-internal")
    ).toBe(false);

    const dashboard = await getMemberDashboard("mem-101");
    expect(
      dashboard?.recentFeedback.every((item) => item.visibility === "published")
    ).toBe(true);
  });

  it("does not resolve an attendee identifier as a member", async () => {
    expect(await getMemberProfile("att-201")).toBeNull();
    expect(await getMemberDashboard("att-201")).toBeNull();
  });
});
