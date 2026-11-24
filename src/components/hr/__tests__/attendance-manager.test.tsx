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

  it("creates a session with auto-start as default (no checkbox), immediately inserts it into the list, and shows confirmation", async () => {
    const user = userEvent.setup();
    const createdStart = new Date(Date.now() + 60 * 60_000);
    const createdEnd = new Date(createdStart.getTime() + 45 * 60_000);
    const handleCreateSession = vi.fn().mockResolvedValue({
      ok: true,
      sessionId: "sess-new",
      session: {
        id: "sess-new",
        title: "Deep Learning Lab 1",
        committeeId: "comm-ai",
        committeeName: "AI and Machine Learning",
        startsAt: createdStart,
        checkinOpen: true,
        checkinCode: "901234",
        checkinStartsAt: createdStart,
        checkinEndsAt: createdEnd,
        punctualityStartsAt: null,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        attendanceCount: 0,
      },
    });

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
    // Auto-start is always default behavior — no checkbox should exist
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

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
    // Should not send removed openCheckinImmediately property
    expect(handleCreateSession.mock.calls[0][0]).not.toHaveProperty(
      "openCheckinImmediately"
    );

    // Newly created session immediately renders in the list with confirmation status banner
    expect(await screen.findByText("Deep Learning Lab 1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /deep learning lab 1/i
    );
    expect(screen.getByText("901234")).toBeInTheDocument();
  });

  it("hides Create Session and explains scope when an hr_member has no assigned committee", () => {
    render(
      <AttendanceManagerView
        sessions={[]}
        currentUserRole="hr_member"
        currentUserCommitteeId={null}
        currentUserCommitteeName={null}
      />
    );

    expect(
      screen.queryByRole("button", { name: /create session/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/not assigned to a committee/i)
    ).toBeInTheDocument();
  });

  it("auto-marks sessions with an expired checkinEndsAt as Closed while preserving their persistent QR and code", async () => {
    const user = userEvent.setup();
    const expiredSession = {
      id: "sess-expired",
      title: "Expired Check-In Meeting",
      committeeName: "Branch-wide",
      startsAt: new Date("2026-09-01T10:00:00Z"),
      checkinOpen: true,
      checkinCode: "112233",
      checkinStartsAt: new Date("2020-01-01T00:00:00Z"),
      checkinEndsAt: new Date("2020-01-01T00:30:00Z"),
      punctualityCutoffMinutes: 15,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 5,
    };

    render(<AttendanceManagerView sessions={[expiredSession]} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Check-in Open")).not.toBeInTheDocument();
    expect(screen.getByText("112233")).toBeInTheDocument();

    const qrBtn = screen.getByRole("button", { name: /view qr & code/i });
    expect(qrBtn).not.toBeDisabled();
    await user.click(qrBtn);

    expect(screen.getByText(/check-in window closed/i)).toBeInTheDocument();
    expect(screen.getAllByText("112233").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("button", { name: /re-open \(\+15m\)/i })
    ).toBeInTheDocument();
  });

  it("prompts for punctuality grace period choice when re-opening a past/delayed session whose cutoff has passed", async () => {
    const user = userEvent.setup();
    const handleToggleCheckin = vi.fn().mockResolvedValue({
      ok: true,
      checkinOpen: true,
      checkinCode: "112233",
      checkinStartsAt: new Date(),
      checkinEndsAt: new Date(Date.now() + 30 * 60_000),
      punctualityStartsAt: new Date(),
    });
    const pastSession = {
      id: "sess-past",
      title: "Delayed Robotics Workshop",
      committeeName: "Robotics",
      startsAt: new Date(Date.now() - 60 * 60_000), // 1 hour ago
      checkinOpen: false,
      checkinCode: "112233",
      checkinStartsAt: new Date(Date.now() - 60 * 60_000),
      checkinEndsAt: new Date(Date.now() - 30 * 60_000),
      punctualityCutoffMinutes: 15,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 0,
    };

    render(
      <AttendanceManagerView
        sessions={[pastSession]}
        onToggleCheckin={handleToggleCheckin}
      />
    );

    const reopenBtn = screen.getByRole("button", {
      name: /re-open check-in/i,
    });
    await user.click(reopenBtn);

    // Should prompt before firing toggle
    expect(handleToggleCheckin).not.toHaveBeenCalled();
    expect(
      screen.getByText(/punctuality cutoff has passed/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /reset grace period from now/i })
    );

    expect(handleToggleCheckin).toHaveBeenCalledWith("sess-past", true, 30, {
      resetPunctualityFromNow: true,
    });
  });

  it("displays Scheduled badge and persistent QR & code before a future session starts", async () => {
    const user = userEvent.setup();
    const futureStart = new Date(Date.now() + 2 * 60 * 60_000);
    const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);

    const scheduledSession = {
      id: "sess-future",
      title: "Embedded Systems Intro",
      committeeName: "Embedded Systems",
      startsAt: futureStart,
      checkinOpen: true,
      checkinCode: "554433",
      checkinStartsAt: futureStart,
      checkinEndsAt: futureEnd,
      punctualityCutoffMinutes: 15,
      basePoints: 10,
      punctualityBonus: 5,
      attendanceCount: 0,
    };

    render(<AttendanceManagerView sessions={[scheduledSession]} />);

    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Check-in Open")).not.toBeInTheDocument();
    expect(screen.getByText("554433")).toBeInTheDocument();

    const qrBtn = screen.getByRole("button", { name: /view qr & code/i });
    expect(qrBtn).not.toBeDisabled();
    await user.click(qrBtn);

    expect(screen.getByText(/scheduled auto-open/i)).toBeInTheDocument();
    expect(
      screen.getByText(/add this qr to your slides/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("554433").length).toBeGreaterThanOrEqual(2);
  });

  it("opens the attendance sheet, displays exact status-updated timestamps, and updates them on manual status change", async () => {
    const user = userEvent.setup();
    const updatedIso = "2026-11-24T14:35:42.000Z";
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
          statusUpdatedAt: null,
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
          checkedInAt: "2026-09-12T16:02:15.000Z",
          statusUpdatedAt: "2026-09-12T16:02:15.000Z",
          overrideReason: null,
        },
      ],
    });
    const onSetAttendance = vi.fn().mockResolvedValue({
      ok: true,
      pointsAwarded: 10,
      statusUpdatedAt: updatedIso,
    });

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

    // Status Updated column header and initial timestamp / Not recorded state
    expect(screen.getByText(/status updated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not recorded/i).length).toBeGreaterThanOrEqual(
      1
    );
    const omarExpectedTime = new Date("2026-09-12T16:02:15.000Z").toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }
    );
    expect(screen.getAllByText(omarExpectedTime).length).toBeGreaterThanOrEqual(
      1
    );

    // Click "Late" for Salma and verify exact timestamp updates from server response
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

    const salmaUpdatedFormatted = new Date(updatedIso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    expect(
      (await screen.findAllByText(salmaUpdatedFormatted)).length
    ).toBeGreaterThanOrEqual(1);

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
