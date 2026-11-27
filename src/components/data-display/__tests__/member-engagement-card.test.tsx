import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MemberEngagementCard,
  type MemberEngagementProps,
} from "../member-engagement-card";

describe("MemberEngagementCard", () => {
  const defaultProps: MemberEngagementProps = {
    attendanceStreak: 4,
    livePoints: 175,
    currentRank: 3,
    pointsToNextRank: 5,
    targetRank: 2,
    activityTier: "Gold",
    committeeCompletionRate: 88,
  };

  it("renders attendance streak, next rank delta, activity tier, and live points", () => {
    render(<MemberEngagementCard {...defaultProps} />);

    expect(screen.getByText("4 Session Streak")).toBeInTheDocument();
    expect(screen.getByText("175 pts")).toBeInTheDocument();
    expect(screen.getByText("Gold Member")).toBeInTheDocument();
    expect(
      screen.getByText("5 pts needed to reach Rank #2")
    ).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("handles rank 1 state without next rank delta", () => {
    render(
      <MemberEngagementCard
        {...defaultProps}
        currentRank={1}
        pointsToNextRank={null}
        targetRank={null}
        activityTier="Diamond"
      />
    );

    expect(screen.getByText("Diamond Member")).toBeInTheDocument();
    expect(screen.getByText("Rank #1 · Chapter Leader")).toBeInTheDocument();
  });

  it("omits member rank and leaderboard tier comparisons for unranked leadership roles (e.g. Committee Head)", () => {
    render(
      <MemberEngagementCard
        {...defaultProps}
        currentRank={null}
        pointsToNextRank={null}
        targetRank={null}
        roleLabel="Head"
      />
    );

    expect(screen.getByText("175 pts")).toBeInTheDocument();
    expect(screen.getByText("4 Session Streak")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.queryByText(/Current Rank/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chapter Leader/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gold Member/i)).not.toBeInTheDocument();
  });
});
