import fs from "node:fs";
import * as dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import { withTransaction } from "./index";
import * as schema from "./schema";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import {
  OFFICIAL_CHAPTER_COMMITTEES,
  OFFICIAL_SCORING_RUBRICS,
} from "@/lib/committee-catalog";
import {
  generatePreassignedPassword,
  getDefaultMemberPassword,
  hashPassword,
} from "@/lib/password";
import {
  DEFAULT_COMMITTEE_TRACKS,
  DEFAULT_SEASON_SETTINGS,
} from "@/lib/season-settings";
import { normalizePhoneNumber } from "@/lib/phone";
import { parseRosterCsv } from "@/services/hr.service";

export interface BootstrapInput {
  seasonName: string;
  startDate?: string;
  endDate?: string;
  /** When true (default), sets the created season to `active` if no other active season exists. */
  activateSeason?: boolean;
  masterFullName: string;
  masterEmail: string;
  masterPhoneNumber?: string;
  masterPassword?: string;
  /** Optional raw CSV text (`full_name,email,committee_slug,role[,phone_number]`) to import initial roster. */
  rosterCsv?: string;
}

export interface BootstrapImportedMember {
  membershipId: string;
  personId: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  tempPassword?: string;
}

export interface BootstrapResult {
  ok: true;
  seasonId: string;
  seasonName: string;
  masterPersonId: string;
  masterMembershipId: string;
  masterCreated: boolean;
  masterTempPassword?: string;
  committeesEnsured: number;
  rubricsEnsured: number;
  importedRoster: BootstrapImportedMember[];
  rosterErrors: string[];
}

/**
 * Clean, idempotent production database bootstrap.
 * Creates the initial season, 3 default committee tracks, all 12 official committees,
 * default scoring rubrics, the real initial `master_admin` account, and optionally
 * imports a chapter roster CSV — with zero fake demo accounts or mock snapshots.
 */
export async function bootstrapProductionDatabase(
  input: BootstrapInput
): Promise<BootstrapResult> {
  const seasonName = input.seasonName?.trim();
  if (!seasonName) {
    throw new Error("BOOTSTRAP_SEASON_NAME is required.");
  }

  const masterFullName = input.masterFullName?.trim();
  const masterEmail = normalizeEmail(input.masterEmail ?? "");
  if (!masterFullName || !masterEmail || !masterEmail.includes("@")) {
    throw new Error(
      "BOOTSTRAP_MASTER_NAME and a valid BOOTSTRAP_MASTER_EMAIL are required."
    );
  }

  let masterPhoneNumber: string | null = null;
  if (input.masterPhoneNumber && input.masterPhoneNumber.trim()) {
    masterPhoneNumber = normalizePhoneNumber(input.masterPhoneNumber);
    if (!masterPhoneNumber) {
      throw new Error(
        `Invalid BOOTSTRAP_MASTER_PHONE: "${input.masterPhoneNumber}"`
      );
    }
  }

  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`Invalid BOOTSTRAP_SEASON_START date: "${input.startDate}"`);
  }

  let endDate: Date | null = null;
  if (input.endDate && input.endDate.trim()) {
    endDate = new Date(input.endDate.trim());
    if (Number.isNaN(endDate.getTime())) {
      throw new Error(`Invalid BOOTSTRAP_SEASON_END date: "${input.endDate}"`);
    }
    if (endDate.getTime() < startDate.getTime()) {
      throw new Error("BOOTSTRAP_SEASON_END must be on or after start date.");
    }
  }

  const shouldActivate = input.activateSeason !== false;

  return withTransaction(async (tx) => {
    // 1. Season (idempotent by name; never mutates archived seasons)
    let [season] = await tx
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.name, seasonName))
      .limit(1);

    if (!season) {
      const [existingActive] = await tx
        .select({ id: schema.seasons.id })
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"))
        .limit(1);

      const initialStatus =
        shouldActivate && !existingActive ? "active" : "draft";

      [season] = await tx
        .insert(schema.seasons)
        .values({
          name: seasonName,
          status: initialStatus,
          startDate,
          endDate,
          settingsJson: DEFAULT_SEASON_SETTINGS,
        })
        .returning();
    } else if (season.status === "archived") {
      throw new Error(
        `Season "${seasonName}" is archived and cannot be modified by bootstrap.`
      );
    }

    // 2. Default 3 committee tracks (Technical, Creative, Operations)
    await tx
      .insert(schema.committeeTracks)
      .values(
        DEFAULT_COMMITTEE_TRACKS.map((t) => ({
          seasonId: season.id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          sortOrder: t.sortOrder,
        }))
      )
      .onConflictDoNothing();

    const tracks = await tx
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, season.id));
    const trackBySlug = new Map(tracks.map((t) => [t.slug, t.id]));

    // 3. All 12 official IEEE EMBS CUSB committees mapped to their tracks
    await tx
      .insert(schema.committees)
      .values(
        OFFICIAL_CHAPTER_COMMITTEES.map((c) => ({
          seasonId: season.id,
          trackId: trackBySlug.get(c.defaultTrackSlug) ?? null,
          name: c.name,
          slug: c.slug,
          category: c.track,
          isActive: true,
        }))
      )
      .onConflictDoNothing();

    const seasonCommittees = await tx
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, season.id));
    const committeeBySlug = new Map(
      seasonCommittees.map((c) => [c.slug.toLowerCase(), c.id])
    );

    // 4. Official scoring rubrics
    await tx
      .insert(schema.scoringRubrics)
      .values(
        OFFICIAL_SCORING_RUBRICS.map((r) => ({
          seasonId: season.id,
          name: r.name,
          maxPoints: r.maxPoints,
          weight: r.weight,
          leadersOnly: r.leadersOnly,
          sortOrder: r.sortOrder,
        }))
      )
      .onConflictDoNothing();

    // 5. Initial master_admin person (never overwrites existing person credentials!)
    let [masterPerson] = await tx
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.email, masterEmail))
      .limit(1);

    let masterCreated = false;
    let masterTempPassword: string | undefined;

    if (!masterPerson) {
      masterTempPassword =
        input.masterPassword?.trim() || generatePreassignedPassword();
      [masterPerson] = await tx
        .insert(schema.persons)
        .values({
          email: masterEmail,
          phoneNumber: masterPhoneNumber,
          fullName: masterFullName,
          passwordHash: hashPassword(masterTempPassword),
          mustChangePassword: true,
          isActive: true,
        })
        .returning();
      masterCreated = true;
    } else if (!masterPerson.phoneNumber && masterPhoneNumber) {
      [masterPerson] = await tx
        .update(schema.persons)
        .set({ phoneNumber: masterPhoneNumber, updatedAt: new Date() })
        .where(eq(schema.persons.id, masterPerson.id))
        .returning();
    }

    await tx
      .insert(schema.rosterMemberships)
      .values({
        seasonId: season.id,
        personId: masterPerson.id,
        committeeId: null,
        role: "master_admin",
        isActive: true,
      })
      .onConflictDoNothing();

    const [masterMembership] = await tx
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, season.id),
          eq(schema.rosterMemberships.personId, masterPerson.id),
          eq(schema.rosterMemberships.role, "master_admin")
        )
      )
      .limit(1);

    // 6. Optional initial roster CSV import
    const importedRoster: BootstrapImportedMember[] = [];
    const rosterErrors: string[] = [];

    if (input.rosterCsv && input.rosterCsv.trim().length > 0) {
      const parsed = parseRosterCsv(input.rosterCsv);
      for (const parseErr of parsed.errors) {
        rosterErrors.push(`Row ${parseErr.line}: ${parseErr.message}`);
      }

      const hrCommId = committeeBySlug.get("human-resources") ?? null;

      for (const rec of parsed.validRecords) {
        const commId = rec.committeeSlug
          ? committeeBySlug.get(rec.committeeSlug.toLowerCase()) ?? null
          : null;

        if (rec.committeeSlug && !commId) {
          rosterErrors.push(
            `Unknown committee slug "${rec.committeeSlug}" for ${rec.email}`
          );
          continue;
        }

        let [person] = await tx
          .select()
          .from(schema.persons)
          .where(eq(schema.persons.email, rec.email))
          .limit(1);

        const normalizedCsvPhone = rec.phoneNumber
          ? normalizePhoneNumber(rec.phoneNumber)
          : null;

        let tempPassword: string | undefined;
        if (!person) {
          tempPassword = getDefaultMemberPassword();
          [person] = await tx
            .insert(schema.persons)
            .values({
              email: rec.email,
              phoneNumber: normalizedCsvPhone,
              fullName: rec.fullName,
              passwordHash: hashPassword(tempPassword),
              mustChangePassword: true,
              isActive: true,
            })
            .returning();
        } else if (!person.phoneNumber && normalizedCsvPhone) {
          [person] = await tx
            .update(schema.persons)
            .set({ phoneNumber: normalizedCsvPhone, updatedAt: new Date() })
            .where(eq(schema.persons.id, person.id))
            .returning();
        }

        const membershipCommitteeId =
          rec.role === "director"
            ? null
            : rec.role === "hr_member"
              ? hrCommId
              : commId;
        const trackedCommitteeId =
          rec.role === "hr_member" && commId && commId !== hrCommId
            ? commId
            : null;

        const [inserted] = await tx
          .insert(schema.rosterMemberships)
          .values({
            seasonId: season.id,
            personId: person.id,
            committeeId: membershipCommitteeId,
            trackedCommitteeId,
            role: rec.role,
            isActive: true,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted) {
          importedRoster.push({
            membershipId: inserted.id,
            personId: person.id,
            fullName: person.fullName,
            email: person.email,
            role: inserted.role as MembershipRole,
            ...(tempPassword ? { tempPassword } : {}),
          });
        }
      }
    }

    return {
      ok: true,
      seasonId: season.id,
      seasonName: season.name,
      masterPersonId: masterPerson.id,
      masterMembershipId: masterMembership.id,
      masterCreated,
      ...(masterTempPassword ? { masterTempPassword } : {}),
      committeesEnsured: seasonCommittees.length,
      rubricsEnsured: OFFICIAL_SCORING_RUBRICS.length,
      importedRoster,
      rosterErrors,
    };
  });
}

if (process.argv[1]?.endsWith("bootstrap.ts")) {
  dotenv.config({ path: ".env.local", quiet: true });
  dotenv.config({ quiet: true });

  const csvPath = process.env.BOOTSTRAP_ROSTER_CSV_PATH?.trim();
  const rosterCsv = csvPath ? fs.readFileSync(csvPath, "utf8") : undefined;

  bootstrapProductionDatabase({
    seasonName: process.env.BOOTSTRAP_SEASON_NAME ?? "",
    startDate: process.env.BOOTSTRAP_SEASON_START,
    endDate: process.env.BOOTSTRAP_SEASON_END,
    masterFullName: process.env.BOOTSTRAP_MASTER_NAME ?? "",
    masterEmail: process.env.BOOTSTRAP_MASTER_EMAIL ?? "",
    masterPhoneNumber: process.env.BOOTSTRAP_MASTER_PHONE,
    masterPassword: process.env.BOOTSTRAP_MASTER_PASSWORD,
    rosterCsv,
  })
    .then((result) => {
      console.log(`Bootstrap complete for season "${result.seasonName}" (${result.seasonId}).`);
      console.log(`- Committees ensured: ${result.committeesEnsured}`);
      console.log(`- Scoring rubrics ensured: ${result.rubricsEnsured}`);
      if (result.masterCreated && result.masterTempPassword) {
        console.log(
          `- Initial Master Admin created (${process.env.BOOTSTRAP_MASTER_EMAIL}).`
        );
        console.log(
          `- One-time temporary password (must change on first login): ${result.masterTempPassword}`
        );
      } else {
        console.log(
          "- Master Admin account already existed; existing credentials were preserved."
        );
      }
      if (result.importedRoster.length > 0) {
        console.log(`- Imported ${result.importedRoster.length} roster member(s) from CSV.`);
        for (const m of result.importedRoster) {
          if (m.tempPassword) {
            console.log(`  * ${m.email} (${m.role}) -> temp password: ${m.tempPassword}`);
          }
        }
      }
      if (result.rosterErrors.length > 0) {
        console.warn(`- CSV warnings (${result.rosterErrors.length}):`);
        for (const err of result.rosterErrors) {
          console.warn(`  * ${err}`);
        }
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Bootstrap failed:", err);
      process.exit(1);
    });
}
