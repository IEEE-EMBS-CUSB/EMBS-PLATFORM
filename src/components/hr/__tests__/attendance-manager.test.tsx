import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceManagerView } from "@/components/hr/attendance-manager-view";
import type { InstructorCandidate } from "@/services/hr-ops/attendance.service";

describe("AttendanceManagerView Component", () => {
  const sampleInstructorCandidates: InstructorCandidate[] = [
    {
      membershipId: "inst-ai-1",
      personId: "p-salma",
      fullName: "Salma El-Sayed",
      email: "salma@cu.edu.eg",
      role: "committee_head",
      committeeId: "comm-ai",
      committeeName: "AI and Machine Learning",
      isActive: true,
    },
    {
      membershipId: "inst-ai-2",
      personId: "p-youssef",
      fullName: "Youssef Adel",
      email: "youssef@cu.edu.eg",
      role: "committee_head",
      committeeId: "comm-ai",
      committeeName: "AI and Machine Learning",
      isActive: true,
    },
    {
      membershipId: "inst-web-1",
      personId: "p-ziad",
      fullName: "Ziad Hany",
      email: "ziad@cu.edu.eg",
      role: "committee_head",
      committeeId: "comm-web",
      committeeName: "Web Development",
      isActive: true,
    },
    {
      membershipId: "inst-master",
      personId: "p-master",
      fullName: "Master Administrator",
      email: "master@cu.edu.eg",
      role: "master_admin",
      committeeId: null,
      committeeName: null,
      isActive: true,
    },
    {
      membershipId: "inst-director",
      personId: "p-khaled",
      fullName: "Khaled Mansour",
      email: "director@cu.edu.eg",
      role: "director",
      committeeId: null,
      committeeName: null,
      isActive: true,
    },
    {
      membershipId: "inst-hr-admin",
      personId: "p-sara",
      fullName: "Sara Hassan",
      email: "hr.lead@cu.edu.eg",
      role: "hr_admin",
      committeeId: "comm-hr",
      committeeName: "Human Resources",
      isActive: true,
    },
  ];

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
      sessionMode: "offline" as const,
      locationAddress: "Main Campus Hall 1",
      locationUrl: "https://maps.google.com/?q=Cairo+University",
      instructors: [
        {
          membershipId: "inst-director",
          fullName: "Khaled Mansour",
          role: "director" as const,
        },
      ],
      attendanceCount: 42,
    },
    {
      id: "sess-2",
      title: "AI & ML Workshop 1",
      committeeName: "AI and Machine Learning",
      startsAt: new Date("2026-09-12T16:00:00Z"),
      checkinOpen: false,
      checkinCode: null,
      basePoints: 5,
      punctualityBonus: 5,
      sessionMode: "online" as const,
      webConferencingUrl: "https://meet.google.com/ai-ml-one",
      instructors: [
        {
          membershipId: "inst-ai-1",
          fullName: "Salma El-Sayed",
          role: "committee_head" as const,
        },
      ],
      attendanceCount: 14,
    },
  ];

  it("renders branch sessions with mode badges, instructors, location/meeting links, and opens the live check-in screen", async () => {
    const user = userEvent.setup();
    render(<AttendanceManagerView sessions={sampleSessions} />);

    expect(
      screen.getByText("Season Opening General Meeting")
    ).toBeInTheDocument();
    expect(screen.getByText("AI & ML Workshop 1")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText(/Khaled Mansour/)).toBeInTheDocument();
    expect(screen.getByText(/Salma El-Sayed/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /main campus hall 1/i })
    ).toHaveAttribute("href", "https://maps.google.com/?q=Cairo+University");

    const liveCheckinBtns = screen.getAllByRole("button", {
      name: /open live check-in/i,
    });
    await user.click(liveCheckinBtns[0]);

    expect(screen.getAllByText("847291").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/scan qr or enter code/i)).toBeInTheDocument();
  });

  it("switches between offline and online modes, applies HR mode-specific scoring, enforces required conferencing link for committee_head on online sessions, and picks a subset of committee heads via MemberCombobox", async () => {
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
        basePoints: 6,
        punctualityBonus: 2,
        sessionMode: "online",
        slideDeckUrl: "https://docs.google.com/presentation/d/dl-lab-1",
        webConferencingUrl: "https://meet.google.com/lab-one-meet",
        locationUrl: null,
        locationAddress: null,
        instructors: [
          {
            membershipId: "inst-ai-1",
            fullName: "Salma El-Sayed",
            role: "committee_head",
          },
          {
            membershipId: "inst-ai-2",
            fullName: "Youssef Adel",
            role: "committee_head",
          },
        ],
        attendanceCount: 0,
      },
    });

    render(
      <AttendanceManagerView
        sessions={sampleSessions}
        currentUserRole="committee_head"
        currentUserCommitteeId="comm-ai"
        currentUserCommitteeName="AI and Machine Learning"
        instructorCandidates={sampleInstructorCandidates}
        attendanceDefaults={{
          defaultBasePoints: 12,
          defaultPunctualityBonus: 6,
          onlineBasePoints: 6,
          onlinePunctualityBonus: 2,
          punctualityCutoffMinutes: 15,
          defaultCheckinWindowMinutes: 30,
        }}
        onCreateSession={handleCreateSession}
      />
    );

    await user.click(screen.getByRole("button", { name: /create session/i }));

    expect(screen.getByText(/create new session/i)).toBeInTheDocument();
    // Auto-start is always default behavior — no checkbox should exist
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    // Default mode is Offline: shows Location Address & Location Link, hides Web Conferencing Link, and reflects Offline HR points (12 + 6)
    expect(screen.getByLabelText(/location address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location link/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/web conferencing link/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/base points/i)).toHaveValue(12);
    expect(screen.getByLabelText(/punctuality bonus points/i)).toHaveValue(6);

    // Switch to Online: swaps to Web Conferencing Link (Required for committee_head) and updates points to Online HR defaults (6 + 2)
    await user.click(screen.getByRole("radio", { name: /online/i }));
    expect(
      screen.queryByLabelText(/location address/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/base points/i)).toHaveValue(6);
    expect(screen.getByLabelText(/punctuality bonus points/i)).toHaveValue(2);

    const meetingInput = screen.getByLabelText(/web conferencing link/i);
    expect(meetingInput).toBeRequired();

    await user.type(
      screen.getByLabelText(/session title/i),
      "Deep Learning Lab 1"
    );

    const slideDeckInput = screen.getByLabelText(/slide deck url/i);
    expect(slideDeckInput).toBeRequired();
    await user.type(
      slideDeckInput,
      "https://docs.google.com/presentation/d/dl-lab-1"
    );
    await user.type(meetingInput, "https://meet.google.com/lab-one-meet");

    // Instructor selector (MemberCombobox) only offers AI heads (Salma & Youssef), never Web Dev head or branch leaders
    const instructorCombo = screen.getByRole("combobox", {
      name: /session instructor/i,
    });
    await user.click(instructorCombo);
    expect(
      screen.getByRole("option", { name: /salma el-sayed/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /youssef adel/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /ziad hany/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /sara hassan/i })
    ).not.toBeInTheDocument();

    // Pick both AI heads
    await user.click(screen.getByRole("option", { name: /salma el-sayed/i }));
    await user.click(instructorCombo);
    await user.click(screen.getByRole("option", { name: /youssef adel/i }));

    const windowSelect = screen.getByLabelText(/check-in window/i);
    await user.selectOptions(windowSelect, "45");

    await user.click(screen.getByRole("button", { name: /save session/i }));

    expect(handleCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Deep Learning Lab 1",
        sessionMode: "online",
        slideDeckUrl: "https://docs.google.com/presentation/d/dl-lab-1",
        webConferencingUrl: "https://meet.google.com/lab-one-meet",
        locationUrl: null,
        locationAddress: null,
        instructorMembershipIds: ["inst-ai-1", "inst-ai-2"],
        basePoints: 6,
        punctualityBonus: 2,
        checkinWindowMinutes: 45,
        committeeId: "comm-ai",
      })
    );

    expect(await screen.findByText("Deep Learning Lab 1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /deep learning lab 1/i
    );
    expect(screen.getByText("901234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /slide deck/i })
    ).toHaveAttribute(
      "href",
      "https://docs.google.com/presentation/d/dl-lab-1"
    );
    const joinLinks = screen.getAllByRole("link", { name: /join meeting/i });
    expect(
      joinLinks.some(
        (link) =>
          link.getAttribute("href") === "https://meet.google.com/lab-one-meet"
      )
    ).toBe(true);
  });

  it("allows hr_admin to create branch-wide offline or online sessions with optional links and picks instructors from masters, directors, and hr admins", async () => {
    const user = userEvent.setup();
    const handleCreateSession = vi.fn().mockResolvedValue({
      ok: true,
      sessionId: "sess-admin-opt",
      session: {
        id: "sess-admin-opt",
        title: "Branch Town Hall",
        committeeId: null,
        committeeName: "Branch-wide",
        startsAt: new Date(Date.now() + 60 * 60_000),
        checkinOpen: true,
        checkinCode: "555111",
        checkinStartsAt: new Date(Date.now() + 60 * 60_000),
        checkinEndsAt: new Date(Date.now() + 90 * 60_000),
        punctualityStartsAt: null,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        sessionMode: "offline",
        slideDeckUrl: null,
        webConferencingUrl: null,
        locationUrl: "https://maps.google.com/?q=Cairo+University+Hall",
        locationAddress: "Cairo University Main Hall",
        instructors: [
          {
            membershipId: "inst-director",
            fullName: "Khaled Mansour",
            role: "director",
          },
        ],
        attendanceCount: 0,
      },
    });

    render(
      <AttendanceManagerView
        sessions={sampleSessions}
        currentUserRole="hr_admin"
        committees={[
          { id: "comm-ai", name: "AI and Machine Learning" },
          { id: "comm-web", name: "Web Development" },
        ]}
        instructorCandidates={sampleInstructorCandidates}
        onCreateSession={handleCreateSession}
      />
    );

    await user.click(screen.getByRole("button", { name: /create session/i }));

    const slideDeckInput = screen.getByLabelText(/slide deck url/i);
    expect(slideDeckInput).not.toBeRequired();

    // Check online mode keeps web conferencing optional for hr_admin
    await user.click(screen.getByRole("radio", { name: /online/i }));
    expect(
      screen.getByLabelText(/web conferencing link/i)
    ).not.toBeRequired();

    // Switch back to offline and enter location address + link
    await user.click(screen.getByRole("radio", { name: /offline/i }));
    await user.type(
      screen.getByLabelText(/location address/i),
      "Cairo University Main Hall"
    );
    await user.type(
      screen.getByLabelText(/location link/i),
      "https://maps.google.com/?q=Cairo+University+Hall"
    );

    // Branch-wide instructor selector offers Master, Director, HR Admin (never committee heads)
    const instructorCombo = screen.getByRole("combobox", {
      name: /session instructor/i,
    });
    await user.click(instructorCombo);
    expect(
      screen.getByRole("option", { name: /master administrator/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /khaled mansour/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /sara hassan/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /salma el-sayed/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /khaled mansour/i }));

    await user.type(screen.getByLabelText(/session title/i), "Branch Town Hall");
    await user.click(screen.getByRole("button", { name: /save session/i }));

    expect(handleCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Branch Town Hall",
        sessionMode: "offline",
        slideDeckUrl: null,
        webConferencingUrl: null,
        locationAddress: "Cairo University Main Hall",
        locationUrl: "https://maps.google.com/?q=Cairo+University+Hall",
        instructorMembershipIds: ["inst-director"],
      })
    );
  });

  it("blocks submitting a session when no instructor is selected", async () => {
    const user = userEvent.setup();
    const handleCreateSession = vi.fn();

    render(
      <AttendanceManagerView
        sessions={sampleSessions}
        currentUserRole="hr_admin"
        instructorCandidates={sampleInstructorCandidates}
        onCreateSession={handleCreateSession}
      />
    );

    await user.click(screen.getByRole("button", { name: /create session/i }));
    await user.type(
      screen.getByLabelText(/session title/i),
      "Missing Instructor Session"
    );
    await user.click(screen.getByRole("button", { name: /save session/i }));

    expect(handleCreateSession).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/instructor/i);
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
      startsAt: new Date(Date.now() - 60 * 60_000),
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
    const sheetDialog = screen.getByRole("dialog", {
      name: /attendance sheet: ai & ml workshop 1/i,
    });
    expect(
      await within(sheetDialog).findByText("Salma El-Sayed")
    ).toBeInTheDocument();
    expect(within(sheetDialog).getByText("Omar Tarek")).toBeInTheDocument();

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
