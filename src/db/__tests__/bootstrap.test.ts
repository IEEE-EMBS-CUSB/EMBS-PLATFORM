import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { bootstrapProductionDatabase } from "@/db/bootstrap";
import { OFFICIAL_CHAPTER_COMMITTEES } from "@/lib/committee-catalog";
import { verifyPassword } from "@/lib/password";

describe("Production fresh-install bootstrap (src/db/bootstrap.ts)", () => {
  const createdSeasonIds: string[] = [];
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    for (const seasonId of createdSeasonIds.splice(0)) {
      await db.delete(schema.seasons).where(eq(schema.seasons.id, seasonId));
    }
    for (const personId of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, personId));
    }
  });

  it("initializes a clean season with 3 tracks, all 12 official committees, rubrics, master_admin, and optional roster CSV without demo data", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seasonName = `Bootstrap Test Season ${suffix}`;
    const masterEmail = `bootstrap.master.${suffix}@cu.edu.eg`;
    const memberEmail = `bootstrap.member.${suffix}@cu.edu.eg`;

    const res = await bootstrapProductionDatabase({
      seasonName,
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      activateSeason: false, // keep existing test DB active season intact
      masterFullName: "Chapter Chair",
      masterEmail,
      masterPassword: "InitBootstrap#2026",
      rosterCsv: [
        "full_name,email,committee_slug,role",
        `Real AI Member,${memberEmail},ai-and-machine-learning,member`,
      ].join("\n"),
    });

    expect(res.ok).toBe(true);
    createdSeasonIds.push(res.seasonId);
    createdPersonIds.push(res.masterPersonId);
    for (const imported of res.importedRoster) {
      createdPersonIds.push(imported.personId);
    }

    const tracks = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, res.seasonId));
    expect(tracks.map((t) => t.slug).sort()).toEqual([
      "creative",
      "operations",
      "technical",
    ]);

    const committees = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, res.seasonId));
    expect(committees).toHaveLength(OFFICIAL_CHAPTER_COMMITTEES.length);
    expect(committees.every((c) => c.trackId !== null)).toBe(true);

    const rubrics = await db
      .select()
      .from(schema.scoringRubrics)
      .where(eq(schema.scoringRubrics.seasonId, res.seasonId));
    expect(rubrics.length).toBeGreaterThanOrEqual(7);

    const [masterPerson] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, res.masterPersonId));
    expect(masterPerson.mustChangePassword).toBe(true);
    expect(verifyPassword("InitBootstrap#2026", masterPerson.passwordHash)).toBe(
      true
    );

    // Zero mock snapshots or fake demo accounts in this clean season
    const snapshots = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.seasonId, res.seasonId));
    expect(snapshots).toHaveLength(0);

    const memberships = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.seasonId, res.seasonId));
    expect(memberships).toHaveLength(2); // master_admin + 1 imported CSV member

    // Re-running bootstrap is idempotent and does NOT overwrite master's password
    const rerun = await bootstrapProductionDatabase({
      seasonName,
      startDate: "2026-09-01",
      activateSeason: false,
      masterFullName: "Chapter Chair",
      masterEmail,
      masterPassword: "DifferentPasswordShouldBeIgnored!",
    });
    expect(rerun.seasonId).toBe(res.seasonId);
    expect(rerun.masterCreated).toBe(false);

    const [masterAfterRerun] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, res.masterPersonId));
    expect(
      verifyPassword("InitBootstrap#2026", masterAfterRerun.passwordHash)
    ).toBe(true);
  });
});
