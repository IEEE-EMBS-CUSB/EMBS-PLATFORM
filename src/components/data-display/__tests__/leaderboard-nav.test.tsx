import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeaderboardNav } from "@/components/data-display/leaderboard-nav";

describe("LeaderboardNav — Committee Leaders & Per-Committee navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Committee leaders and History links without Overall ranking or Committee heads links", () => {
    render(
      <LeaderboardNav
        committees={[
          {
            id: "c-ai",
            slug: "ai-and-machine-learning",
            name: "AI and Machine Learning",
            shortName: "AI & ML",
            track: "technical",
            description: "",
          },
        ]}
        months={[
          {
            month: "2026-11",
            monthLabel: "November 2026",
            publishedAt: "2026-12-01",
          },
          {
            month: "2026-10",
            monthLabel: "October 2026",
            publishedAt: "2026-11-01",
          },
        ]}
        activeMonth="2026-11"
      />
    );

    const leadersLinks = screen.getAllByRole("link", {
      name: /committee leaders/i,
    });
    expect(leadersLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of leadersLinks) {
      expect(link).toHaveAttribute("href", "/leaderboards?month=2026-11");
      expect(link).toHaveAttribute("aria-current", "page");
    }

    expect(
      screen.queryByRole("link", { name: /committee heads|heads/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /overall/i })
    ).not.toBeInTheDocument();

    const octLinks = screen.getAllByRole("link", { name: "October 2026" });
    expect(octLinks.length).toBeGreaterThan(0);
    expect(octLinks[0]).toHaveAttribute("href", "/leaderboards?month=2026-10");
  });
});
