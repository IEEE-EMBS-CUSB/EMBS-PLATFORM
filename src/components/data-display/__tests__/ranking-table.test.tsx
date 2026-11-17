import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RankingTable } from "@/components/data-display/ranking-table";
import type { LeaderboardEntry } from "@/types";

const SAMPLE_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    previousRank: 3,
    memberId: "mem-101",
    memberName: "Salma El-Sayed",
    committeeSlug: "ai-and-machine-learning",
    committeeName: "AI and Machine Learning",
    role: "Head",
    monthlyScore: 94,
  },
  {
    rank: 2,
    previousRank: 1,
    memberId: "mem-104",
    memberName: "Ziad Hany",
    committeeSlug: "web-development",
    committeeName: "Web Development",
    role: "Member",
    monthlyScore: 88,
  },
];

describe("RankingTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ranked entries with scores, rank movement, and committee links without showing member IDs", () => {
    render(
      <RankingTable
        entries={SAMPLE_ENTRIES}
        month="2026-10"
        showCommittee={true}
      />
    );

    expect(
      screen.getAllByText("Salma El-Sayed").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("94").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("+2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/EMBS-M-|M001/i)).not.toBeInTheDocument();

    const committeeLinks = screen.getAllByRole("link", {
      name: "AI and Machine Learning",
    });
    expect(committeeLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of committeeLinks) {
      expect(link).toHaveAttribute(
        "href",
        "/leaderboards/committees/ai-and-machine-learning?month=2026-10"
      );
    }
  });

  it("omits the committee column when showCommittee is false", () => {
    render(
      <RankingTable
        entries={SAMPLE_ENTRIES}
        month="2026-10"
        showCommittee={false}
      />
    );

    expect(
      screen.queryByRole("columnheader", { name: /committee/i })
    ).not.toBeInTheDocument();
  });

  it("marks the signed-in member's own row with a You badge", () => {
    render(
      <RankingTable
        entries={SAMPLE_ENTRIES}
        month="2026-10"
        showCommittee={true}
        highlightMemberId="mem-101"
      />
    );

    expect(screen.getAllByText(/^you$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders an empty state when no ranked entries exist", () => {
    render(<RankingTable entries={[]} month="2026-10" showCommittee={true} />);

    expect(
      screen.getByText(/no published rankings available/i)
    ).toBeInTheDocument();
  });
});
