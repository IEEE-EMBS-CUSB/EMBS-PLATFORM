import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitteeLeadersShowcase } from "@/components/data-display/committee-leaders-showcase";
import { getCommitteeOrThrow } from "@/db/seed-data";
import type { CommitteeLeaderSpotlight } from "@/types";

const SAMPLE_SPOTLIGHTS: CommitteeLeaderSpotlight[] = [
  {
    committee: getCommitteeOrThrow("ai-and-machine-learning"),
    month: "2026-10",
    monthLabel: "October 2026",
    leader: {
      memberName: "Salma El-Sayed",
      role: "Head",
      monthlyScore: 94,
    },
  },
  {
    committee: getCommitteeOrThrow("graphic-design"),
    month: "2026-10",
    monthLabel: "October 2026",
    leader: {
      memberName: "Nourhan Khaled",
      role: "Vice",
      monthlyScore: 91,
    },
  },
];

describe("CommitteeLeadersShowcase", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders crowned user emblems with member name and committee without boxed cards, and filters by track", async () => {
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
    expect(screen.getByText("AI and Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.getByText("Graphic Design")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^technical/i }));
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.queryByText("Nourhan Khaled")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^non-technical/i }));
    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.queryByText("Salma El-Sayed")).not.toBeInTheDocument();
  });
});
