import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonManagerView } from "@/components/hr/season-manager-view";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/season-settings";

describe("SeasonManagerView Component", () => {
  const sampleTracks = [
    {
      id: "trk-tech",
      name: "Technical",
      slug: "technical",
      description: "Engineering & hardware committees",
      committeeCount: 6,
      directorNames: ["Eng. Karim"],
    },
    {
      id: "trk-creative",
      name: "Creative",
      slug: "creative",
      description: "Design, media & branding",
      committeeCount: 3,
      directorNames: [],
    },
    {
      id: "trk-ops",
      name: "Operations",
      slug: "operations",
      description: "HR, PR & logistics",
      committeeCount: 3,
      directorNames: ["Sara Tarek"],
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
  ];

  const sampleSeasons = [
    {
      id: "s-1",
      name: "Fall 2026",
      status: "active" as const,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-01-31"),
      committeeCount: 12,
      memberCount: 84,
      settings: DEFAULT_SEASON_SETTINGS,
      tracks: sampleTracks,
      rubrics: sampleRubrics,
    },
    {
      id: "s-0",
      name: "Spring 2026",
      status: "archived" as const,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-07-31"),
      committeeCount: 12,
      memberCount: 78,
      settings: DEFAULT_SEASON_SETTINGS,
      tracks: sampleTracks,
      rubrics: sampleRubrics,
    },
  ];

  it("renders active and archived seasons and triggers the clone modal", async () => {
    const user = userEvent.setup();
    render(<SeasonManagerView seasons={sampleSeasons} />);

    expect(screen.getAllByText("Fall 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    const cloneButton = screen.getByRole("button", { name: /clone season/i });
    expect(cloneButton).toBeInTheDocument();

    await user.click(cloneButton);
    expect(
      screen.getByText(/committees and scoring rubrics/i)
    ).toBeInTheDocument();
  });

  it("lets hr_admin edit season settings including task defaults and feedback bonus/deduction caps while hiding season lifecycle controls", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = vi.fn().mockResolvedValue({ ok: true });
    render(
      <SeasonManagerView
        seasons={sampleSeasons}
        currentUserRole="hr_admin"
        onUpdateSettings={onUpdateSettings}
      />
    );

    expect(screen.queryByRole("button", { name: /clone season/i })).not.toBeInTheDocument();
    expect(screen.getByText(/HR Head Settings Access/i)).toBeInTheDocument();

    const maxBonusInput = screen.getByLabelText(/max bonus per feedback/i);
    await user.clear(maxBonusInput);
    await user.type(maxBonusInput, "35");

    const modeSelect = screen.getByLabelText(/default completion mode/i);
    await user.selectOptions(modeSelect, "hr_only");

    await user.click(screen.getByRole("button", { name: /save season settings/i }));

    expect(onUpdateSettings).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        tasks: expect.objectContaining({ defaultCompletionMode: "hr_only" }),
        feedback: expect.objectContaining({ maxBonusPoints: 35 }),
      })
    );
  });

  it("explains what a season entails and lets admins edit and save grading and attendance settings", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SeasonManagerView
        seasons={sampleSeasons}
        onUpdateSettings={onUpdateSettings}
      />
    );

    // Clear "What a Season Entails" explanation
    expect(screen.getByText(/what a season entails/i)).toBeInTheDocument();

    // Edit attendance base points and effort weight inside active season settings
    const basePointsInput = screen.getByLabelText(/base attendance points/i);
    await user.clear(basePointsInput);
    await user.type(basePointsInput, "15");

    const effortWeightInput = screen.getByLabelText(/effort weight/i);
    await user.clear(effortWeightInput);
    await user.type(effortWeightInput, "12");

    const saveBtn = screen.getByRole("button", {
      name: /save season settings/i,
    });
    await user.click(saveBtn);

    expect(onUpdateSettings).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        attendance: expect.objectContaining({ defaultBasePoints: 15 }),
        grading: expect.objectContaining({ effortWeight: 12 }),
      })
    );
  });

  it("manages editable committee tracks inside season settings and locks archived seasons", async () => {
    const user = userEvent.setup();
    const onAddTrack = vi
      .fn()
      .mockResolvedValue({ ok: true, trackId: "trk-new", slug: "research-innovation" });
    const onRenameTrack = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SeasonManagerView
        seasons={sampleSeasons}
        onAddTrack={onAddTrack}
        onRenameTrack={onRenameTrack}
      />
    );

    // Switch to Committee Tracks tab in Season Settings
    await user.click(
      screen.getByRole("button", { name: /committee tracks/i })
    );

    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Creative")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Eng. Karim")).toBeInTheDocument();

    // Add a new future track
    const newTrackInput = screen.getByLabelText(/new track title/i);
    await user.type(newTrackInput, "Research & Innovation");
    await user.click(screen.getByRole("button", { name: /add track/i }));

    expect(onAddTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Research & Innovation",
        seasonId: "s-1",
      })
    );
    expect(await screen.findByText("Research & Innovation")).toBeInTheDocument();

    // Rename Operations track inline
    const renameBtn = screen.getByRole("button", {
      name: /edit track operations/i,
    });
    await user.click(renameBtn);
    const editTitleInput = screen.getByLabelText(/edit title for operations/i);
    await user.clear(editTitleInput);
    await user.type(editTitleInput, "Chapter Operations");
    await user.click(screen.getByRole("button", { name: /save track/i }));

    expect(onRenameTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: "trk-ops",
        name: "Chapter Operations",
      })
    );

    // Select archived season -> settings become read-only
    const archivedCard = screen
      .getByText("Spring 2026")
      .closest("[data-season-card]");
    expect(archivedCard).not.toBeNull();
    await user.click(
      within(archivedCard as HTMLElement).getByRole("button", {
        name: /settings/i,
      })
    );

    expect(screen.getByText(/archived seasons are read-only/i)).toBeInTheDocument();
  });
});
