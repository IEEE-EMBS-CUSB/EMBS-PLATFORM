import { describe, expect, it } from "vitest";
import {
  computePointsForAttendanceStatus,
  getSessionCheckinState,
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
          checkinExpiresAt: new Date("2026-11-22T18:15:00Z"),
        },
        now
      )
    ).toBe("live");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinStartsAt: new Date("2026-11-22T17:55:00Z"),
          checkinExpiresAt: new Date("2026-11-22T18:15:00Z"),
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
          checkinExpiresAt: new Date("2026-11-22T17:59:59Z"),
        },
        now
      )
    ).toBe("closed");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinExpiresAt: new Date("2026-11-22T17:59:59Z"),
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
          checkinExpiresAt: new Date("2026-11-22T19:00:00Z"),
        },
        now
      )
    ).toBe("closed");
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: false,
          checkinExpiresAt: new Date("2026-11-22T19:00:00Z"),
        },
        now
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
