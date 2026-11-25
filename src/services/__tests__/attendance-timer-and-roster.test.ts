import { describe, expect, it } from "vitest";
import {
  computeInitialSessionWindow,
  computePointsForAttendanceStatus,
  filterEligibleInstructorCandidates,
  getSessionCheckinState,
  hasPunctualityCutoffPassed,
  isCheckinPunctual,
  isSessionCheckinLive,
  validateSessionDeliveryFields,
  validateSessionInstructors,
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

  it("validates online vs offline session delivery fields and role-based web conferencing requirements", () => {
    // committee_head creating online session WITHOUT webConferencingUrl -> rejected
    const headOnlineMissing = validateSessionDeliveryFields({
      role: "committee_head",
      sessionMode: "online",
      slideDeckUrl: "https://docs.google.com/presentation/d/abc",
      webConferencingUrl: "",
    });
    expect(headOnlineMissing.ok).toBe(false);
    if (!headOnlineMissing.ok) {
      expect(headOnlineMissing.error).toMatch(/web conferencing/i);
    }

    // hr_member creating online session WITHOUT webConferencingUrl -> rejected
    const hrMemberOnlineMissing = validateSessionDeliveryFields({
      role: "hr_member",
      sessionMode: "online",
      slideDeckUrl: "https://docs.google.com/presentation/d/abc",
      webConferencingUrl: null,
    });
    expect(hrMemberOnlineMissing.ok).toBe(false);

    // hr_admin & master_admin creating online session WITHOUT webConferencingUrl -> allowed
    const hrAdminOnline = validateSessionDeliveryFields({
      role: "hr_admin",
      sessionMode: "online",
      slideDeckUrl: null,
      webConferencingUrl: null,
    });
    expect(hrAdminOnline.ok).toBe(true);
    if (hrAdminOnline.ok) {
      expect(hrAdminOnline.sessionMode).toBe("online");
      expect(hrAdminOnline.locationUrl).toBeNull();
      expect(hrAdminOnline.locationAddress).toBeNull();
    }

    // committee_head creating offline session with location link & address -> allowed, strips webConferencingUrl
    const headOffline = validateSessionDeliveryFields({
      role: "committee_head",
      sessionMode: "offline",
      slideDeckUrl: "https://docs.google.com/presentation/d/abc",
      webConferencingUrl: "https://meet.google.com/ignored",
      locationUrl: "https://maps.google.com/?q=Cairo+University",
      locationAddress: "Faculty of Engineering, Hall 204",
    });
    expect(headOffline.ok).toBe(true);
    if (headOffline.ok) {
      expect(headOffline.sessionMode).toBe("offline");
      expect(headOffline.webConferencingUrl).toBeNull();
      expect(headOffline.locationUrl).toBe(
        "https://maps.google.com/?q=Cairo+University"
      );
      expect(headOffline.locationAddress).toBe(
        "Faculty of Engineering, Hall 204"
      );
    }

    // Unsafe location URL rejected
    const badLocUrl = validateSessionDeliveryFields({
      role: "master_admin",
      sessionMode: "offline",
      locationUrl: "javascript:alert(1)",
    });
    expect(badLocUrl.ok).toBe(false);
    if (!badLocUrl.ok) {
      expect(badLocUrl.error).toMatch(/location link.*http/i);
    }
  });

  it("filters eligible instructors per scope, deduplicates multi-hat leaders, and validates subsets", () => {
    const candidates = [
      {
        membershipId: "m-head-ai-1",
        personId: "p-salma",
        fullName: "Salma El-Sayed",
        role: "committee_head" as const,
        committeeId: "comm-ai",
        isActive: true,
      },
      {
        membershipId: "m-head-ai-2",
        personId: "p-youssef",
        fullName: "Youssef Adel",
        role: "committee_head" as const,
        committeeId: "comm-ai",
        isActive: true,
      },
      {
        membershipId: "m-head-web",
        personId: "p-ziad",
        fullName: "Ziad Hany",
        role: "committee_head" as const,
        committeeId: "comm-web",
        isActive: true,
      },
      {
        membershipId: "m-master",
        personId: "p-master",
        fullName: "Master Admin",
        role: "master_admin" as const,
        committeeId: null,
        isActive: true,
      },
      {
        membershipId: "m-master-dir-hat",
        personId: "p-master",
        fullName: "Master Admin",
        role: "director" as const,
        committeeId: null,
        isActive: true,
      },
      {
        membershipId: "m-hr-admin",
        personId: "p-sara",
        fullName: "Sara Hassan",
        role: "hr_admin" as const,
        committeeId: "comm-hr",
        isActive: true,
      },
      {
        membershipId: "m-member",
        personId: "p-omar",
        fullName: "Omar Tarek",
        role: "member" as const,
        committeeId: "comm-ai",
        isActive: true,
      },
    ];

    // Committee AI: only AI heads
    const aiPool = filterEligibleInstructorCandidates(candidates, "comm-ai");
    expect(aiPool.map((c) => c.membershipId)).toEqual([
      "m-head-ai-1",
      "m-head-ai-2",
    ]);

    // Branch-wide: master_admin, director, hr_admin deduplicated by personId (prefers master_admin over director)
    const branchPool = filterEligibleInstructorCandidates(candidates, null);
    expect(branchPool.map((c) => c.membershipId)).toEqual([
      "m-master",
      "m-hr-admin",
    ]);

    // Validation rejects empty instructor list
    const emptyRes = validateSessionInstructors({
      requestedIds: [],
      resolvedCandidates: candidates,
      sessionCommitteeId: "comm-ai",
    });
    expect(emptyRes.ok).toBe(false);

    // Validation accepts subset of committee heads (1 of 2, or 2 of 2)
    const subsetRes = validateSessionInstructors({
      requestedIds: ["m-head-ai-2"],
      resolvedCandidates: candidates,
      sessionCommitteeId: "comm-ai",
    });
    expect(subsetRes.ok).toBe(true);
    if (subsetRes.ok) {
      expect(subsetRes.instructors).toEqual([
        {
          membershipId: "m-head-ai-2",
          fullName: "Youssef Adel",
          role: "committee_head",
        },
      ]);
    }

    // Validation rejects head from another committee
    const wrongCommittee = validateSessionInstructors({
      requestedIds: ["m-head-ai-1", "m-head-web"],
      resolvedCandidates: candidates,
      sessionCommitteeId: "comm-ai",
    });
    expect(wrongCommittee.ok).toBe(false);

    // Validation rejects committee_head on branch-wide session
    const headOnBranch = validateSessionInstructors({
      requestedIds: ["m-head-ai-1"],
      resolvedCandidates: candidates,
      sessionCommitteeId: null,
    });
    expect(headOnBranch.ok).toBe(false);

    // Validation accepts master_admin + hr_admin on branch-wide session
    const branchOk = validateSessionInstructors({
      requestedIds: ["m-master", "m-hr-admin"],
      resolvedCandidates: candidates,
      sessionCommitteeId: null,
    });
    expect(branchOk.ok).toBe(true);
    if (branchOk.ok) {
      expect(branchOk.instructors).toHaveLength(2);
    }
  });
});
