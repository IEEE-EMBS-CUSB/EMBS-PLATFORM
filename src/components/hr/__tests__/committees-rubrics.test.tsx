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

  it("renders committee tracks cleanly without disconnected scoring rubrics tab and protects core human-resources committee", () => {
    render(
      <CommitteesRubricsView
        committees={[
          ...sampleCommittees,
          {
            id: "com-hr",
            name: "Human Resources",
            slug: "human-resources",
            category: "non_technical" as const,
            isActive: true,
            memberCount: 6,
          },
        ]}
        rubrics={sampleRubrics}
      />
    );

    expect(screen.getByText("AI and Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Graphic Design")).toBeInTheDocument();
    expect(screen.getByText("Human Resources")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scoring rubrics/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scoring settings/i })).toHaveAttribute(
      "href",
      "/hr/seasons"
    );
    expect(
      screen.queryByRole("button", { name: /remove committee human resources/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
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

  it("groups committees by editable tracks, shows track directors, and supports track editing and reassignment", async () => {
    const user = userEvent.setup();
    const handleAddTrack = vi
      .fn()
      .mockResolvedValue({ ok: true, trackId: "trk-outreach", slug: "biomedical-outreach" });
    const handleRenameTrack = vi.fn().mockResolvedValue({ ok: true });
    const handleAssignTrack = vi.fn().mockResolvedValue({ ok: true });

    const sampleTracks = [
      {
        id: "trk-tech",
        name: "Technical",
        slug: "technical",
        description: "Engineering & hardware committees",
        directorNames: ["Eng. Karim"],
      },
      {
        id: "trk-creative",
        name: "Creative",
        slug: "creative",
        description: "Design & media",
        directorNames: [],
      },
      {
        id: "trk-ops",
        name: "Operations",
        slug: "operations",
        description: "HR, PR & logistics",
        directorNames: ["Sara Tarek"],
      },
    ];

    const trackedCommittees = [
      { ...sampleCommittees[0], trackId: "trk-tech" },
      { ...sampleCommittees[1], trackId: "trk-creative" },
    ];

    render(
      <CommitteesRubricsView
        tracks={sampleTracks}
        committees={trackedCommittees}
        rubrics={sampleRubrics}
        currentUserRole="master_admin"
        onAddTrack={handleAddTrack}
        onRenameTrack={handleRenameTrack}
        onAssignCommitteeTrack={handleAssignTrack}
      />
    );

    expect(screen.getByText(/Eng\. Karim/i)).toBeInTheDocument();
    expect(screen.getByText(/Sara Tarek/i)).toBeInTheDocument();

    // Move Graphic Design from Creative to Operations
    const trackSelect = screen.getByLabelText(/assign track for graphic design/i);
    await user.selectOptions(trackSelect, "trk-ops");
    expect(handleAssignTrack).toHaveBeenCalledWith("com-2", "trk-ops");

    // Rename Operations track
    await user.click(screen.getByRole("button", { name: /rename track operations/i }));
    const renameInput = screen.getByLabelText(/track title for operations/i);
    await user.clear(renameInput);
    await user.type(renameInput, "Chapter Operations");
    await user.click(screen.getByRole("button", { name: /save track title/i }));
    expect(handleRenameTrack).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "trk-ops", name: "Chapter Operations" })
    );

    // Add a new future track
    await user.click(screen.getByRole("button", { name: /new track/i }));
    const newTrackTitle = screen.getByLabelText(/track title/i);
    await user.type(newTrackTitle, "Biomedical Outreach");
    await user.click(screen.getByRole("button", { name: /create track/i }));
    expect(handleAddTrack).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Biomedical Outreach" })
    );
    expect(
      await screen.findByRole("heading", { name: /biomedical outreach/i })
    ).toBeInTheDocument();
  });
});
