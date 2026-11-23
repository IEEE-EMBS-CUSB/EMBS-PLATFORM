import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitteesRubricsView } from "../committees-rubrics-view";
import { RosterManagerView } from "../roster-manager-view";
import { SeasonManagerView } from "../season-manager-view";
import { LeaderboardPublisherView } from "../leaderboard-publisher-view";
import { AttendanceManagerView } from "../attendance-manager-view";
import { BulkTaskGradingView } from "../bulk-task-grading-view";

describe("HR UI Salvage Regression Suite", () => {
  it("CommitteesRubricsView links to Scoring Settings and opens Add Committee modal for master_admin", async () => {
    const user = userEvent.setup();
    const onAddCommittee = vi.fn().mockResolvedValue({
      ok: true,
      committee: {
        id: "comm-new-1",
        name: "Signal Processing",
        slug: "signal-processing",
        category: "technical",
        trackId: "technical",
        isActive: true,
        memberCount: 0,
      },
    });

    render(
      <CommitteesRubricsView
        committees={[]}
        currentUserRole="master_admin"
        onAddCommittee={onAddCommittee}
      />
    );

    expect(
      screen.getByRole("link", { name: /scoring settings/i })
    ).toHaveAttribute("href", "/hr/seasons");

    await user.click(screen.getByRole("button", { name: /add committee/i }));
    await user.type(screen.getByLabelText(/committee name/i), "Signal Processing");
    await user.click(screen.getByRole("button", { name: /create committee/i }));

    await waitFor(() => {
      expect(onAddCommittee).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Signal Processing" })
      );
    });
    expect(screen.getByText("Signal Processing")).toBeInTheDocument();
  });

  it("RosterManagerView Confirm Import invokes onBulkImport with the CSV payload", async () => {
    const user = userEvent.setup();
    const onBulkImport = vi.fn().mockResolvedValue({
      ok: true,
      importedCount: 1,
      skippedCount: 0,
      imported: [
        {
          id: "real-member-1",
          fullName: "Nour Ali",
          email: "nour.ali@cu.edu.eg",
          role: "member",
          committeeId: "comm-ai-ml",
          tempPassword: "EMBS-2026-ABCD1234",
        },
      ],
    });

    render(
      <RosterManagerView
        members={[]}
        currentUserRole="master_admin"
        onBulkImport={onBulkImport}
      />
    );

    await user.click(screen.getByRole("button", { name: /csv bulk import/i }));
    const csv = "full_name,email,committee_slug,role\nNour Ali,nour.ali@cu.edu.eg,ai-and-machine-learning,member";
    await user.type(screen.getByLabelText(/csv roster content/i), csv);
    await user.click(screen.getByRole("button", { name: /validate & preview/i }));
    await user.click(screen.getByRole("button", { name: /confirm import/i }));

    await waitFor(() => {
      expect(onBulkImport).toHaveBeenCalledWith(csv);
    });
    expect(screen.getByText("Nour Ali")).toBeInTheDocument();
  });

  it("SeasonManagerView hides per-card Clone for non-master roles and exposes Create/Activate/Archive for master_admin", async () => {
    const seasons = [
      {
        id: "s-active",
        name: "Fall 2026",
        status: "active" as const,
        startDate: new Date("2026-09-01"),
        committeeCount: 12,
        memberCount: 40,
      },
      {
        id: "s-draft",
        name: "Spring 2027",
        status: "draft" as const,
        startDate: new Date("2027-02-01"),
        committeeCount: 12,
        memberCount: 0,
      },
    ];

    const { rerender } = render(
      <SeasonManagerView seasons={seasons} currentUserRole="hr_admin" />
    );
    expect(screen.queryByRole("button", { name: /clone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activate/i })).not.toBeInTheDocument();

    const onActivate = vi.fn().mockResolvedValue({ ok: true });
    const onArchive = vi.fn().mockResolvedValue({ ok: true });
    const onCreate = vi.fn().mockResolvedValue({ ok: true, seasonId: "s-new" });

    rerender(
      <SeasonManagerView
        seasons={seasons}
        currentUserRole="master_admin"
        onCreateSeason={onCreate}
        onActivateSeason={onActivate}
        onArchiveSeason={onArchive}
      />
    );

    expect(screen.getByRole("button", { name: /new season/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archive/i })).toBeInTheDocument();
  });

  it("LeaderboardPublisherView fetches snapshot when month changes and refuses to mark published on error", async () => {
    const user = userEvent.setup();
    const onLoadMonth = vi.fn().mockResolvedValue({
      ok: true,
      snapshot: {
        month: "2026-09",
        status: "published" as const,
        publishedAt: "2026-10-01",
        committeeEntries: {},
      },
    });
    const onPublish = vi.fn().mockResolvedValue({ ok: false, error: "DB write failed" });

    render(
      <LeaderboardPublisherView
        snapshot={{
          month: "2026-10",
          status: "draft",
          committeeEntries: {},
        }}
        availableMonths={["2026-10", "2026-09"]}
        onPublish={onPublish}
        onLoadMonth={onLoadMonth}
      />
    );

    // Failed publish must NOT switch status to Published & Locked
    await user.click(screen.getByRole("button", { name: /publish & freeze rankings/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/db write failed/i);
    });
    expect(screen.queryByText(/published & locked/i)).not.toBeInTheDocument();

    // Switching month must fetch that month's snapshot
    await user.selectOptions(screen.getByRole("combobox"), "2026-09");
    await waitFor(() => {
      expect(onLoadMonth).toHaveBeenCalledWith("2026-09");
    });
    expect(screen.getAllByText(/published & locked/i).length).toBeGreaterThan(0);
  });

  it("AttendanceManagerView disables projector for closed sessions and never renders hardcoded 948216", () => {
    render(
      <AttendanceManagerView
        sessions={[
          {
            id: "sess-closed",
            title: "Closed Workshop",
            committeeId: "c1",
            committeeName: "AI",
            startsAt: new Date("2026-10-10T10:00:00Z"),
            checkinOpen: false,
            checkinCode: null,
            basePoints: 10,
            punctualityBonus: 5,
            attendanceCount: 0,
          },
        ]}
        currentUserRole="hr_admin"
      />
    );

    const openBtn = screen.getByRole("button", { name: /open live check-in/i });
    expect(openBtn).toBeDisabled();
    expect(screen.queryByText("948216")).not.toBeInTheDocument();
  });

  it("BulkTaskGradingView does not show fake Saved badge on keystroke and surfaces save errors", async () => {
    const user = userEvent.setup();
    const onGrade = vi.fn().mockResolvedValue({ ok: false, error: "Unauthorized" });

    render(
      <BulkTaskGradingView
        task={{ id: "t1", title: "Lab 1", committeeName: "AI", maxPoints: 100 }}
        submissions={[
          {
            submissionId: "sub-1",
            membershipId: "m1",
            memberName: "Omar Tarek",
            effortScore: 4,
            qualityScore: 4,
            timelinessScore: 4,
            totalPoints: 80,
            notes: "",
          },
        ]}
        onGrade={onGrade}
      />
    );

    const effortInput = screen.getByLabelText(/effort score for omar tarek/i);
    await user.clear(effortInput);
    await user.type(effortInput, "5");

    // Must NOT flash fake Saved badge before clicking Save Grades
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save grades/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unauthorized/i);
    });
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
  });
});
