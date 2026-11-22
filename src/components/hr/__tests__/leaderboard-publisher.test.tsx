import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LeaderboardPublisherView,
  type SnapshotDisplayData,
} from "../leaderboard-publisher-view";

const mockSnapshot: SnapshotDisplayData = {
  month: "2026-10",
  status: "draft",
  overallEntries: [
    {
      rank: 1,
      previousRank: 3,
      memberId: "mem-1",
      memberName: "Salma El-Sayed",
      committeeSlug: "ai",
      committeeName: "AI & Machine Learning",
      role: "member",
      monthlyScore: 195,
    },
    {
      rank: 2,
      previousRank: 1,
      memberId: "mem-2",
      memberName: "Ziad Hany",
      committeeSlug: "web",
      committeeName: "Web Development",
      role: "member",
      monthlyScore: 180,
    },
  ],
  committeeEntries: {
    ai: [
      {
        rank: 1,
        previousRank: 1,
        memberId: "mem-1",
        memberName: "Salma El-Sayed",
        committeeSlug: "ai",
        committeeName: "AI & Machine Learning",
        role: "member",
        monthlyScore: 195,
      },
    ],
    web: [
      {
        rank: 1,
        previousRank: 2,
        memberId: "mem-2",
        memberName: "Ziad Hany",
        committeeSlug: "web",
        committeeName: "Web Development",
        role: "member",
        monthlyScore: 180,
      },
    ],
  },
};

describe("LeaderboardPublisherView", () => {
  it("renders draft snapshot preview with ranks, scores, and trend movements", () => {
    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-10", "2026-09"]}
      />
    );

    expect(
      screen.getByRole("heading", { name: /monthly leaderboard publisher/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Draft · Unlocked")).toBeInTheDocument();
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Ziad Hany")).toBeInTheDocument();
    expect(screen.getByText("195 pts")).toBeInTheDocument();
    expect(screen.getByText("180 pts")).toBeInTheDocument();

    // Rank trend indicator (Salma moved up from #3 to #1: +2)
    expect(screen.getByText("▲ 2")).toBeInTheDocument();
    // Ziad moved down from #1 to #2: -1
    expect(screen.getByText("▼ 1")).toBeInTheDocument();
  });

  it("publishes and locks the monthly rankings on user confirmation", async () => {
    const user = userEvent.setup();
    const handlePublish = vi.fn();

    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-10", "2026-09"]}
        onPublish={handlePublish}
      />
    );

    const publishBtn = screen.getByRole("button", {
      name: /publish & freeze rankings/i,
    });
    await user.click(publishBtn);

    expect(handlePublish).toHaveBeenCalledWith("2026-10");
    expect(screen.getAllByText("Published & Locked")).toHaveLength(2);
  });

  it("switches to committee breakdowns view", async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-10", "2026-09"]}
      />
    );

    const committeeTab = screen.getByRole("button", {
      name: /by committee/i,
    });
    await user.click(committeeTab);

    expect(screen.getByText("AI & Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
  });

  it("switches to Committee Heads preview tab and renders head standings", async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardPublisherView
        snapshot={{
          ...mockSnapshot,
          headsEntries: [
            {
              rank: 1,
              previousRank: 2,
              memberId: "mem-head-1",
              memberName: "Omar Multi-Role",
              committeeSlug: "public-relations",
              committeeName: "Public Relations",
              role: "committee_head",
              monthlyScore: 95,
            },
          ],
        }}
        availableMonths={["2026-10", "2026-09"]}
      />
    );

    const headsTab = screen.getByRole("button", { name: /committee heads/i });
    await user.click(headsTab);

    expect(screen.getByText("Omar Multi-Role")).toBeInTheDocument();
    expect(screen.getByText("Public Relations")).toBeInTheDocument();
    expect(screen.getByText("95 pts")).toBeInTheDocument();
  });
});
