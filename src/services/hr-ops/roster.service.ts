import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { resetPersonPassword } from "@/services/auth-password.service";
import { hashPassword, generatePreassignedPassword } from "@/lib/password";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import { canAssignRoles, canAssignHrCommittees } from "@/lib/permissions";
import { parseRosterCsv } from "@/services/hr.service";
import {
  isSamePersonOrMembership,
  resolveMutableSeason,
  sanitizeDbError,
} from "./helpers";

export interface AddRosterMemberInput {
  fullName: string;
  email: string;
  role: MembershipRole;
  committeeId?: string | null;
  managedTrackId?: string | null;
  seasonId?: string;
}

export interface RosterActor {
  profile: {
    id?: string;
    personId?: string;
    role: MembershipRole;
    committeeId?: string | null;
  };
}

const VALID_ROLES = new Set<MembershipRole>([
  "master_admin",
  "director",
  "hr_admin",
  "hr_member",
  "committee_head",
  "member",
  "attendee",
]);

const PROTECTED_FROM_HR_ADMIN_RESET = new Set<MembershipRole>([
  "master_admin",
  "director",
  "hr_admin",
]);

/**
 * Returns true if any active role held by a person is privileged and therefore
 * protected from password reset by an hr_admin.
 */
export function isProtectedFromHrAdminPasswordReset(
  roles: readonly MembershipRole[]
): boolean {
  return roles.some((role) => PROTECTED_FROM_HR_ADMIN_RESET.has(role));
}

export async function addRosterMemberAsActor(
  input: AddRosterMemberInput,
  actor: RosterActor
) {
  if (!canAssignRoles(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can add members to the roster.",
    };
  }

  try {
    const normalizedEmail = normalizeEmail(input.email);
    const trimmedName = input.fullName?.trim() ?? "";
    if (!normalizedEmail || !normalizedEmail.includes("@") || !trimmedName) {
      return {
        ok: false,
        error: "Full name and a valid email address are required.",
      };
    }
    if (!VALID_ROLES.has(input.role)) {
      return { ok: false, error: "Invalid membership role." };
    }

    const seasonRes = await resolveMutableSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
    const seasonId = seasonRes.season.id;

    let committeeId: string | null = input.committeeId || null;
    if (committeeId) {
      const [comm] = await db
        .select()
        .from(schema.committees)
        .where(
          and(
            eq(schema.committees.id, committeeId),
            eq(schema.committees.seasonId, seasonId),
            eq(schema.committees.isActive, true)
          )
        )
        .limit(1);
      if (!comm) {
        return {
          ok: false,
          error: "Selected committee does not belong to this season.",
        };
      }
      committeeId = comm.id;
    }

    let managedTrackId: string | null =
      input.role === "director" ? input.managedTrackId || null : null;
    if (managedTrackId) {
      const [track] = await db
        .select()
        .from(schema.committeeTracks)
        .where(
          and(
            eq(schema.committeeTracks.id, managedTrackId),
            eq(schema.committeeTracks.seasonId, seasonId)
          )
        )
        .limit(1);
      if (!track) {
        return {
          ok: false,
          error: "Selected director track does not belong to this season.",
        };
      }
      managedTrackId = track.id;
    }

    // Reuse existing person identity & password if this email already exists across any season
    const [existingPerson] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.email, normalizedEmail))
      .limit(1);

    let personId: string;
    let tempPassword: string | undefined;
    let existingPersonFlag = false;

    if (existingPerson) {
      personId = existingPerson.id;
      existingPersonFlag = true;
    } else {
      tempPassword = generatePreassignedPassword();
      const passwordHash = hashPassword(tempPassword);
      const [createdPerson] = await db
        .insert(schema.persons)
        .values({
          email: normalizedEmail,
          fullName: trimmedName,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        })
        .returning();
      personId = createdPerson.id;
    }

    const [inserted] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId,
        personId,
        role: input.role,
        committeeId: input.role === "director" ? null : committeeId,
        managedTrackId,
        isActive: true,
      })
      .returning();

    return {
      ok: true,
      memberId: inserted.id,
      personId,
      existingPerson: existingPersonFlag,
      ...(tempPassword ? { tempPassword } : {}),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to add member to roster."),
    };
  }
}

export async function bulkImportRosterAsActor(
  csvContent: string,
  actor: RosterActor
): Promise<{
  ok: boolean;
  importedCount?: number;
  skippedCount?: number;
  imported?: Array<{
    id: string;
    personId: string;
    fullName: string;
    email: string;
    role: MembershipRole;
    committeeId: string | null;
    tempPassword?: string;
  }>;
  errors?: string[];
  error?: string;
}> {
  if (!canAssignRoles(actor.profile.role)) {
    return {
      ok: false,
      error:
        "Unauthorized: only Master Admin can bulk import roster members.",
    };
  }

  const parsed = parseRosterCsv(csvContent);
  if (parsed.validRecords.length === 0) {
    return {
      ok: false,
      error:
        parsed.errors.length > 0
          ? `No valid rows found (${parsed.errors.length} error(s)).`
          : "CSV contains no records to import.",
    };
  }

  const seasonRes = await resolveMutableSeason();
  if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
  const seasonId = seasonRes.season.id;

  const committees = await db
    .select()
    .from(schema.committees)
    .where(
      and(
        eq(schema.committees.seasonId, seasonId),
        eq(schema.committees.isActive, true)
      )
    );
  const committeeBySlug = new Map(
    committees.map((c) => [c.slug.toLowerCase(), c.id])
  );

  const imported: Array<{
    id: string;
    personId: string;
    fullName: string;
    email: string;
    role: MembershipRole;
    committeeId: string | null;
    tempPassword?: string;
  }> = [];
  const rowErrors: string[] = [];
  let skippedCount = 0;

  for (const rec of parsed.validRecords) {
    const committeeId = rec.committeeSlug
      ? committeeBySlug.get(rec.committeeSlug.toLowerCase()) ?? null
      : null;

    if (rec.committeeSlug && !committeeId) {
      skippedCount++;
      rowErrors.push(
        `Unknown committee slug "${rec.committeeSlug}" for ${rec.email}`
      );
      continue;
    }

    try {
      const [existingPerson] = await db
        .select()
        .from(schema.persons)
        .where(eq(schema.persons.email, rec.email))
        .limit(1);

      let personId: string;
      let personFullName: string;
      let tempPassword: string | undefined;

      if (existingPerson) {
        personId = existingPerson.id;
        personFullName = existingPerson.fullName;
      } else {
        tempPassword = generatePreassignedPassword();
        const [createdPerson] = await db
          .insert(schema.persons)
          .values({
            email: rec.email,
            fullName: rec.fullName,
            passwordHash: hashPassword(tempPassword),
            mustChangePassword: true,
            isActive: true,
          })
          .returning();
        personId = createdPerson.id;
        personFullName = createdPerson.fullName;
      }

      const [inserted] = await db
        .insert(schema.rosterMemberships)
        .values({
          seasonId,
          personId,
          role: rec.role,
          committeeId: rec.role === "director" ? null : committeeId,
          isActive: true,
        })
        .returning();

      imported.push({
        id: inserted.id,
        personId,
        fullName: personFullName,
        email: rec.email,
        role: inserted.role as MembershipRole,
        committeeId: inserted.committeeId,
        ...(tempPassword ? { tempPassword } : {}),
      });
    } catch (err) {
      skippedCount++;
      rowErrors.push(
        `Failed to import ${rec.email}: ${sanitizeDbError(err, "database error")}`
      );
    }
  }

  return {
    ok: imported.length > 0,
    importedCount: imported.length,
    skippedCount,
    imported,
    errors: rowErrors,
    error:
      imported.length === 0
        ? rowErrors[0] ?? "No members were imported."
        : undefined,
  };
}

export async function removeRosterMemberAsActor(
  memberId: string,
  actor: RosterActor
) {
  if (!canAssignRoles(actor.profile.role)) {
    return {
      ok: false,
      error:
        "Unauthorized: only Master Admin can remove members from the roster.",
    };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);
    if (!target) return { ok: false, error: "Member not found." };

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    if (isSamePersonOrMembership(actor.profile, target)) {
      return {
        ok: false,
        error: "You cannot deactivate your own active account.",
      };
    }

    await db
      .update(schema.rosterMemberships)
      .set({ isActive: false })
      .where(eq(schema.rosterMemberships.id, memberId));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to remove member from roster."),
    };
  }
}

export async function resetMemberPasswordAsActor(
  memberId: string,
  actor: RosterActor
): Promise<{ ok: boolean; tempPassword: string; error?: string }> {
  if (
    !canAssignRoles(actor.profile.role) &&
    actor.profile.role !== "hr_admin"
  ) {
    return {
      ok: false,
      tempPassword: "",
      error: "Unauthorized: cannot reset passwords.",
    };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);

    if (!target) {
      return { ok: false, tempPassword: "", error: "Member not found." };
    }

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) {
      return { ok: false, tempPassword: "", error: seasonRes.error };
    }

    // Prevent privilege escalation across multi-hat accounts:
    // check ALL active memberships of target.personId, not just the single clicked hat.
    if (actor.profile.role === "hr_admin") {
      const personMemberships = await db
        .select({ role: schema.rosterMemberships.role })
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.personId, target.personId),
            eq(schema.rosterMemberships.isActive, true)
          )
        );
      const rolesToCheck: MembershipRole[] = [
        target.role as MembershipRole,
        ...personMemberships.map((m) => m.role as MembershipRole),
      ];
      if (isProtectedFromHrAdminPasswordReset(rolesToCheck)) {
        return {
          ok: false,
          tempPassword: "",
          error:
            "Unauthorized: HR Admin cannot reset passwords for executive leadership or other HR Admins.",
        };
      }
    }

    const result = await resetPersonPassword({ personId: target.personId });
    return result;
  } catch (err: unknown) {
    return {
      ok: false,
      tempPassword: "",
      error: sanitizeDbError(err, "Failed to reset member password."),
    };
  }
}

export async function assignMemberRoleAsActor(
  memberId: string,
  newRole: MembershipRole,
  actor: RosterActor
) {
  if (!canAssignRoles(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can assign roles.",
    };
  }
  if (!VALID_ROLES.has(newRole)) {
    return { ok: false, error: "Invalid membership role." };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);
    if (!target) return { ok: false, error: "Member not found." };

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    await db
      .update(schema.rosterMemberships)
      .set({
        role: newRole,
        ...(newRole !== "director" ? { managedTrackId: null } : {}),
      })
      .where(eq(schema.rosterMemberships.id, memberId));
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update member role."),
    };
  }
}

export async function assignMemberCommitteeAsActor(
  memberId: string,
  committeeId: string | null,
  actor: RosterActor
) {
  if (
    !canAssignRoles(actor.profile.role) &&
    !canAssignHrCommittees(actor.profile.role)
  ) {
    return { ok: false, error: "Unauthorized: cannot assign committee." };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);
    if (!target) return { ok: false, error: "Member not found." };

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    // HR Admin can only assign committees for hr_member accounts (per permissions.ts)
    if (actor.profile.role === "hr_admin" && target.role !== "hr_member") {
      return {
        ok: false,
        error:
          "Unauthorized: HR Admin can only assign committees for HR Members.",
      };
    }

    let resolvedCommitteeId: string | null = committeeId || null;
    if (resolvedCommitteeId) {
      const [comm] = await db
        .select()
        .from(schema.committees)
        .where(
          and(
            eq(schema.committees.id, resolvedCommitteeId),
            eq(schema.committees.seasonId, target.seasonId),
            eq(schema.committees.isActive, true)
          )
        )
        .limit(1);
      if (!comm) {
        return {
          ok: false,
          error: "Committee not found in this member's season.",
        };
      }
      resolvedCommitteeId = comm.id;
    }

    await db
      .update(schema.rosterMemberships)
      .set({ committeeId: resolvedCommitteeId })
      .where(eq(schema.rosterMemberships.id, memberId));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update member committee."),
    };
  }
}

export async function assignDirectorTrackAsActor(
  memberId: string,
  trackId: string | null,
  actor: RosterActor
) {
  if (!canAssignRoles(actor.profile.role)) {
    return {
      ok: false,
      error:
        "Unauthorized: only Master Admin can assign committee tracks to Directors.",
    };
  }

  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);

    if (!target) {
      return { ok: false, error: "Member not found." };
    }
    if (target.role !== "director") {
      return {
        ok: false,
        error: "Only Directors can be assigned to oversee a committee track.",
      };
    }

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    let resolvedTrackId: string | null = trackId || null;
    if (resolvedTrackId) {
      const [track] = await db
        .select()
        .from(schema.committeeTracks)
        .where(
          and(
            eq(schema.committeeTracks.id, resolvedTrackId),
            eq(schema.committeeTracks.seasonId, target.seasonId)
          )
        )
        .limit(1);
      if (!track) {
        return {
          ok: false,
          error:
            "Selected track does not belong to this Director's season.",
        };
      }
      resolvedTrackId = track.id;
    }

    await db
      .update(schema.rosterMemberships)
      .set({ managedTrackId: resolvedTrackId })
      .where(eq(schema.rosterMemberships.id, memberId));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to assign director track."),
    };
  }
}
