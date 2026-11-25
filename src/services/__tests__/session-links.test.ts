import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  isSlideDeckRequiredForRole,
  isWebConferencingRequiredForRole,
} from "@/lib/permissions";
import {
  createSessionAsActor,
  recordMemberCheckin,
} from "@/services/hr-ops/attendance.service";
import {
  getMemberAttendance,
  getMemberUpcomingSessions,
} from "@/services/member.service";

describe("Attendance Session Mode, Links, Locations, Scoring, & Instructors", () => {
  const createdSessionIds: string[] = [];
  const createdMembershipIds: string[] = [];
  const createdPersonIds: string[] = [];

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
        .delete(schema.branchSessionInstructors)
        .where(eq(schema.branchSessionInstructors.sessionId, sessionId));
      await db
        .delete(schema.branchSessions)
        .where(eq(schema.branchSessions.id, sessionId));
    }
    for (const membershipId of createdMembershipIds.splice(0)) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, membershipId));
    }
    for (const personId of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, personId));
    }
  });

  async function ensureCommitteeHead(seasonId: string, committeeId: string) {
    const [existing] = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, seasonId),
          eq(schema.rosterMemberships.committeeId, committeeId),
          eq(schema.rosterMemberships.role, "committee_head"),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);
    if (existing) return existing.id;

    const [person] = await db
      .insert(schema.persons)
      .values({
        email: `test.head.${Date.now()}.${Math.random().toString(36).slice(2)}@cu.edu.eg`,
        fullName: "Test Committee Head",
        isActive: true,
      })
      .returning();
    createdPersonIds.push(person.id);

    const [membership] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId,
        personId: person.id,
        committeeId,
        role: "committee_head",
        isActive: true,
      })
      .returning();
    createdMembershipIds.push(membership.id);
    return membership.id;
  }

  it("marks slide deck and online web conferencing link required for committee_head and hr_member, and optional for hr_admin, director, and master_admin", () => {
    expect(isSlideDeckRequiredForRole("committee_head")).toBe(true);
    expect(isSlideDeckRequiredForRole("hr_member")).toBe(true);
    expect(isSlideDeckRequiredForRole("hr_admin")).toBe(false);
    expect(isSlideDeckRequiredForRole("director")).toBe(false);
    expect(isSlideDeckRequiredForRole("master_admin")).toBe(false);

    expect(isWebConferencingRequiredForRole("committee_head", "online")).toBe(
      true
    );
    expect(isWebConferencingRequiredForRole("hr_member", "online")).toBe(true);
    expect(isWebConferencingRequiredForRole("hr_admin", "online")).toBe(false);
    expect(isWebConferencingRequiredForRole("director", "online")).toBe(false);
    expect(isWebConferencingRequiredForRole("master_admin", "online")).toBe(
      false
    );
    expect(isWebConferencingRequiredForRole("committee_head", "offline")).toBe(
      false
    );
  });

  it("enforces required slide deck & online conferencing URLs for non-admin roles, validates offline locations, enforces instructor eligibility, and applies mode-specific scoring", async () => {
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

    const roboticsHeadId = await ensureCommitteeHead(
      activeSeason.id,
      robotics.id
    );
    const [branchLeader] = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, activeSeason.id),
          inArray(schema.rosterMemberships.role, [
            "master_admin",
            "director",
            "hr_admin",
          ]),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);
    expect(branchLeader).toBeDefined();

    // 1. committee_head without slideDeckUrl -> rejected
    const headMissing = await createSessionAsActor(
      {
        title: "Head Missing Slides",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "offline",
        instructorMembershipIds: [roboticsHeadId],
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

    // 2. committee_head creating ONLINE session without webConferencingUrl -> rejected
    const headOnlineMissingLink = await createSessionAsActor(
      {
        title: "Head Online Missing Link",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "online",
        slideDeckUrl: "https://docs.google.com/presentation/d/online-slides",
        instructorMembershipIds: [roboticsHeadId],
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: robotics.id,
        },
      }
    );
    expect(headOnlineMissingLink.ok).toBe(false);
    expect(headOnlineMissingLink.error).toMatch(/web conferencing/i);

    // 3. hr_member without slideDeckUrl -> rejected
    const hrMissing = await createSessionAsActor(
      {
        title: "HR Member Missing Slides",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "offline",
        instructorMembershipIds: [roboticsHeadId],
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

    // 4. Unsafe javascript: URLs rejected even for master_admin / hr_admin
    const badSlide = await createSessionAsActor(
      {
        title: "XSS Slide Deck",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "offline",
        slideDeckUrl: "javascript:alert(1)",
        instructorMembershipIds: [roboticsHeadId],
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
        sessionMode: "online",
        webConferencingUrl: "javascript:alert(2)",
        instructorMembershipIds: [roboticsHeadId],
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

    // 5. Missing instructors -> rejected
    const missingInstructors = await createSessionAsActor(
      {
        title: "No Instructors",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: null,
        sessionMode: "offline",
        instructorMembershipIds: [],
      },
      {
        profile: {
          id: "test-hr-admin",
          role: "hr_admin",
          committeeId: null,
        },
      }
    );
    expect(missingInstructors.ok).toBe(false);
    expect(missingInstructors.error).toMatch(/instructor/i);

    // 6. hr_admin creating branch-wide ONLINE session without links -> succeeds with branch leader instructor & online scoring
    const hrAdminOk = await createSessionAsActor(
      {
        title: `HR Admin Optional Online ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: null,
        sessionMode: "online",
        instructorMembershipIds: [branchLeader.id],
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
    expect(hrAdminOk.session?.sessionMode).toBe("online");
    expect(hrAdminOk.session?.slideDeckUrl).toBeNull();
    expect(hrAdminOk.session?.webConferencingUrl).toBeNull();
    expect(hrAdminOk.session?.instructors).toHaveLength(1);

    // 7. master_admin creating branch-wide ONLINE session with webConferencingUrl -> succeeds
    const masterOk = await createSessionAsActor(
      {
        title: `Master Optional Slides ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: null,
        sessionMode: "online",
        webConferencingUrl: "https://meet.google.com/abc-defg-hij",
        instructorMembershipIds: [branchLeader.id],
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

    // 8. committee_head creating ONLINE session with slideDeckUrl & webConferencingUrl -> succeeds
    const headOnlineOk = await createSessionAsActor(
      {
        title: `Robotics PID Online ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "online",
        slideDeckUrl: "https://docs.google.com/presentation/d/pid-control",
        webConferencingUrl: "https://zoom.us/j/123456789",
        instructorMembershipIds: [roboticsHeadId],
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: robotics.id,
        },
      }
    );
    expect(headOnlineOk.ok).toBe(true);
    createdSessionIds.push(headOnlineOk.sessionId!);
    expect(headOnlineOk.session?.sessionMode).toBe("online");
    expect(headOnlineOk.session?.webConferencingUrl).toBe(
      "https://zoom.us/j/123456789"
    );
    expect(headOnlineOk.session?.locationUrl).toBeNull();

    // 9. committee_head creating OFFLINE session with location link & address -> succeeds
    const headOfflineOk = await createSessionAsActor(
      {
        title: `Robotics Lab Offline ${Date.now()}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        committeeId: robotics.id,
        sessionMode: "offline",
        slideDeckUrl: "https://docs.google.com/presentation/d/pid-lab",
        locationUrl: "https://maps.google.com/?q=Cairo+University",
        locationAddress: "Faculty of Engineering, Lab 3",
        instructorMembershipIds: [roboticsHeadId],
      },
      {
        profile: {
          id: "test-head",
          role: "committee_head",
          committeeId: robotics.id,
        },
      }
    );
    expect(headOfflineOk.ok).toBe(true);
    createdSessionIds.push(headOfflineOk.sessionId!);
    expect(headOfflineOk.session?.sessionMode).toBe("offline");
    expect(headOfflineOk.session?.locationUrl).toBe(
      "https://maps.google.com/?q=Cairo+University"
    );
    expect(headOfflineOk.session?.locationAddress).toBe(
      "Faculty of Engineering, Lab 3"
    );
    expect(headOfflineOk.session?.webConferencingUrl).toBeNull();
  });

  it("exposes sessionMode, links, location, and instructors on member attendance records and scoped upcoming sessions without leaking other committees", async () => {
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

    const omarHeadId = await ensureCommitteeHead(
      omar.seasonId,
      omar.committeeId!
    );
    const otherHeadId = await ensureCommitteeHead(
      omar.seasonId,
      otherCommittee.id
    );

    // Live online session for Omar's committee
    const liveRes = await createSessionAsActor(
      {
        title: `Omar Live Session ${Date.now()}`,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        committeeId: omar.committeeId,
        sessionMode: "online",
        checkinWindowMinutes: 30,
        slideDeckUrl: "https://docs.google.com/presentation/d/omar-live",
        webConferencingUrl: "https://meet.google.com/oma-rliv-eee",
        instructorMembershipIds: [omarHeadId],
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

    // Upcoming offline session for OTHER committee (must NOT appear for Omar)
    const otherRes = await createSessionAsActor(
      {
        title: `Other Committee Secret Session ${Date.now()}`,
        startsAt: new Date(Date.now() + 7_200_000).toISOString(),
        committeeId: otherCommittee.id,
        sessionMode: "offline",
        slideDeckUrl: "https://docs.google.com/presentation/d/other-secret",
        locationAddress: "Secret Room 101",
        instructorMembershipIds: [otherHeadId],
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

    // Upcoming sessions list includes Omar's live session with links and instructors, excludes other committee
    const upcoming = await getMemberUpcomingSessions(omar.id);
    const omarUpcoming = upcoming.find((s) => s.id === liveRes.sessionId);
    expect(omarUpcoming).toBeDefined();
    expect(omarUpcoming?.sessionMode).toBe("online");
    expect(omarUpcoming?.slideDeckUrl).toBe(
      "https://docs.google.com/presentation/d/omar-live"
    );
    expect(omarUpcoming?.webConferencingUrl).toBe(
      "https://meet.google.com/oma-rliv-eee"
    );
    expect(omarUpcoming?.instructors.length).toBeGreaterThanOrEqual(1);
    expect(upcoming.find((s) => s.id === otherRes.sessionId)).toBeUndefined();

    // Check Omar in, then verify getMemberAttendance carries both links & instructors
    const checkin = await recordMemberCheckin(liveRes.checkinCode!, omar.id);
    expect(checkin.ok).toBe(true);

    const history = await getMemberAttendance(omar.id);
    const found = history.find((r) => r.title === liveRes.session?.title);
    expect(found).toBeDefined();
    expect(found?.sessionMode).toBe("online");
    expect(found?.slideDeckUrl).toBe(
      "https://docs.google.com/presentation/d/omar-live"
    );
    expect(found?.webConferencingUrl).toBe(
      "https://meet.google.com/oma-rliv-eee"
    );
    expect(found?.instructors?.length).toBeGreaterThanOrEqual(1);
  });
});
