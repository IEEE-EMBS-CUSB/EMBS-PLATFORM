import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitteesRubricsView } from "@/components/hr/committees-rubrics-view";

describe("CommitteesRubricsView Component", () => {
  const sampleCommittees = [
    {
      id: "com-1",
      name: "AI and Machine Learning",
      slug: "ai-and-machine-learning",
      category: "technical" as const,
      isActive: true,
      memberCount: 14,
    },
    {
      id: "com-2",
      name: "Graphic Design",
      slug: "graphic-design",
      category: "non_technical" as const,
      isActive: true,
      memberCount: 10,
    },
  ];

  const sampleRubrics = [
    {
      id: "rub-1",
      name: "Attendance & Punctuality",
      maxPoints: 20,
      weight: "1.0",
      leadersOnly: false,
    },
    {
      id: "rub-2",
      name: "Leadership",
      maxPoints: 10,
      weight: "1.0",
      leadersOnly: true,
    },
  ];

  it("renders committee tracks and seasonal scoring rubrics", async () => {
    const user = userEvent.setup();
    render(
      <CommitteesRubricsView
        committees={sampleCommittees}
        rubrics={sampleRubrics}
      />
    );

    expect(screen.getByText("AI and Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Graphic Design")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /scoring rubrics/i }));
    expect(screen.getByText("Attendance & Punctuality")).toBeInTheDocument();
    expect(screen.getByText("Leadership")).toBeInTheDocument();
    expect(screen.getByText("Leaders only")).toBeInTheDocument();
  });

  it("allows Master Admin to add a new committee", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn().mockResolvedValue({ ok: true });

    render(
      <CommitteesRubricsView
        committees={sampleCommittees}
        rubrics={sampleRubrics}
        currentUserRole="master_admin"
        onAddCommittee={handleAdd}
      />
    );

    const addBtn = screen.getByRole("button", { name: /add committee/i });
    await user.click(addBtn);

    expect(screen.getByRole("dialog", { name: /add new committee/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/brain-computer/i);
    await user.type(nameInput, "Neuroscience");

    const submitBtn = screen.getByRole("button", { name: /^create committee$/i });
    await user.click(submitBtn);

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Neuroscience",
        category: "technical",
        slug: "neuroscience",
      })
    );
    expect(await screen.findByText("Neuroscience")).toBeInTheDocument();
  });

  it("allows Master Admin to remove an existing committee", async () => {
    const user = userEvent.setup();
    const handleRemove = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CommitteesRubricsView
        committees={sampleCommittees}
        rubrics={sampleRubrics}
        currentUserRole="master_admin"
        onRemoveCommittee={handleRemove}
      />
    );

    const removeBtn = screen.getByRole("button", {
      name: /remove committee graphic design/i,
    });
    await user.click(removeBtn);

    expect(handleRemove).toHaveBeenCalledWith("com-2");
    expect(screen.queryByText("Graphic Design")).not.toBeInTheDocument();
  });
});
