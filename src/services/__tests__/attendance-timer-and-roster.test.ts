import { describe, expect, it } from "vitest";
import {
  computeInitialSessionWindow,
  computePointsForAttendanceStatus,
  getSessionCheckinState,
  hasPunctualityCutoffPassed,
  isCheckinPunctual,
  isSessionCheckinLive,
} from "@/services/hr-ops/attendance.service";

describe("CP7 Attendance Timer & Manual Status Scoring Helpers", () => {
  it("evaluates getSessionCheckinState and isSessionCheckinLive across scheduled, live, and closed windows", () => {
    const now = new Date("2026-11-22T18:00:00Z");

    // Live: start <= now <= end
    expect(
      getSessionCheckinState(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T17:55:00Z"),
          checkinEndsAt: new Date("2026-11-22T18:15:00Z"),
        },
        now
      )
    ).toBe("live");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T17:55:00Z"),
          checkinEndsAt: new Date("2026-11-22T18:15:00Z"),
        },
        now
      )
    ).toBe(true);

    // Scheduled (future start): checkinOpen is armed, but now < checkinStartsAt
    expect(
      getSessionCheckinState(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T19:00:00Z"),
          checkinEndsAt: new Date("2026-11-22T19:30:00Z"),
        },
        now
      )
    ).toBe("scheduled");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T19:00:00Z"),
          checkinEndsAt: new Date("2026-11-22T19:30:00Z"),
        },
        now
      )
    ).toBe(false);

    // Expired deadline MUST report closed / not live even if raw DB boolean is still true
    expect(
      getSessionCheckinState(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T17:00:00Z"),
          checkinEndsAt: new Date("2026-11-22T17:59:59Z"),
        },
        now
      )
    ).toBe("closed");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinEndsAt: new Date("2026-11-22T17:59:59Z"),
        },
        now
      )
    ).toBe(false);

    // Closed flag reports closed / not live even if deadline is in the future
    expect(
      getSessionCheckinState(
        {
          checkinOpen: false,
          checkinStartsAt: new Date("2026-11-22T17:55:00Z"),
          checkinEndsAt: new Date("2026-11-22T19:00:00Z"),
        },
        now
      )
    ).toBe("closed");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: false,
          checkinEndsAt: new Date("2026-11-22T19:00:00Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("always schedules initial check-in window from startsAt until startsAt + windowMinutes", () => {
    const now = new Date("2026-11-24T14:00:00Z");

    // Future session -> armed / scheduled
    const futureStart = new Date("2026-11-24T16:00:00Z");
    const futureWindow = computeInitialSessionWindow(futureStart, 30, now);
    expect(futureWindow).toEqual({
      checkinOpen: true,
      checkinStartsAt: futureStart,
      checkinEndsAt: new Date("2026-11-24T16:30:00Z"),
    });
    expect(getSessionCheckinState(futureWindow, now)).toBe("scheduled");

    // Recent past with remaining countdown -> live immediately for remaining time
    const recentPast = new Date("2026-11-24T13:50:00Z");
    const partialWindow = computeInitialSessionWindow(recentPast, 30, now);
    expect(partialWindow).toEqual({
      checkinOpen: true,
      checkinStartsAt: recentPast,
      checkinEndsAt: new Date("2026-11-24T14:20:00Z"),
    });
    expect(getSessionCheckinState(partialWindow, now)).toBe("live");

    // Elapsed past window -> closed by default (can still be re-opened later)
    const oldPast = new Date("2026-11-24T12:00:00Z");
    const elapsedWindow = computeInitialSessionWindow(oldPast, 30, now);
    expect(elapsedWindow).toEqual({
      checkinOpen: false,
      checkinStartsAt: oldPast,
      checkinEndsAt: new Date("2026-11-24T12:30:00Z"),
    });
    expect(getSessionCheckinState(elapsedWindow, now)).toBe("closed");
  });

  it("evaluates punctuality against startsAt by default and respects punctualityStartsAt override on delayed re-opens", () => {
    const startsAt = new Date("2026-11-24T16:00:00Z");

    // Within 15m of original startsAt -> punctual
    expect(
      isCheckinPunctual(
        { startsAt, punctualityStartsAt: null, punctualityCutoffMinutes: 15 },
        new Date("2026-11-24T16:10:00Z")
      )
    ).toBe(true);
    expect(
      hasPunctualityCutoffPassed(
        { startsAt, punctualityStartsAt: null, punctualityCutoffMinutes: 15 },
        new Date("2026-11-24T16:10:00Z")
      )
    ).toBe(false);

    // 25m after original startsAt without reset -> late, cutoff has passed
    expect(
      isCheckinPunctual(
        { startsAt, punctualityStartsAt: null, punctualityCutoffMinutes: 15 },
        new Date("2026-11-24T16:25:00Z")
      )
    ).toBe(false);
    expect(
      hasPunctualityCutoffPassed(
        { startsAt, punctualityStartsAt: null, punctualityCutoffMinutes: 15 },
        new Date("2026-11-24T16:25:00Z")
      )
    ).toBe(true);

    // Delayed session re-opened at 16:20 with punctualityStartsAt reset to 16:20 -> punctual at 16:30, late at 16:36
    const delayedAnchor = new Date("2026-11-24T16:20:00Z");
    expect(
      isCheckinPunctual(
        {
          startsAt,
          punctualityStartsAt: delayedAnchor,
          punctualityCutoffMinutes: 15,
        },
        new Date("2026-11-24T16:30:00Z")
      )
    ).toBe(true);
    expect(
      isCheckinPunctual(
        {
          startsAt,
          punctualityStartsAt: delayedAnchor,
          punctualityCutoffMinutes: 15,
        },
        new Date("2026-11-24T16:36:00Z")
      )
    ).toBe(false);
  });

  it("computes deterministic points and punctuality for on_time, late, excused, absent, and attendees", () => {
    expect(
      computePointsForAttendanceStatus({
        status: "on_time",
        basePoints: 10,
        punctualityBonus: 5,
        isAttendee: false,
      })
    ).toEqual({ dbStatus: "present", isPunctual: true, pointsAwarded: 15 });

    expect(
      computePointsForAttendanceStatus({
        status: "late",
        basePoints: 10,
        punctualityBonus: 5,
        isAttendee: false,
      })
    ).toEqual({ dbStatus: "present", isPunctual: false, pointsAwarded: 10 });

    expect(
      computePointsForAttendanceStatus({
        status: "excused",
        basePoints: 10,
        punctualityBonus: 5,
        isAttendee: false,
      })
    ).toEqual({ dbStatus: "excused", isPunctual: false, pointsAwarded: 0 });

    expect(
      computePointsForAttendanceStatus({
        status: "absent",
        basePoints: 10,
        punctualityBonus: 5,
        isAttendee: false,
      })
    ).toEqual({ dbStatus: "absent", isPunctual: false, pointsAwarded: 0 });

    expect(
      computePointsForAttendanceStatus({
        status: "on_time",
        basePoints: 10,
        punctualityBonus: 5,
        isAttendee: true,
      })
    ).toEqual({ dbStatus: "present", isPunctual: true, pointsAwarded: 0 });
  });
});
