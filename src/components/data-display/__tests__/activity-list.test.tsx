import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityList } from "@/components/data-display/activity-list";
import type { MemberActivity } from "@/types";

const SAMPLE_ACTIVITIES: MemberActivity[] = [
  {
    id: "a1",
    month: "2026-10",
    date: "2026-10-25",
    category: "project",
    title: "ECG Arrhythmia Pipeline",
    role: "Lead Contributor",
    summary: "Built baseline 1D-CNN model.",
    pointsAwarded: 20,
  },
  {
    id: "a2",
    month: "2026-10",
    date: "2026-10-12",
    category: "hackathon",
    title: "CUBES MedAI Mini-Hackathon",
    role: "Finalist",
    summary: "Retinal vessel segmentation prototype.",
    pointsAwarded: 14,
  },
];

describe("ActivityList", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters member activities by category when filter controls are enabled", async () => {
    const user = userEvent.setup();
    render(<ActivityList activities={SAMPLE_ACTIVITIES} filterable={true} />);

    expect(screen.getByText("ECG Arrhythmia Pipeline")).toBeInTheDocument();
    expect(screen.getByText("CUBES MedAI Mini-Hackathon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^projects/i }));
    expect(screen.getByText("ECG Arrhythmia Pipeline")).toBeInTheDocument();
    expect(
      screen.queryByText("CUBES MedAI Mini-Hackathon")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^bonuses/i }));
    expect(
      screen.getByText(/no activities recorded in this category/i)
    ).toBeInTheDocument();
  });
});
