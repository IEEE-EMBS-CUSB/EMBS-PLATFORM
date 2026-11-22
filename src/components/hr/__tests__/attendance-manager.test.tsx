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

  it("auto-marks sessions with an expired checkinExpiresAt as Closed even if checkinOpen is true", () => {
    const expiredSession = {
      id: "sess-expired",
      title: "Expired Check-In Meeting",
      committeeName: "Branch-wide",
      startsAt: new Date("2026-09-01T10:00:00Z"),
      checkinOpen: true,
      checkinCode: "112233",
      checkinExpiresAt: new Date("2020-01-01T00:00:00Z"),
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 5,
    };

    render(<AttendanceManagerView sessions={[expiredSession]} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Check-in Open")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open live check-in/i })
    ).toBeDisabled();
  });

  it("opens the keyboard-friendly attendance roster for a session and allows manual On Time / Late / Excused / Absent toggles", async () => {
    const user = userEvent.setup();
    const onLoadRoster = vi.fn().mockResolvedValue({
      ok: true,
      roster: [
        {
          membershipId: "m-1",
          fullName: "Salma El-Sayed",
          email: "salma@cu.edu.eg",
          committeeName: "AI and Machine Learning",
          role: "committee_head",
          status: "absent",
          pointsAwarded: 0,
          checkedInAt: null,
          overrideReason: null,
        },
        {
          membershipId: "m-2",
          fullName: "Omar Tarek",
          email: "omar@cu.edu.eg",
          committeeName: "AI and Machine Learning",
          role: "member",
          status: "on_time",
          pointsAwarded: 15,
          checkedInAt: "2026-09-12T16:02:00.000Z",
          overrideReason: null,
        },
      ],
    });
    const onSetAttendance = vi
      .fn()
      .mockResolvedValue({ ok: true, pointsAwarded: 10 });

    render(
      <AttendanceManagerView
        sessions={sampleSessions}
        onLoadSessionRoster={onLoadRoster}
        onSetMemberAttendance={onSetAttendance}
      />
    );

    const rosterButtons = screen.getAllByRole("button", {
      name: /^sheet$/i,
    });
    await user.click(rosterButtons[1]);

    expect(onLoadRoster).toHaveBeenCalledWith("sess-2");
    expect(await screen.findByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();

    // Click "Late" for Salma
    const lateBtn = screen.getByRole("button", {
      name: /mark salma el-sayed as late/i,
    });
    await user.click(lateBtn);

    expect(onSetAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess-2",
        membershipId: "m-1",
        status: "late",
      })
    );

    // Keyboard navigation: ArrowDown to Omar (index 1) and press 'e' for Excused
    await user.keyboard("{ArrowDown}e");
    expect(onSetAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess-2",
        membershipId: "m-2",
        status: "excused",
      })
    );
  });
});
