import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoreBreakdown } from "@/components/data-display/score-breakdown";
import type { ScoreComponent } from "@/types";

const SAMPLE_COMPONENTS: ScoreComponent[] = [
  {
    key: "attendance",
    label: "Attendance",
    points: 18,
    maxPoints: 20,
    detail: "5 of 6 sessions",
  },
  {
    key: "tasks",
    label: "Tasks & Assignments",
    points: 22,
    maxPoints: 25,
  },
  {
    key: "bonuses",
    label: "Bonuses",
    points: 8,
    detail: "Office hours mentorship",
  },
];

describe("ScoreBreakdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders backend-provided score components, points, ceilings, and details without recomputing totals", () => {
    render(
      <ScoreBreakdown
        components={SAMPLE_COMPONENTS}
        totalScore={94}
        monthLabel="October 2026"
      />
    );

    expect(screen.getByText("Attendance")).toBeInTheDocument();
    expect(screen.getByText("18 / 20")).toBeInTheDocument();
    expect(screen.getByText("5 of 6 sessions")).toBeInTheDocument();
    expect(screen.getByText("Tasks & Assignments")).toBeInTheDocument();
    expect(screen.getByText("22 / 25")).toBeInTheDocument();
    expect(screen.getByText("Bonuses")).toBeInTheDocument();
    expect(screen.getByText("+8")).toBeInTheDocument();
    expect(screen.getByText("94")).toBeInTheDocument();
  });

  it("renders an empty state when no score components exist", () => {
    render(
      <ScoreBreakdown components={[]} totalScore={0} monthLabel="October 2026" />
    );

    expect(
      screen.getByText(/no score breakdown available/i)
    ).toBeInTheDocument();
  });
});
