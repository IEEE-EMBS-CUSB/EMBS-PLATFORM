import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatisticsView } from "@/components/hr/statistics-view";
import type { AdminStatisticsDataset } from "@/lib/statistics-engine";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/season-settings";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function makeSampleDataset(
  overrides: Partial<AdminStatisticsDataset> = {}
): AdminStatisticsDataset {
  return {
    viewerRole: "master_admin",
    scopeKind: "chapter",
    scopeLabel: "Whole Chapter",
    canViewHiddenFeedback: true,
    canViewPortalActivation: true,
    canViewManualOverrideRate: true,
    canViewHrHealth: true,
    canSwitchSeason: true,
    selectedSeason: { id: "s-active", name: "2026-2027", status: "active" },
    availableSeasons: [
      { id: "s-active", name: "2026-2027", status: "active" },
      { id: "s-archived", name: "2025-2026", status: "archived" },
    ],
    seasonSettings: DEFAULT_SEASON_SETTINGS,
    tracks: [
      { id: "t-tech", name: "Technical" },
      { id: "t-ops", name: "Operations" },
    ],
    committees: [
      { id: "c-ai", name: "AI and Machine Learning", slug: "ai-ml", trackId: "t-tech" },
      { id: "c-web", name: "Web Development", slug: "web-dev", trackId: "t-tech" },
      { id: "c-hr", name: "Human Resources", slug: "human-resources", trackId: "t-ops" },
    ],
    members: [
      {
        id: "m-alice",
        personId: "p-alice",
        fullName: "Alice Mansour",
        email: "alice@cu.edu.eg",
        role: "member",
        committeeId: "c-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      {
        id: "m-bob",
        personId: "p-bob",
        fullName: "Bob Adel",
        email: "bob@cu.edu.eg",
        role: "member",
        committeeId: "c-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: true,
      },
      {
        id: "m-karim",
        personId: "p-karim",
        fullName: "Karim Nabil",
        email: "karim@cu.edu.eg",
        role: "member",
        committeeId: "c-web",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      {
        id: "m-former",
        personId: "p-former",
        fullName: "Former Member",
        email: "former@cu.edu.eg",
        role: "member",
        committeeId: "c-web",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: false,
        mustChangePassword: true,
      },
    ],
    sessions: [
      {
        id: "sess-1",
        committeeId: "c-ai",
        startsAt: "2026-10-10T14:00:00.000Z",
        month: "2026-10",
      },
    ],
    attendance: [
      {
        sessionId: "sess-1",
        membershipId: "m-alice",
        personId: "p-alice",
        status: "present",
        isPunctual: true,
        pointsAwarded: 15,
        hasOverride: false,
      },
    ],
    tasks: [
      {
        id: "assign-1",
        committeeId: "c-ai",
        workType: "assignment",
        dueAt: "2026-10-20T18:00:00.000Z",
        month: "2026-10",
        maxPoints: 100,
      },
      {
        id: "task-1",
        committeeId: "c-ai",
        workType: "task",
        dueAt: "2026-10-22T18:00:00.000Z",
        month: "2026-10",
        maxPoints: 15,
      },
    ],
    submissions: [
      {
        taskId: "assign-1",
        membershipId: "m-alice",
        personId: "p-alice",
        effortScore: 5,
        qualityScore: 4,
        timelinessScore: 5,
        totalPoints: 85,
        submittedAt: "2026-10-19T12:00:00.000Z",
        gradedAt: "2026-10-19T18:00:00.000Z",
      },
      {
        taskId: "task-1",
        membershipId: "m-alice",
        personId: "p-alice",
        effortScore: null,
        qualityScore: null,
        timelinessScore: null,
        totalPoints: 15,
        submittedAt: "2026-10-21T12:00:00.000Z",
        gradedAt: "2026-10-21T13:00:00.000Z",
      },
      {
        taskId: "assign-1",
        membershipId: "m-bob",
        personId: "p-bob",
        effortScore: null,
        qualityScore: null,
        timelinessScore: null,
        totalPoints: null,
        submittedAt: null,
        gradedAt: null,
      },
    ],
    ledger: [
      {
        membershipId: "m-alice",
        personId: "p-alice",
        month: "2026-10",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: "c-ai",
        points: 85,
      },
      {
        membershipId: "m-karim",
        personId: "p-karim",
        month: "2026-10",
        sourceType: "task",
        postingScope: "committee",
        committeeId: "c-web",
        points: 20,
      },
    ],
    feedback: [
      {
        membershipId: "m-alice",
        personId: "p-alice",
        month: "2026-10",
        category: "recognition",
        pointsDelta: 10,
        isPublished: true,
        isWarning: false,
      },
      {
        membershipId: "m-bob",
        personId: "p-bob",
        month: "2026-10",
        category: "warning",
        pointsDelta: -5,
        isPublished: true,
        isWarning: true,
      },
      {
        membershipId: "m-bob",
        personId: "p-bob",
        month: "2026-10",
        category: "internal_note",
        pointsDelta: 0,
        isPublished: false,
        isWarning: false,
      },
    ],
    snapshots: [{ month: "2026-10", status: "published" }],
    hrCoveredCommitteeIds: ["c-ai"],
    ...overrides,
  };
}

describe("StatisticsView Component", () => {
  afterEach(() => {
    cleanup();
    pushMock.mockReset();
  });

  it("renders Roster-matching filter categories, updates live on filter changes, and supports season switching for master_admin", async () => {
    const user = userEvent.setup();
    render(<StatisticsView dataset={makeSampleDataset()} />);

    expect(screen.getByRole("heading", { name: /statistics/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by committee/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by track/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by month/i)).toBeInTheDocument();

    // Active-only by default: Alice, Bob, Karim are shown; Former Member is hidden
    expect(screen.getAllByText("Alice Mansour").length).toBeGreaterThan(0);
    expect(screen.queryByText("Former Member")).not.toBeInTheDocument();

    // HR Operations Health & Internal Notes visible for master_admin
    expect(screen.getByText(/hr operations health/i)).toBeInTheDocument();
    expect(screen.getByText(/internal notes/i)).toBeInTheDocument();

    // Switching Status filter to Deactivated shows Former Member
    await user.selectOptions(screen.getByLabelText(/filter by status/i), "inactive");
    expect(screen.getAllByText("Former Member").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice Mansour")).not.toBeInTheDocument();

    // Reset filters brings back active members
    await user.click(screen.getByRole("button", { name: /reset filters/i }));
    expect(screen.getAllByText("Alice Mansour").length).toBeGreaterThan(0);

    // Season switcher navigates to ?seasonId=...
    const seasonSelect = screen.getByLabelText(/select season/i);
    await user.selectOptions(seasonSelect, "s-archived");
    expect(pushMock).toHaveBeenCalledWith("/hr/statistics?seasonId=s-archived");
  });

  it("hides season switcher, HR health, and internal notes for committee_head while displaying both Assignments and HR Tasks pipelines", () => {
    const headDataset = makeSampleDataset({
      viewerRole: "committee_head",
      scopeKind: "committee",
      scopeLabel: "AI and Machine Learning",
      canViewHiddenFeedback: false,
      canViewPortalActivation: false,
      canViewManualOverrideRate: false,
      canViewHrHealth: false,
      canSwitchSeason: false,
      availableSeasons: [{ id: "s-active", name: "2026-2027", status: "active" }],
      committees: [
        { id: "c-ai", name: "AI and Machine Learning", slug: "ai-ml", trackId: "t-tech" },
      ],
      tracks: [{ id: "t-tech", name: "Technical" }],
      feedback: [
        {
          membershipId: "m-alice",
          personId: "p-alice",
          month: "2026-10",
          category: "recognition",
          pointsDelta: 10,
          isPublished: true,
          isWarning: false,
        },
      ],
    });

    render(<StatisticsView dataset={headDataset} />);

    expect(screen.queryByLabelText(/select season/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hr operations health/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal notes/i)).not.toBeInTheDocument();

    // Both Assignments and HR Tasks cards are visible for the committee
    expect(screen.getByText(/assignments pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/hr tasks pipeline/i)).toBeInTheDocument();
  });

  it("shows warnings and detailed per-member stats in the full member list and renders the filterable hidden season-wide leaderboard tab", async () => {
    const user = userEvent.setup();
    render(<StatisticsView dataset={makeSampleDataset()} />);

    // Full member list exposes warnings & recognitions columns/stats
    expect(screen.getAllByText(/warnings/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/sort managed people/i)).toBeInTheDocument();

    // Switch to the hidden season-wide leaderboard tab
    const lbTab = screen.getByRole("tab", { name: /season leaderboard/i });
    await user.click(lbTab);

    expect(screen.getByText(/hidden from members/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter leaderboard by committee/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter leaderboard by tier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter leaderboard by warnings/i)).toBeInTheDocument();

    // Ranked members appear in season order (Alice #1, Karim #2, Bob #3)
    expect(screen.getAllByText("Alice Mansour").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Karim Nabil").length).toBeGreaterThan(0);

    // Filter leaderboard to only members with warnings -> Bob Adel only
    await user.selectOptions(
      screen.getByLabelText(/filter leaderboard by warnings/i),
      "with_warnings"
    );
    expect(screen.getAllByText("Bob Adel").length).toBeGreaterThan(0);
    expect(screen.queryByText("Karim Nabil")).not.toBeInTheDocument();
  });
});
