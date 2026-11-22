import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Identity split Drizzle migrations (0009 expand/backfill & 0010 contract)", () => {
  it("registers expand+backfill (0009) and contract (0010) migrations in drizzle/meta/_journal.json", () => {
    const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    const expandEntry = journal.entries.find((e) => e.idx === 9);
    const contractEntry = journal.entries.find((e) => e.idx === 10);

    expect(expandEntry).toBeDefined();
    expect(expandEntry?.tag).toMatch(/^0009_/);
    expect(contractEntry).toBeDefined();
    expect(contractEntry?.tag).toMatch(/^0010_/);

    const expandSql = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${expandEntry!.tag}.sql`),
      "utf8"
    );
    const contractSql = fs.readFileSync(
      path.join(DRIZZLE_DIR, `${contractEntry!.tag}.sql`),
      "utf8"
    );

    // 0009: creates persons table with normalized email unique index
    expect(expandSql).toMatch(/CREATE TABLE "persons"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "persons_email_idx"/i);
    // 0009: backfills persons using lower(btrim(email)) and deterministic conflict precedence
    expect(expandSql).toMatch(/lower\(btrim\(rm\."email"\)\)/i);
    expect(expandSql).toMatch(/s\."status" = 'active'/i);
    expect(expandSql).toMatch(/rm\."password_changed_at" DESC NULLS LAST/i);
    expect(expandSql).toMatch(/rm\."must_change_password" ASC/i);
    // 0009: attaches person_id NOT NULL with ON DELETE RESTRICT
    expect(expandSql).toMatch(/ADD COLUMN "person_id" uuid/i);
    expect(expandSql).toMatch(/SET NOT NULL/i);
    expect(expandSql).toMatch(/ON DELETE restrict/i);
    // 0009: drops old one-role-per-season unique index and adds 5 partial unique indexes
    expect(expandSql).toMatch(/DROP INDEX(?:\s+IF EXISTS)? "roster_season_email_idx"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "roster_global_role_uniq"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "roster_director_global_uniq"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "roster_director_track_uniq"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "roster_committee_role_uniq"/i);
    expect(expandSql).toMatch(/CREATE UNIQUE INDEX "roster_unassigned_role_uniq"/i);

    // 0010: drops the 5 legacy identity/auth columns from roster_memberships
    expect(contractSql).toMatch(/DROP COLUMN "email"/i);
    expect(contractSql).toMatch(/DROP COLUMN "full_name"/i);
    expect(contractSql).toMatch(/DROP COLUMN "password_hash"/i);
    expect(contractSql).toMatch(/DROP COLUMN "must_change_password"/i);
    expect(contractSql).toMatch(/DROP COLUMN "password_changed_at"/i);
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)(
  "Identity split partial unique indexes & FK constraints against real PostgreSQL",
  () => {
    const createdPersonIds: string[] = [];
    const createdMembershipIds: string[] = [];

    afterEach(async () => {
      for (const mId of createdMembershipIds.splice(0)) {
        await db
          .delete(schema.rosterMemberships)
          .where(eq(schema.rosterMemberships.id, mId));
      }
      for (const pId of createdPersonIds.splice(0)) {
        await db.delete(schema.persons).where(eq(schema.persons.id, pId));
      }
    });

    it("allows multi-hat memberships for one person in one season while rejecting duplicate hats per role class", async () => {
      const [activeSeason] = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"))
        .limit(1);
      const seasonCommittees = await db
        .select()
        .from(schema.committees)
        .where(eq(schema.committees.seasonId, activeSeason.id))
        .limit(2);

      expect(activeSeason).toBeDefined();
      expect(seasonCommittees.length).toBeGreaterThanOrEqual(2);

      const [commA, commB] = seasonCommittees;
      const [person] = await db
        .insert(schema.persons)
        .values({
          email: `multihat.${crypto.randomUUID()}@cu.edu.eg`,
          fullName: "Multi-Hat Member",
          passwordHash: "salt:hash",
          mustChangePassword: false,
          isActive: true,
        })
        .returning();
      createdPersonIds.push(person.id);

      // Hat 1: hr_member tracking commA
      const [hat1] = await db
        .insert(schema.rosterMemberships)
        .values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "hr_member",
          committeeId: commA.id,
          isActive: true,
        })
        .returning();
      createdMembershipIds.push(hat1.id);

      // Hat 2: regular member of commB (same season, same person -> ALLOWED)
      const [hat2] = await db
        .insert(schema.rosterMemberships)
        .values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "member",
          committeeId: commB.id,
          isActive: true,
        })
        .returning();
      createdMembershipIds.push(hat2.id);

      // Duplicate Hat 2 (same season, person, role, committee) -> REJECTED
      await expect(
        db.insert(schema.rosterMemberships).values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "member",
          committeeId: commB.id,
          isActive: true,
        })
      ).rejects.toThrow();

      // Hat 3: unassigned attendee (committeeId NULL) -> ALLOWED once
      const [hat3] = await db
        .insert(schema.rosterMemberships)
        .values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "attendee",
          committeeId: null,
          isActive: true,
        })
        .returning();
      createdMembershipIds.push(hat3.id);

      // Duplicate unassigned attendee (committeeId NULL) -> REJECTED despite NULL
      await expect(
        db.insert(schema.rosterMemberships).values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "attendee",
          committeeId: null,
          isActive: true,
        })
      ).rejects.toThrow();

      // Hat 4: master_admin (global role, committeeId NULL) -> ALLOWED once
      const [hat4] = await db
        .insert(schema.rosterMemberships)
        .values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "master_admin",
          committeeId: null,
          isActive: true,
        })
        .returning();
      createdMembershipIds.push(hat4.id);

      // Duplicate master_admin -> REJECTED despite NULL committee
      await expect(
        db.insert(schema.rosterMemberships).values({
          seasonId: activeSeason.id,
          personId: person.id,
          role: "master_admin",
          committeeId: null,
          isActive: true,
        })
      ).rejects.toThrow();

      // Deleting person while memberships exist -> REJECTED (ON DELETE RESTRICT)
      await expect(
        db.delete(schema.persons).where(eq(schema.persons.id, person.id))
      ).rejects.toThrow();
    });
  }
);
