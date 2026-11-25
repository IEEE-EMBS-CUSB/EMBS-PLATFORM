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

  it("renders active and archived seasons, hides Archive on active season, and allows master_admin to re-activate an archived season", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onActivateSeason = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SeasonManagerView
        seasons={sampleSeasons}
        currentUserRole="master_admin"
        onActivateSeason={onActivateSeason}
      />
    );

    expect(screen.getAllByText("Fall 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    // Active season must NOT have an Archive button (avoid leaving no active season)
    const activeCard = screen
      .getByText("Fall 2026")
      .closest("[data-season-card]") as HTMLElement;
    expect(
      within(activeCard).queryByRole("button", { name: /^archive$/i })
    ).not.toBeInTheDocument();

    // Archived season exposes Re-activate for master_admin
    const archivedCard = screen
      .getByText("Spring 2026")
      .closest("[data-season-card]") as HTMLElement;
    const reactivateBtn = within(archivedCard).getByRole("button", {
      name: /re-activate/i,
    });
    await user.click(reactivateBtn);

    expect(onActivateSeason).toHaveBeenCalledWith("s-0");
    expect(within(archivedCard).getByText("Active")).toBeInTheDocument();
    expect(within(activeCard).getByText("Archived")).toBeInTheDocument();

    const cloneButton = screen.getByRole("button", { name: /clone season/i });
    expect(cloneButton).toBeInTheDocument();

    await user.click(cloneButton);
    expect(
      screen.getByText(/committees and scoring rubrics/i)
    ).toBeInTheDocument();

    confirmSpy.mockRestore();
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

    // Settings should open in a modal when clicking Settings (not rendered inline)
    expect(screen.queryByRole("dialog", { name: /season settings/i })).not.toBeInTheDocument();
    const activeCard = screen.getByText("Fall 2026").closest("[data-season-card]") as HTMLElement;
    await user.click(within(activeCard).getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("dialog", { name: /season settings — fall 2026/i })).toBeInTheDocument();

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

  it("opens season settings in a modal to edit and save rules without explanatory architecture boilerplate", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = vi.fn().mockResolvedValue({ ok: true });

    render(
      <SeasonManagerView
        seasons={sampleSeasons}
        onUpdateSettings={onUpdateSettings}
      />
    );

    expect(screen.queryByText(/what a season entails/i)).not.toBeInTheDocument();

    // Open active season settings modal
    const activeCard = screen.getByText("Fall 2026").closest("[data-season-card]") as HTMLElement;
    await user.click(within(activeCard).getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("dialog", { name: /season settings — fall 2026/i })).toBeInTheDocument();

    // Edit attendance base points and effort weight inside active season settings modal
    const basePointsInput = screen.getByLabelText(/base attendance points/i);
    await user.clear(basePointsInput);
    await user.type(basePointsInput, "15");

    const effortWeightInput = screen.getByLabelText(/effort weight/i);
    await user.clear(effortWeightInput);
    await user.type(effortWeightInput, "12");

    // Edit online session base points & punctuality bonus separately from offline
    const onlineBaseInput = screen.getByLabelText(/online session base points/i);
    await user.clear(onlineBaseInput);
    await user.type(onlineBaseInput, "6");

    const onlineBonusInput = screen.getByLabelText(/online punctuality bonus/i);
    await user.clear(onlineBonusInput);
    await user.type(onlineBonusInput, "2");

    const saveBtn = screen.getByRole("button", {
      name: /save season settings/i,
    });
    await user.click(saveBtn);

    expect(onUpdateSettings).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        attendance: expect.objectContaining({
          defaultBasePoints: 15,
          onlineBasePoints: 6,
          onlinePunctualityBonus: 2,
        }),
        grading: expect.objectContaining({ effortWeight: 12 }),
      })
    );
  });

  it("manages editable committee tracks inside season settings modal and locks archived seasons", async () => {
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

    // Open active season settings modal
    const activeCard = screen.getByText("Fall 2026").closest("[data-season-card]") as HTMLElement;
    await user.click(within(activeCard).getByRole("button", { name: /settings/i }));

    // Switch to Committee Tracks tab in Season Settings modal
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

    // Close modal, then open archived season settings -> read-only banner shown
    await user.click(screen.getByRole("button", { name: /close season settings/i }));
    expect(screen.queryByRole("dialog", { name: /season settings/i })).not.toBeInTheDocument();

    const archivedCard = screen
      .getByText("Spring 2026")
      .closest("[data-season-card]");
    expect(archivedCard).not.toBeNull();
    await user.click(
      within(archivedCard as HTMLElement).getByRole("button", {
        name: /settings/i,
      })
    );

    expect(screen.getByRole("dialog", { name: /season settings — spring 2026/i })).toBeInTheDocument();
    expect(screen.getByText(/archived seasons are read-only/i)).toBeInTheDocument();
  });
});
