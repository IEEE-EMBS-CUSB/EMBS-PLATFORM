import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isSlideDeckRequiredForRole } from "@/lib/permissions";
import {
  createSessionAsActor,
  recordMemberCheckin,
} from "@/services/hr-ops/attendance.service";
import {
  getMemberAttendance,
  getMemberUpcomingSessions,
} from "@/services/member.service";

describe("Attendance Session Links (Slide Deck & Web Conferencing)", () => {
  const createdSessionIds: string[] = [];

  afterEach(async () => {
    for (const sessionId of createdSessionIds.splice(0)) {
      const records = await db
        .select({ id: schema.attendanceRecords.id })
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      for (const rec of records) {
        await db
          .delete(schema.scoreLedger)
          .where(eq(schema.scoreLedger.sourceId, rec.id));
      }
      await db
        .delete(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      await db
        .delete(schema.branchSessions)
        .where(eq(schema.branchSessions.id, sessionId));
    }
  });

  it("marks slide deck required for committee_head and hr_member, and optional for hr_admin, director, and master_admin", () => {
    expect(isSlideDeckRequiredForRole("committee_head")).toBe(true);
    expect(isSlideDeckRequiredForRole("hr_member")).toBe(true);
    expect(isSlideDeckRequiredForRole("hr_admin")).toBe(false);
    expect(isSlideDeckRequiredForRole("director")).toBe(false);
    expect(isSlideDeckRequiredForRole("master_admin")).toBe(false);
  });

  it("enforces required slide deck URL for committee_head and hr_member, optional for hr_admin and master_admin, and rejects unsafe URLs", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "robotics-and-automation"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      )
      .limit(1);
    expect(robotics).toBeDefined();

    // 1. committee_head without slideDeckUrl -> rejected
    const headMissing = await createSessionAsActor(
      {
        title: "Head Missing Slides",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: robotics.id,
        },
      }
    );
    expect(headMissing.ok).toBe(false);
    expect(headMissing.error).toMatch(/slide deck/i);

    // 2. hr_member without slideDeckUrl -> rejected
    const hrMissing = await createSessionAsActor(
      {
        title: "HR Member Missing Slides",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
      },
      {
        profile: {
          id: "test-hr-member",
          role: "hr_member",
          committeeId: null,
          trackedCommitteeId: robotics.id,
        },
      }
    );
    expect(hrMissing.ok).toBe(false);
    expect(hrMissing.error).toMatch(/slide deck/i);

    // 3. Unsafe javascript: URLs rejected even for master_admin / hr_admin
    const badSlide = await createSessionAsActor(
      {
        title: "XSS Slide Deck",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        slideDeckUrl: "javascript:alert(1)",
      },
      {
        profile: {
          id: "test-master",
          role: "master_admin",
          committeeId: null,
        },
      }
    );
    expect(badSlide.ok).toBe(false);
    expect(badSlide.error).toMatch(/slide deck.*http/i);

    const badMeeting = await createSessionAsActor(
      {
        title: "XSS Web Conf",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        webConferencingUrl: "javascript:alert(2)",
      },
      {
        profile: {
          id: "test-hr-admin",
          role: "hr_admin",
          committeeId: null,
        },
      }
    );
    expect(badMeeting.ok).toBe(false);
    expect(badMeeting.error).toMatch(/web conferencing.*http/i);

    // 4. hr_admin without slideDeckUrl -> succeeds with null links
    const hrAdminOk = await createSessionAsActor(
      {
        title: `HR Admin Optional Slides ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: null,
      },
      {
        profile: {
          id: "test-hr-admin",
          role: "hr_admin",
          committeeId: null,
        },
      }
    );
    expect(hrAdminOk.ok).toBe(true);
    createdSessionIds.push(hrAdminOk.sessionId!);
    expect(hrAdminOk.session?.slideDeckUrl).toBeNull();
    expect(hrAdminOk.session?.webConferencingUrl).toBeNull();

    // 5. master_admin without slideDeckUrl but with webConferencingUrl -> succeeds
    const masterOk = await createSessionAsActor(
      {
        title: `Master Optional Slides ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: null,
        webConferencingUrl: "https://meet.google.com/abc-defg-hij",
      },
      {
        profile: {
          id: "test-master",
          role: "master_admin",
          committeeId: null,
        },
      }
    );
    expect(masterOk.ok).toBe(true);
    createdSessionIds.push(masterOk.sessionId!);
    expect(masterOk.session?.slideDeckUrl).toBeNull();
    expect(masterOk.session?.webConferencingUrl).toBe(
      "https://meet.google.com/abc-defg-hij"
    );

    // 6. committee_head with valid slideDeckUrl & optional webConferencingUrl -> succeeds and persists
    const headOk = await createSessionAsActor(
      {
        title: `Robotics PID Slides ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        slideDeckUrl: "https://docs.google.com/presentation/d/pid-control",
        webConferencingUrl: "https://zoom.us/j/123456789",
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: robotics.id,
        },
      }
    );
    expect(headOk.ok).toBe(true);
    createdSessionIds.push(headOk.sessionId!);
    expect(headOk.session?.slideDeckUrl).toBe(
      "https://docs.google.com/presentation/d/pid-control"
    );
    expect(headOk.session?.webConferencingUrl).toBe(
      "https://zoom.us/j/123456789"
    );
  });

  it("exposes slideDeckUrl and webConferencingUrl on member attendance records and scoped upcoming sessions without leaking other committees", async () => {
    const [omar] = await db
      .select({
        id: schema.rosterMemberships.id,
        committeeId: schema.rosterMemberships.committeeId,
        seasonId: schema.rosterMemberships.seasonId,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "omar.tarek@cu.edu.eg"))
      .limit(1);
    expect(omar).toBeDefined();
    expect(omar.committeeId).toBeTruthy();

    const [otherCommittee] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, omar.seasonId))
      .then((rows) => rows.filter((c) => c.id !== omar.committeeId));
    expect(otherCommittee).toBeDefined();

    // Live session for Omar's committee
    const liveRes = await createSessionAsActor(
      {
        title: `Omar Live Session ${Date.now()}`,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        committeeId: omar.committeeId,
        checkinWindowMinutes: 30,
        slideDeckUrl: "https://docs.google.com/presentation/d/omar-live",
        webConferencingUrl: "https://meet.google.com/oma-rliv-eee",
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: omar.committeeId,
        },
      }
    );
    expect(liveRes.ok).toBe(true);
    createdSessionIds.push(liveRes.sessionId!);

    // Upcoming session for OTHER committee (must NOT appear for Omar)
    const otherRes = await createSessionAsActor(
      {
        title: `Other Committee Secret Session ${Date.now()}`,
        startsAt: new Date(Date.now() + 7_200_000).toISOString(),
        committeeId: otherCommittee.id,
        slideDeckUrl: "https://docs.google.com/presentation/d/other-secret",
      },
      {
        profile: {
          id: "test-head-other",
          role: "committee_head",
          committeeId: otherCommittee.id,
        },
      }
    );
    expect(otherRes.ok).toBe(true);
    createdSessionIds.push(otherRes.sessionId!);

    // Upcoming sessions list includes Omar's live session with both links, excludes other committee
    const upcoming = await getMemberUpcomingSessions(omar.id);
    const omarUpcoming = upcoming.find((s) => s.id === liveRes.sessionId);
    expect(omarUpcoming).toBeDefined();
    expect(omarUpcoming?.slideDeckUrl).toBe(
      "https://docs.google.com/presentation/d/omar-live"
    );
    expect(omarUpcoming?.webConferencingUrl).toBe(
      "https://meet.google.com/oma-rliv-eee"
    );
    expect(upcoming.find((s) => s.id === otherRes.sessionId)).toBeUndefined();

    // Check Omar in, then verify getMemberAttendance carries both links
    const checkin = await recordMemberCheckin(liveRes.checkinCode!, omar.id);
    expect(checkin.ok).toBe(true);

    const history = await getMemberAttendance(omar.id);
    const found = history.find((r) => r.title === liveRes.session?.title);
    expect(found).toBeDefined();
    expect(found?.slideDeckUrl).toBe(
      "https://docs.google.com/presentation/d/omar-live"
    );
    expect(found?.webConferencingUrl).toBe(
      "https://meet.google.com/oma-rliv-eee"
    );
  });
});
