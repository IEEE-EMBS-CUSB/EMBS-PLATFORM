import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitteeLeadersShowcase } from "@/components/data-display/committee-leaders-showcase";
import { getOfficialCommitteeOrThrow as getCommitteeOrThrow } from "@/lib/committee-catalog";
import type { CommitteeLeaderSpotlight } from "@/types";

const SAMPLE_SPOTLIGHTS: CommitteeLeaderSpotlight[] = [
  {
    committee: {
      ...getCommitteeOrThrow("ai-and-machine-learning"),
      trackSlug: "technical",
      trackName: "Technical",
      trackSortOrder: 1,
    },
    month: "2026-10",
    monthLabel: "October 2026",
    leader: {
      memberName: "Salma El-Sayed",
      role: "Head",
      monthlyScore: 94,
    },
  },
  {
    committee: {
      ...getCommitteeOrThrow("graphic-design"),
      trackSlug: "creative",
      trackName: "Creative",
      trackSortOrder: 2,
    },
    month: "2026-10",
    monthLabel: "October 2026",
    leader: {
      memberName: "Nourhan Khaled",
      role: "Vice",
      monthlyScore: 91,
    },
  },
  {
    committee: {
      id: "com-clinical",
      slug: "clinical-innovation",
      name: "Clinical Innovation",
      shortName: "Clinical",
      track: "non_technical",
      trackSlug: "clinical-tracks",
      trackName: "Clinical Tracks",
      trackSortOrder: 3,
      description: "",
    },
    month: "2026-10",
    monthLabel: "October 2026",
    leader: {
      memberName: "Youssef Adel",
      role: "Member",
      monthlyScore: 88,
    },
  },
];

describe("CommitteeLeadersShowcase", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders crowned user emblems and filters dynamically by season-defined categories instead of hardcoded Technical/Non-technical", async () => {
    const user = userEvent.setup();
    render(
      <CommitteeLeadersShowcase
        spotlights={SAMPLE_SPOTLIGHTS}
        monthLabel="October 2026"
      />
    );

    const salmaLink = screen.getByRole("link", { name: /Salma El-Sayed/i });
    expect(salmaLink).toHaveAttribute(
      "href",
      "/leaderboards/committees/ai-and-machine-learning"
    );
    const crownSlot = salmaLink.querySelector('[data-slot="leader-crown-slot"]');
    expect(crownSlot).not.toBeNull();
    expect(crownSlot).toHaveClass("h-7");
    expect(salmaLink.querySelector('[data-slot="leader-crown"]')).not.toBeNull();
    expect(
      salmaLink.querySelector('[data-slot="leader-user-icon"]')
    ).not.toBeNull();
    expect(salmaLink).not.toHaveClass("bg-white", "border");
    expect(
      salmaLink.querySelector('[data-slot="leader-committee"]')
    ).toHaveClass("min-h-8");

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.getByText("Youssef Adel")).toBeInTheDocument();

    // Must NOT render legacy hardcoded "Non-technical" filter button
    expect(
      screen.queryByRole("button", { name: /non-technical/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^technical/i }));
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.queryByText("Nourhan Khaled")).not.toBeInTheDocument();
    expect(screen.queryByText("Youssef Adel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^creative/i }));
    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.queryByText("Salma El-Sayed")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^clinical tracks/i }));
    expect(screen.getByText("Youssef Adel")).toBeInTheDocument();
    expect(screen.queryByText("Nourhan Khaled")).not.toBeInTheDocument();
  });
});
