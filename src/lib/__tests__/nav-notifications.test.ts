import { describe, expect, it } from "vitest";
import {
  aggregateOverflowBadge,
  countUnseenRecentItems,
  formatBadgeCount,
  resolveNavBadge,
} from "@/lib/nav-notifications";

describe("nav-notifications pure helpers", () => {
  const now = new Date("2026-11-23T00:00:00Z");

  it("counts items younger than 30 days when unseen, and filters out items older than 30 days", () => {
    const dates = [
      "2026-11-22T12:00:00Z", // 12h old -> count
      "2026-11-01T00:00:00Z", // 22d old -> count
      "2026-10-20T00:00:00Z", // 34d old -> ignore
    ];

    expect(countUnseenRecentItems(dates, null, now, 30)).toBe(2);
  });

  it("excludes items at or before localStorage seenAt and counts only newer items", () => {
    const dates = [
      "2026-11-22T18:00:00Z", // newer than seenAt -> count
      "2026-11-21T10:00:00Z", // older than seenAt -> seen
      "2026-11-20T10:00:00Z", // older than seenAt -> seen
    ];

    expect(
      countUnseenRecentItems(dates, "2026-11-22T00:00:00Z", now, 30)
    ).toBe(1);
    expect(
      countUnseenRecentItems(dates, "2026-11-22T18:00:00Z", now, 30)
    ).toBe(0);
  });

  it("resolves seen-tracked feedback badges with red tone when an unseen official warning exists", () => {
    const badge = {
      count: 2,
      tone: "purple" as const,
      seenKey: "member_feedback:p-1",
      recentItemDates: ["2026-11-22T18:00:00Z", "2026-11-20T10:00:00Z"],
      recentWarningDates: ["2026-11-22T18:00:00Z"],
    };

    // Before seen: both unread, warning present -> red tone, count 2
    expect(resolveNavBadge(badge, null, now)).toEqual({
      count: 2,
      tone: "red",
      label: undefined,
    });

    // Seen after older note, before warning -> count 1, still red
    expect(resolveNavBadge(badge, "2026-11-21T00:00:00Z", now)).toEqual({
      count: 1,
      tone: "red",
      label: undefined,
    });

    // Seen after warning -> count 0 (null)
    expect(resolveNavBadge(badge, "2026-11-22T20:00:00Z", now)).toBeNull();
  });

  it("aggregates overflow badges with highest urgency tone (red > amber > purple > green) and caps at 99+", () => {
    expect(
      aggregateOverflowBadge([
        { count: 2, tone: "purple" },
        { count: 1, tone: "amber" },
      ])
    ).toEqual({ count: 3, tone: "amber" });

    expect(
      aggregateOverflowBadge([
        { count: 1, tone: "green" },
        { count: 1, tone: "red" },
      ])
    ).toEqual({ count: 2, tone: "red" });

    expect(aggregateOverflowBadge([null, { count: 0, tone: "purple" }])).toBeNull();
    expect(formatBadgeCount(5)).toBe("5");
    expect(formatBadgeCount(120)).toBe("99+");
  });
});
