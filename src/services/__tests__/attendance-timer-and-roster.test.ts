import { describe, expect, it } from "vitest";
import {
  computePointsForAttendanceStatus,
  isSessionCheckinLive,
} from "@/services/hr-ops/attendance.service";

describe("CP7 Attendance Timer & Manual Status Scoring Helpers", () => {
  it("evaluates isSessionCheckinLive strictly against checkinEndsAt / checkinExpiresAt", () => {
    const now = new Date("2026-11-22T18:00:00Z");

    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinExpiresAt: new Date("2026-11-22T18:15:00Z"),
        },
        now
      )
    ).toBe(true);

    // Expired deadline MUST report not live even if raw DB boolean is still true
    expect(
      isSessionCheckinLive(
        {
          checkinOpen: true,
          checkinExpiresAt: new Date("2026-11-22T17:59:59Z"),
        },
        now
      )
    ).toBe(false);

    // Closed flag reports not live even if deadline is in the future
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
