import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminStatisticsDatasetForActor } from "@/services/hr-ops/statistics.service";
import { computeAdminStatistics, DEFAULT_STATISTICS_FILTERS } from "@/lib/statistics-engine";

describe("getAdminStatisticsDatasetForActor (real PostgreSQL isolation & privacy)", () => {
  const createdSeasonIds: string[] = [];
  const createdPersonIds: string[] = [];

  let activeSeasonId = "";
  let archivedSeasonId = "";
  let techTrackId = "";
  let creativeTrackId = "";
  let commAiId = "";
  let commDesignId = "";
  let commHrId = "";

  let masterId = "";
  let masterPersonId = "";
  let hrAdminId = "";
  let hrAdminPersonId = "";
  let techDirectorId = "";
  let techDirectorPersonId = "";
  let headAiId = "";
  let headAiPersonId = "";
  let hrMemberAiId = "";
  let hrMemberUnassignedId = "";
  let hrMemberPersonId = "";
  let hrMemberAiMemberHatId = "";
  let memberAiId = "";
  let memberDesignId = "";

  beforeAll(async () => {
    const suffix = crypto.randomBytes(4).toString("hex");

    // Use existing active season so we never violate single-active-season invariants
    const [existingActive] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (!existingActive) {
      throw new Error("Expected seeded active season in test DB");
    }
    activeSeasonId = existingActive.id;

    // Create an archived season to test season switching
    const [archivedSeason] = await db
      .insert(schema.seasons)
      .values({
        name: `Stats Archived ${suffix}`,
        status: "archived",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-12-31T00:00:00.000Z"),
      })
      .returning();
    archivedSeasonId = archivedSeason.id;
    createdSeasonIds.push(archivedSeasonId);

    // Create isolated tracks & committees inside active season
    const [techTrack] = await db
      .insert(schema.committeeTracks)
      .values({
        seasonId: activeSeasonId,
        name: `Stats Tech ${suffix}`,
        slug: `stats-tech-${suffix}`,
      })
      .returning();
    techTrackId = techTrack.id;

    const [creativeTrack] = await db
      .insert(schema.committeeTracks)
      .values({
        seasonId: activeSeasonId,
        name: `Stats Creative ${suffix}`,
        slug: `stats-creative-${suffix}`,
      })
      .returning();
    creativeTrackId = creativeTrack.id;

    const [commAi] = await db
      .insert(schema.committees)
      .values({
        seasonId: activeSeasonId,
        trackId: techTrackId,
        name: `Stats AI ${suffix}`,
        slug: `stats-ai-${suffix}`,
        category: "technical",
      })
      .returning();
    commAiId = commAi.id;

    const [commDesign] = await db
      .insert(schema.committees)
      .values({
        seasonId: activeSeasonId,
        trackId: creativeTrackId,
        name: `Stats Design ${suffix}`,
        slug: `stats-design-${suffix}`,
        category: "non_technical",
      })
      .returning();
    commDesignId = commDesign.id;

    const [existingHr] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, activeSeasonId));
    commHrId = existingHr.id;

    const makePerson = async (label: string) => {
      const [p] = await db
        .insert(schema.persons)
        .values({
          email: `stats-${label}-${suffix}@cu.edu.eg`,
          fullName: `Stats ${label} ${suffix}`,
          mustChangePassword: false,
          isActive: true,
        })
        .returning();
      createdPersonIds.push(p.id);
      return p;
    };

    const pMaster = await makePerson("master");
    const pHrAdmin = await makePerson("hradmin");
    const pDirector = await makePerson("director");
    const pHeadAi = await makePerson("headai");
    const pHrMember = await makePerson("hrmember");
    const pHrUnassigned = await makePerson("hrunassigned");
    const pMemAi = await makePerson("memai");
    const pMemDesign = await makePerson("memdesign");

    masterPersonId = pMaster.id;
    hrAdminPersonId = pHrAdmin.id;
    techDirectorPersonId = pDirector.id;
    headAiPersonId = pHeadAi.id;
    hrMemberPersonId = pHrMember.id;

    const [mMaster] = await db
      .insert(schema.rosterMemberships)
      .values({ seasonId: activeSeasonId, personId: pMaster.id, role: "master_admin" })
      .returning();
    masterId = mMaster.id;

    const [mHrAdmin] = await db
      .insert(schema.rosterMemberships)
      .values({ seasonId: activeSeasonId, personId: pHrAdmin.id, role: "hr_admin", committeeId: commHrId })
      .returning();
    hrAdminId = mHrAdmin.id;

    const [mDir] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pDirector.id,
        role: "director",
        managedTrackId: techTrackId,
      })
      .returning();
    techDirectorId = mDir.id;

    const [mHeadAi] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHeadAi.id,
        role: "committee_head",
        committeeId: commAiId,
      })
      .returning();
    headAiId = mHeadAi.id;

    const [mHrMem] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHrMember.id,
        role: "hr_member",
        committeeId: commHrId,
        trackedCommitteeId: commAiId,
      })
      .returning();
    hrMemberAiId = mHrMem.id;

    // Multi-hat: same HR member person is also a regular member in AI!
    const [mHrMemSecondHat] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHrMember.id,
        role: "member",
        committeeId: commAiId,
      })
      .returning();
    hrMemberAiMemberHatId = mHrMemSecondHat.id;

    const [mHrUnassigned] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pHrUnassigned.id,
        role: "hr_member",
        committeeId: commHrId,
        trackedCommitteeId: null,
      })
      .returning();
    hrMemberUnassignedId = mHrUnassigned.id;

    const [mMemAi] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pMemAi.id,
        role: "member",
        committeeId: commAiId,
      })
      .returning();
    memberAiId = mMemAi.id;

    const [mMemDesign] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId: activeSeasonId,
        personId: pMemDesign.id,
        role: "member",
        committeeId: commDesignId,
      })
      .returning();
    memberDesignId = mMemDesign.id;

    // Seed an assignment AND an HR task in AI, plus an assignment in Design
    const [aiAssign] = await db
      .insert(schema.tasks)
      .values({
        seasonId: activeSeasonId,
        committeeId: commAiId,
        title: `AI Assignment ${suffix}`,
        dueAt: new Date("2026-11-10T18:00:00.000Z"),
        maxPoints: 100,
        workType: "assignment",
      })
      .returning();

    const [aiTask] = await db
      .insert(schema.tasks)
      .values({
        seasonId: activeSeasonId,
        committeeId: commAiId,
        title: `AI HR Task ${suffix}`,
        dueAt: new Date("2026-11-12T18:00:00.000Z"),
        maxPoints: 15,
        workType: "task",
      })
      .returning();

    const [designAssign] = await db
      .insert(schema.tasks)
      .values({
        seasonId: activeSeasonId,
        committeeId: commDesignId,
        title: `Design Assignment ${suffix}`,
        dueAt: new Date("2026-11-12T18:00:00.000Z"),
        maxPoints: 100,
        workType: "assignment",
      })
      .returning();

    await db.insert(schema.taskSubmissions).values([
      {
        taskId: aiAssign.id,
        membershipId: memberAiId,
        effortScore: 5,
        qualityScore: 5,
        timelinessScore: 4,
        totalPoints: 90,
        submittedAt: new Date("2026-11-09T12:00:00.000Z"),
        gradedAt: new Date("2026-11-09T18:00:00.000Z"),
      },
      {
        taskId: aiTask.id,
        membershipId: memberAiId,
        totalPoints: 15,
        submittedAt: new Date("2026-11-11T12:00:00.000Z"),
        gradedAt: new Date("2026-11-11T13:00:00.000Z"),
      },
      {
        taskId: designAssign.id,
        membershipId: memberDesignId,
        totalPoints: 70,
        submittedAt: new Date("2026-11-11T12:00:00.000Z"),
        gradedAt: new Date("2026-11-11T14:00:00.000Z"),
      },
    ]);

    // Seed feedback: published recognition + hidden internal note on AI member,
    // AND a hidden internal note on HR Member's OWN AI member hat (must NEVER leak to HR Member!)
    await db.insert(schema.hrFeedback).values([
      {
        seasonId: activeSeasonId,
        membershipId: memberAiId,
        content: "Great work on AI deliverable",
        category: "recognition",
        pointsDelta: 10,
        isPublished: true,
        isWarning: false,
        createdBy: hrAdminId,
      },
      {
        seasonId: activeSeasonId,
        membershipId: memberAiId,
        content: "SECRET HR NOTE — must never reach committee_head",
        category: "internal_note",
        pointsDelta: 0,
        isPublished: false,
        isWarning: false,
        createdBy: hrAdminId,
      },
      {
        seasonId: activeSeasonId,
        membershipId: hrMemberAiMemberHatId,
        content: "SECRET SELF-HAT NOTE — must never reach hr_member across hats",
        category: "internal_note",
        pointsDelta: 0,
        isPublished: false,
        isWarning: false,
        createdBy: hrAdminId,
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup synthetic records cleanly (cascades handle tasks/submissions/feedback/memberships)
    if (commAiId) {
      await db.delete(schema.committees).where(eq(schema.committees.id, commAiId));
    }
    if (commDesignId) {
      await db.delete(schema.committees).where(eq(schema.committees.id, commDesignId));
    }
    if (techTrackId) {
      await db.delete(schema.committeeTracks).where(eq(schema.committeeTracks.id, techTrackId));
    }
    if (creativeTrackId) {
      await db.delete(schema.committeeTracks).where(eq(schema.committeeTracks.id, creativeTrackId));
    }
    for (const seasonId of createdSeasonIds) {
      await db.delete(schema.seasons).where(eq(schema.seasons.id, seasonId));
    }
    for (const personId of createdPersonIds) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.personId, personId));
      await db.delete(schema.persons).where(eq(schema.persons.id, personId));
    }
  });

  it("scopes committee_head to their committee, includes both assignments and tasks, and excludes hidden notes at the SQL layer", async () => {
    const dataset = await getAdminStatisticsDatasetForActor({
      actor: {
        id: headAiId,
        personId: headAiPersonId,
        role: "committee_head",
        committeeId: commAiId,
        committeeName: "Stats AI",
        trackedCommitteeId: null,
        managedTrackId: null,
      },
    });

    expect(dataset.scopeKind).toBe("committee");
    expect(dataset.canViewHiddenFeedback).toBe(false);
    // Must never contain Design member or Design committee
    expect(dataset.members.some((m) => m.id === memberDesignId)).toBe(false);
    expect(dataset.members.some((m) => m.id === memberAiId)).toBe(true);
    // Must include BOTH assignments and HR tasks for their committee
    expect(dataset.tasks.some((t) => t.workType === "assignment")).toBe(true);
    expect(dataset.tasks.some((t) => t.workType === "task")).toBe(true);
    // SQL-layer privacy: zero unpublished feedback rows returned!
    expect(dataset.feedback.every((f) => f.isPublished === true)).toBe(true);
    expect(dataset.feedback.some((f) => f.category === "recognition")).toBe(true);
  });

  it("scopes hr_member to trackedCommitteeId, includes assignments & tasks, hides notes about own hats, and empties when unassigned", async () => {
    const dataset = await getAdminStatisticsDatasetForActor({
      actor: {
        id: hrMemberAiId,
        personId: hrMemberPersonId,
        role: "hr_member",
        committeeId: commHrId,
        trackedCommitteeId: commAiId,
        trackedCommitteeName: "Stats AI",
        managedTrackId: null,
      },
    });

    expect(dataset.scopeKind).toBe("committee");
    expect(dataset.canViewHiddenFeedback).toBe(true);
    // HR member sees AI's assignments (even though they cannot create assignments) AND tasks
    expect(dataset.tasks.some((t) => t.workType === "assignment")).toBe(true);
    expect(dataset.tasks.some((t) => t.workType === "task")).toBe(true);
    // Sees hidden note about another AI member
    expect(
      dataset.feedback.some(
        (f) => f.membershipId === memberAiId && f.isPublished === false
      )
    ).toBe(true);
    // NEVER receives feedback written about their OWN other hat (same personId)
    expect(
      dataset.feedback.some((f) => f.membershipId === hrMemberAiMemberHatId)
    ).toBe(false);

    // Unassigned HR member must get empty scope (never falls back to Human Resources)
    const unassignedDataset = await getAdminStatisticsDatasetForActor({
      actor: {
        id: hrMemberUnassignedId,
        personId: crypto.randomUUID(),
        role: "hr_member",
        committeeId: commHrId,
        trackedCommitteeId: null,
        managedTrackId: null,
      },
    });
    expect(unassignedDataset.members).toHaveLength(0);
    expect(unassignedDataset.tasks).toHaveLength(0);
    expect(unassignedDataset.feedback).toHaveLength(0);
  });

  it("scopes Track Director strictly to committees in their managedTrackId", async () => {
    const dataset = await getAdminStatisticsDatasetForActor({
      actor: {
        id: techDirectorId,
        personId: techDirectorPersonId,
        role: "director",
        committeeId: null,
        trackedCommitteeId: null,
        managedTrackId: techTrackId,
        managedTrackName: "Stats Tech",
      },
    });

    expect(dataset.scopeKind).toBe("track");
    expect(dataset.committees.map((c) => c.id)).toEqual([commAiId]);
    expect(dataset.members.some((m) => m.id === memberAiId)).toBe(true);
    expect(dataset.members.some((m) => m.id === memberDesignId)).toBe(false);

    const computed = computeAdminStatistics(dataset, DEFAULT_STATISTICS_FILTERS);
    expect(computed.assignments.totalSubmissions).toBe(1);
    expect(computed.tasks.totalSubmissions).toBe(1);
  });

  it("allows master_admin and hr_admin to switch to archived seasons while ignoring seasonId for committee_head", async () => {
    const masterArchived = await getAdminStatisticsDatasetForActor({
      actor: {
        id: masterId,
        personId: masterPersonId,
        role: "master_admin",
        committeeId: null,
        trackedCommitteeId: null,
        managedTrackId: null,
      },
      seasonId: archivedSeasonId,
    });
    expect(masterArchived.canSwitchSeason).toBe(true);
    expect(masterArchived.selectedSeason?.id).toBe(archivedSeasonId);
    expect(masterArchived.selectedSeason?.status).toBe("archived");
    expect(masterArchived.availableSeasons.some((s) => s.id === archivedSeasonId)).toBe(true);

    const hrAdminArchived = await getAdminStatisticsDatasetForActor({
      actor: {
        id: hrAdminId,
        personId: hrAdminPersonId,
        role: "hr_admin",
        committeeId: commHrId,
        trackedCommitteeId: null,
        managedTrackId: null,
      },
      seasonId: archivedSeasonId,
    });
    expect(hrAdminArchived.selectedSeason?.id).toBe(archivedSeasonId);

    // Committee head passing archivedSeasonId must stay locked to active season
    const headAttempt = await getAdminStatisticsDatasetForActor({
      actor: {
        id: headAiId,
        personId: headAiPersonId,
        role: "committee_head",
        committeeId: commAiId,
        trackedCommitteeId: null,
        managedTrackId: null,
      },
      seasonId: archivedSeasonId,
    });
    expect(headAttempt.canSwitchSeason).toBe(false);
    expect(headAttempt.selectedSeason?.id).toBe(activeSeasonId);
  });
});
