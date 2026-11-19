import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";

describe("BulkTaskGradingView Component", () => {
  const sampleTask = {
    id: "t-1",
    title: "Design Summit Social Media Campaign",
    committeeName: "Graphic Design",
    maxPoints: 100,
  };

  const sampleSubmissions = [
    {
      membershipId: "m-1",
      memberName: "Nourhan Khaled",
      effortScore: 4,
      qualityScore: 5,
      timelinessScore: 5,
      totalPoints: 95,
      notes: "Exceptional design assets delivered early",
    },
    {
      membershipId: "m-2",
      memberName: "Omar Tarek",
      effortScore: 3,
      qualityScore: 3,
      timelinessScore: 2,
      totalPoints: 65,
      notes: "Submitted 2 days late",
    },
  ];

  it("renders submissions and allows keyboard input navigation across grading cells", async () => {
    const user = userEvent.setup();
    render(
      <BulkTaskGradingView
        task={sampleTask}
        submissions={sampleSubmissions}
      />
    );

    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();

    const effortInputs = screen.getAllByLabelText(/effort/i);
    expect(effortInputs).toHaveLength(2);
    expect(effortInputs[0]).toHaveValue(4);

    await user.clear(effortInputs[0]);
    await user.type(effortInputs[0], "5");
    expect(effortInputs[0]).toHaveValue(5);
  });
});
