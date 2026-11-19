import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceManagerView } from "@/components/hr/attendance-manager-view";

describe("AttendanceManagerView Component", () => {
  const sampleSessions = [
    {
      id: "sess-1",
      title: "Season Opening General Meeting",
      committeeName: "Branch-wide",
      startsAt: new Date("2026-09-05T17:00:00Z"),
      checkinOpen: true,
      checkinCode: "847291",
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 42,
    },
    {
      id: "sess-2",
      title: "AI & ML Workshop 1",
      committeeName: "AI and Machine Learning",
      startsAt: new Date("2026-09-12T16:00:00Z"),
      checkinOpen: false,
      checkinCode: null,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 14,
    },
  ];

  it("renders branch sessions and opens the live check-in screen", async () => {
    const user = userEvent.setup();
    render(<AttendanceManagerView sessions={sampleSessions} />);

    expect(
      screen.getByText("Season Opening General Meeting")
    ).toBeInTheDocument();
    expect(screen.getByText("AI & ML Workshop 1")).toBeInTheDocument();

    const liveCheckinBtns = screen.getAllByRole("button", {
      name: /open live check-in/i,
    });
    await user.click(liveCheckinBtns[0]);

    expect(screen.getAllByText("847291").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/scan qr or enter code/i)).toBeInTheDocument();
  });

  it("allows a Committee Head to create a new session with check-in window", async () => {
    const user = userEvent.setup();
    const handleCreateSession = vi.fn().mockResolvedValue({ ok: true });

    render(
      <AttendanceManagerView
        sessions={sampleSessions}
        currentUserRole="committee_head"
        currentUserCommitteeId="comm-ai"
        currentUserCommitteeName="AI and Machine Learning"
        onCreateSession={handleCreateSession}
      />
    );

    const createBtn = screen.getByRole("button", { name: /create session/i });
    await user.click(createBtn);

    expect(screen.getByText(/create new session/i)).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/session title/i);
    await user.type(titleInput, "Deep Learning Lab 1");

    const windowSelect = screen.getByLabelText(/check-in window/i);
    await user.selectOptions(windowSelect, "45");

    const submitBtn = screen.getByRole("button", { name: /save session/i });
    await user.click(submitBtn);

    expect(handleCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Deep Learning Lab 1",
        checkinWindowMinutes: 45,
        committeeId: "comm-ai",
      })
    );
  });
});
