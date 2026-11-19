import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeaderboardNav } from "@/components/data-display/leaderboard-nav";
import { CHAPTER_COMMITTEES as MOCK_COMMITTEES } from "@/db/seed-data";
import type { PublishedMonthOption } from "@/types";

const MONTHS: PublishedMonthOption[] = [
  { month: "2026-10", monthLabel: "October 2026", publishedAt: "2026-11-02" },
  { month: "2026-09", monthLabel: "September 2026", publishedAt: "2026-10-03" },
];

describe("LeaderboardNav", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders mobile compact controls and desktop sidebar with Overall, Previous months, month switcher, and all 12 committees", () => {
    render(
      <LeaderboardNav
        committees={[...MOCK_COMMITTEES]}
        months={MONTHS}
        activeMonth="2026-09"
        activeCommitteeSlug="robotics-and-automation"
      />
    );

    expect(screen.getByText(/^technical committees$/i)).toBeInTheDocument();
    expect(screen.getByText(/^non-technical committees$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/committee: robotics and automation/i)
    ).toBeInTheDocument();

    const overallLink = screen.getByRole("link", { name: /overall ranking/i });
    expect(overallLink).toHaveAttribute("href", "/leaderboards?month=2026-09");
    expect(overallLink).not.toHaveAttribute("aria-current");

    const archiveLinks = screen.getAllByRole("link", {
      name: /previous months/i,
    });
    expect(archiveLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of archiveLinks) {
      expect(link).toHaveAttribute("href", "/leaderboards/history");
    }

    const activeCommitteeLinks = screen.getAllByRole("link", {
      name: "Robotics and Automation",
    });
    expect(activeCommitteeLinks.length).toBeGreaterThanOrEqual(1);
    expect(
      activeCommitteeLinks.some(
        (link) => link.getAttribute("aria-current") === "page"
      )
    ).toBe(true);

    const octLinks = screen.getAllByRole("link", { name: "October 2026" });
    expect(octLinks.length).toBeGreaterThanOrEqual(1);
    expect(octLinks[0]).toHaveAttribute(
      "href",
      "/leaderboards/committees/robotics-and-automation?month=2026-10"
    );

    for (const committee of MOCK_COMMITTEES) {
      expect(
        screen.getAllByRole("link", { name: committee.name }).length
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
