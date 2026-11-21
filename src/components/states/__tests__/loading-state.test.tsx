import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  AttendeeDashboardLoadingState,
  HrCardGridLoadingState,
  HrCommitteesLoadingState,
  HrFeedbackLoadingState,
  HrLedgerLoadingState,
  HrOverviewLoadingState,
  HrPublishingLoadingState,
  HrRosterLoadingState,
  HrTasksLoadingState,
  LeaderboardLoadingState,
  MemberAttendanceLoadingState,
  MemberDashboardLoadingState,
  MemberListLoadingState,
  MemberPerformanceLoadingState,
  MemberTasksLoadingState,
  PageLoadingState,
} from "@/components/states/loading-state";

describe("Route-matched responsive loading skeletons", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["HR Overview", HrOverviewLoadingState, /loading hr overview/i],
    ["HR Card Grid", HrCardGridLoadingState, /loading items/i],
    ["HR Committees", HrCommitteesLoadingState, /loading committees and rubrics/i],
    ["HR Roster", HrRosterLoadingState, /loading roster/i],
    ["HR Tasks", HrTasksLoadingState, /loading tasks/i],
    ["HR Ledger", HrLedgerLoadingState, /loading points ledger/i],
    ["HR Feedback", HrFeedbackLoadingState, /loading feedback/i],
    ["HR Publishing", HrPublishingLoadingState, /loading leaderboard publishing/i],
    ["Member Dashboard", MemberDashboardLoadingState, /loading member dashboard/i],
    ["Member Performance", MemberPerformanceLoadingState, /loading performance/i],
    ["Member Attendance", MemberAttendanceLoadingState, /loading attendance/i],
    ["Member Tasks", MemberTasksLoadingState, /loading tasks/i],
    ["Member List", MemberListLoadingState, /loading records/i],
    ["Attendee Dashboard", AttendeeDashboardLoadingState, /loading attendee dashboard/i],
    ["Leaderboard", LeaderboardLoadingState, /loading leaderboard/i],
    ["Generic Page", PageLoadingState, /loading page/i],
  ])("renders accessible %s skeleton with aria-busy", (_name, Component, label) => {
    const { container } = render(<Component />);
    const busyRegion = screen.getByLabelText(label);
    expect(busyRegion).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(2);
  });
});
