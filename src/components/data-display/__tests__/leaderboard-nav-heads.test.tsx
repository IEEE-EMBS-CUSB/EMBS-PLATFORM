import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeaderboardNav } from "@/components/data-display/leaderboard-nav";

describe("LeaderboardNav — Committee Heads board tab", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Committee heads links and scopes month pills to /leaderboards/heads when active", () => {
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
        isHeadsPage
      />
    );

    const headsLinks = screen.getAllByRole("link", {
      name: /committee heads|heads/i,
    });
    expect(headsLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of headsLinks) {
      expect(link).toHaveAttribute("href", "/leaderboards/heads?month=2026-11");
      expect(link).toHaveAttribute("aria-current", "page");
    }

    const octLinks = screen.getAllByRole("link", { name: "October 2026" });
    expect(octLinks.length).toBeGreaterThan(0);
    expect(octLinks[0]).toHaveAttribute(
      "href",
      "/leaderboards/heads?month=2026-10"
    );
  });
});
