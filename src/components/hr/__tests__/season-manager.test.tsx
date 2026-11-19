import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonManagerView } from "@/components/hr/season-manager-view";

describe("SeasonManagerView Component", () => {
  const sampleSeasons = [
    {
      id: "s-1",
      name: "Fall 2026",
      status: "active" as const,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-01-31"),
      committeeCount: 12,
      memberCount: 84,
    },
    {
      id: "s-0",
      name: "Spring 2026",
      status: "archived" as const,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-07-31"),
      committeeCount: 12,
      memberCount: 78,
    },
  ];

  it("renders active and archived seasons and triggers the clone modal", async () => {
    const user = userEvent.setup();
    render(<SeasonManagerView seasons={sampleSeasons} />);

    expect(screen.getByText("Fall 2026")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    const cloneButton = screen.getByRole("button", { name: /clone season/i });
    expect(cloneButton).toBeInTheDocument();

    await user.click(cloneButton);
    expect(
      screen.getByText(/copy committees and scoring rubrics/i)
    ).toBeInTheDocument();
  });

  it("hides clone actions and shows read-only banner for non-master roles", () => {
    render(
      <SeasonManagerView seasons={sampleSeasons} currentUserRole="hr_admin" />
    );

    expect(screen.queryByRole("button", { name: /clone season/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Master Authority Required/i)).toBeInTheDocument();
  });
});
