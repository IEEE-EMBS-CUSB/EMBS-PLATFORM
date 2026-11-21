import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  DEFAULT_SEASON_SETTINGS,
  calculateRubricPoints,
  deriveActivityTier,
  validateSeasonSettings,
} from "@/lib/season-settings";
import {
  cloneSeasonAsActor,
  createSeasonAsActor,
  updateSeasonSettingsAsActor,
} from "@/services/hr-ops/seasons.service";
import {
  addCommitteeAsActor,
  addCommitteeTrackAsActor,
  deleteCommitteeTrackAsActor,
  ensureDefaultTracksForSeason,
  renameCommitteeTrackAsActor,
} from "@/services/hr-ops/committees.service";
import { assignDirectorTrackAsActor } from "@/services/hr-ops/roster.service";
import { createTaskAsActor } from "@/services/hr-ops/tasks.service";
import { addManualLedgerEntryAsActor } from "@/services/hr-ops/ledger.service";

describe("Season Settings, Editable Committee Tracks, and Director Track Scoping", () => {
  const createdSeasonIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdTrackIds: string[] = [];
  const createdCommitteeIds: string[] = [];

  afterEach(async () => {
    for (const taskId of createdTaskIds.splice(0)) {
      await db
        .delete(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, taskId));
      await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
    }
    for (const commId of createdCommitteeIds.splice(0)) {
      await db.delete(schema.committees).where(eq(schema.committees.id, commId));
    }
    for (const trackId of createdTrackIds.splice(0)) {
      await db
        .delete(schema.committeeTracks)
        .where(eq(schema.committeeTracks.id, trackId));
    }
    for (const seasonId of createdSeasonIds.splice(0)) {
      await db.delete(schema.seasons).where(eq(schema.seasons.id, seasonId));
    }
  });

  it("validates season grading settings and computes rubric points & tiers deterministically", () => {
    expect(validateSeasonSettings(DEFAULT_SEASON_SETTINGS).ok).toBe(true);
    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        leaderboard: {
          ...DEFAULT_SEASON_SETTINGS.leaderboard,
          tierThresholds: { bronze: 200, silver: 100, gold: 300, diamond: 500 },
        },
      }).ok
    ).toBe(false);

    expect(
      calculateRubricPoints({
        effortScore: 4,
        qualityScore: 5,
        timelinessScore: 3,
        maxPoints: 100,
        grading: {
          effortWeight: 12,
          qualityWeight: 6,
          timelinessWeight: 4,
          defaultMaxPoints: 100,
        },
      })
    ).toBe(90);

    expect(
      deriveActivityTier(250, {
        bronze: 50,
        silver: 150,
        gold: 250,
        diamond: 450,
      })
    ).toBe("Gold");
  });

  it("seeds default Technical, Creative, Operations tracks on new season, supports editing/creating tracks, updating settings, and cloning", async () => {
    const created = await createSeasonAsActor(
      {
        name: `Track Settings Test ${Date.now()}`,
        startDate: "2027-09-01",
        endDate: "2028-06-01",
      },
      { profile: { role: "master_admin" } }
    );
    expect(created.ok).toBe(true);
    const seasonId = created.seasonId!;
    createdSeasonIds.push(seasonId);

    const tracks = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, seasonId));
    expect(tracks.map((t) => t.name).sort()).toEqual([
      "Creative",
      "Operations",
      "Technical",
    ]);

    // Rename Creative -> Creative & Brand
    const creative = tracks.find((t) => t.slug === "creative")!;
    const renamed = await renameCommitteeTrackAsActor(
      {
        trackId: creative.id,
        name: "Creative & Brand",
        description: "Media, design, and chapter branding",
      },
      { profile: { role: "master_admin" } }
    );
    expect(renamed.ok).toBe(true);

    // Add a new future committee set (track)
    const customTrack = await addCommitteeTrackAsActor(
      {
        seasonId,
        name: "Research & Innovation",
        description: "Publications and R&D initiatives",
      },
      { profile: { role: "master_admin" } }
    );
    expect(customTrack.ok).toBe(true);

    // Add a committee under the custom track
    const comm = await addCommitteeAsActor(
      {
        seasonId,
        name: "Clinical AI Lab",
        trackId: customTrack.trackId!,
      },
      { profile: { role: "master_admin" } }
    );
    expect(comm.ok).toBe(true);

    // Cannot delete track while active committee is assigned to it
    const blockedDelete = await deleteCommitteeTrackAsActor(
      customTrack.trackId!,
      { profile: { role: "master_admin" } }
    );
    expect(blockedDelete.ok).toBe(false);
    expect(blockedDelete.error).toMatch(/committee/i);

    // Update season grading settings
    const customSettings = {
      ...DEFAULT_SEASON_SETTINGS,
      attendance: {
        ...DEFAULT_SEASON_SETTINGS.attendance,
        defaultBasePoints: 15,
        defaultPunctualityBonus: 8,
      },
      grading: {
        effortWeight: 12,
        qualityWeight: 6,
        timelinessWeight: 2,
        defaultMaxPoints: 120,
      },
    };
    const updated = await updateSeasonSettingsAsActor(
      seasonId,
      customSettings,
      { profile: { role: "master_admin" } }
    );
    expect(updated.ok).toBe(true);

    // Clone season carries settings, custom tracks, and committees forward
    const cloned = await cloneSeasonAsActor(
      seasonId,
      `Cloned Track Settings ${Date.now()}`,
      { profile: { role: "master_admin" } }
    );
    expect(cloned.ok).toBe(true);
    createdSeasonIds.push(cloned.seasonId!);

    const [clonedSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, cloned.seasonId!));
    expect(clonedSeason.settingsJson.attendance.defaultBasePoints).toBe(15);
    expect(clonedSeason.settingsJson.grading.effortWeight).toBe(12);

    const clonedTracks = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, cloned.seasonId!));
    expect(clonedTracks.map((t) => t.name)).toContain("Creative & Brand");
    expect(clonedTracks.map((t) => t.name)).toContain("Research & Innovation");

    const clonedComms = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, cloned.seasonId!));
    const clonedLab = clonedComms.find((c) => c.name === "Clinical AI Lab");
    const clonedResearchTrack = clonedTracks.find(
      (t) => t.name === "Research & Innovation"
    );
    expect(clonedLab?.trackId).toBe(clonedResearchTrack?.id);
  });

  it("scopes a Track Director to committees under their assigned track only", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    expect(activeSeason).toBeDefined();

    const tracks = await ensureDefaultTracksForSeason(activeSeason.id);
    const technicalTrack = tracks.find((t) => t.slug === "technical")!;
    const operationsTrack = tracks.find((t) => t.slug === "operations")!;
    expect(technicalTrack).toBeDefined();
    expect(operationsTrack).toBeDefined();

    const [director] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.role, "director"))
      .limit(1);
    expect(director).toBeDefined();

    // Assign director to Technical track, then restore to null in finally
    const prevManagedTrackId = director.managedTrackId;
    try {
      const assignRes = await assignDirectorTrackAsActor(
        director.id,
        technicalTrack.id,
        { profile: { role: "master_admin" } }
      );
      expect(assignRes.ok).toBe(true);

      // Find a technical committee head and a non-technical (operations/creative) member
      const seasonComms = await db
        .select()
        .from(schema.committees)
        .where(eq(schema.committees.seasonId, activeSeason.id));
      const techCommIds = new Set(
        seasonComms
          .filter((c) => c.trackId === technicalTrack.id)
          .map((c) => c.id)
      );
      const nonTechCommIds = new Set(
        seasonComms
          .filter((c) => c.trackId && c.trackId !== technicalTrack.id)
          .map((c) => c.id)
      );

      const seasonMembers = await db
        .select()
        .from(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.seasonId, activeSeason.id));

      const techHead = seasonMembers.find(
        (m) =>
          m.role === "committee_head" &&
          m.committeeId &&
          techCommIds.has(m.committeeId)
      );
      const nonTechMember = seasonMembers.find(
        (m) =>
          m.role !== "attendee" &&
          m.committeeId &&
          nonTechCommIds.has(m.committeeId)
      );
      expect(techHead).toBeDefined();
      expect(nonTechMember).toBeDefined();

      // Technical Director CAN assign to a Technical Committee Head
      const okAssign = await createTaskAsActor(
        {
          title: `Tech Dir OK Assignment ${Date.now()}`,
          dueAt: "2026-12-31",
          workType: "assignment",
          targetType: "specific_person",
          assignedToMembershipId: techHead!.id,
        },
        {
          profile: {
            id: director.id,
            role: "director",
            committeeId: null,
            managedTrackId: technicalTrack.id,
          },
        }
      );
      expect(okAssign.ok).toBe(true);
      createdTaskIds.push(okAssign.taskId!);

      // Technical Director CANNOT award ledger points to a member outside Technical track
      const blockedLedger = await addManualLedgerEntryAsActor(
        {
          membershipId: nonTechMember!.id,
          points: 10,
          month: "2099-03",
          reason: "Cross-track attempt",
        },
        {
          profile: {
            id: director.id,
            role: "director",
            committeeId: null,
            managedTrackId: technicalTrack.id,
          },
        }
      );
      expect(blockedLedger.ok).toBe(false);
      expect(blockedLedger.error).toMatch(/track|unauthorized/i);
    } finally {
      await db
        .update(schema.rosterMemberships)
        .set({ managedTrackId: prevManagedTrackId })
        .where(eq(schema.rosterMemberships.id, director.id));
    }
  });
});
