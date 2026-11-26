import { db, withTransaction } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { resetPersonPassword } from "@/services/auth-password.service";
import { hashPassword, getDefaultMemberPassword } from "@/lib/password";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import { normalizePhoneNumber } from "@/lib/phone";
import { canAssignRoles, canAssignHrCommittees } from "@/lib/permissions";
import { parseRosterCsv } from "@/services/hr.service";
import { ensureHrCommitteeForSeason } from "./committees.service";
import {
  isSamePersonOrMembership,
  resolveMutableSeason,
  sanitizeDbError,
} from "./helpers";

export interface AddRosterMemberInput {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: MembershipRole;
  committeeId?: string | null;
  trackedCommitteeId?: string | null;
  trackedCommitteeIds?: string[];
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

export interface AddRosterMemberResult {
  ok: boolean;
  memberId?: string;
  personId?: string;
  phoneNumber?: string | null;
  existingPerson?: boolean;
  tempPassword?: string;
  error?: string;
}

export async function addRosterMemberAsActor(
  input: AddRosterMemberInput,
  actor: RosterActor
): Promise<AddRosterMemberResult> {
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

    const rawPhone = input.phoneNumber?.trim() ?? "";
    let normalizedPhone: string | null = null;
    if (rawPhone.length > 0) {
      normalizedPhone = normalizePhoneNumber(rawPhone);
      if (!normalizedPhone) {
        return {
          ok: false,
          error:
            "Invalid phone number. Enter an Egyptian mobile (e.g. 01012345678) or international E.164 number (+20...).",
        };
      }
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

    // For hr_member: home committee is ALWAYS Human Resources (auto-ensured if missing);
    // the assigned committee(s) become tracked committees in hr_member_tracked_committees
    // (with trackedCommitteeId kept in sync as the primary tracked committee).
    let trackedCommitteeId: string | null = null;
    let trackedCommitteeIds: string[] = [];
    if (input.role === "hr_member") {
      const hrComm = await ensureHrCommitteeForSeason(seasonId);
      const rawRequestedIds: string[] =
        input.trackedCommitteeIds !== undefined
          ? input.trackedCommitteeIds
          : input.trackedCommitteeId !== undefined
            ? input.trackedCommitteeId
              ? [input.trackedCommitteeId]
              : []
            : committeeId && committeeId !== hrComm.id
              ? [committeeId]
              : [];

      const uniqueRequested = Array.from(
        new Set(
          rawRequestedIds
            .map((id) => id?.trim())
            .filter((id): id is string => Boolean(id) && id !== hrComm.id)
        )
      );

      if (uniqueRequested.length > 0) {
        const validComms = await db
          .select({ id: schema.committees.id })
          .from(schema.committees)
          .where(
            and(
              inArray(schema.committees.id, uniqueRequested),
              eq(schema.committees.seasonId, seasonId),
              eq(schema.committees.isActive, true)
            )
          );
        const validSet = new Set(validComms.map((c) => c.id));
        if (validSet.size !== uniqueRequested.length) {
          return {
            ok: false,
            error: "Selected tracked committee does not belong to this season.",
          };
        }
        trackedCommitteeIds = uniqueRequested;
        trackedCommitteeId = trackedCommitteeIds[0] ?? null;
      }
      committeeId = hrComm.id;
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

    if (normalizedPhone) {
      const [phoneOwner] = await db
        .select({ id: schema.persons.id, email: schema.persons.email })
        .from(schema.persons)
        .where(eq(schema.persons.phoneNumber, normalizedPhone))
        .limit(1);
      if (phoneOwner && phoneOwner.email !== normalizedEmail) {
        return {
          ok: false,
          error: "This phone number is already assigned to another member.",
        };
      }
    }

    const {
      inserted,
      personId,
      resolvedPhoneNumber,
      existingPersonFlag,
      tempPassword,
    } = await withTransaction(async (tx) => {
        // Reuse existing person identity & password if this email already exists across any season
        const [existingPerson] = await tx
          .select()
          .from(schema.persons)
          .where(eq(schema.persons.email, normalizedEmail))
          .limit(1);

        let resolvedPersonId: string;
        let resolvedPhone: string | null = normalizedPhone;
        let resolvedTempPassword: string | undefined;
        let isExistingPerson = false;

        if (existingPerson) {
          resolvedPersonId = existingPerson.id;
          isExistingPerson = true;
          resolvedPhone = existingPerson.phoneNumber ?? normalizedPhone;
          if (!existingPerson.phoneNumber && normalizedPhone) {
            await tx
              .update(schema.persons)
              .set({ phoneNumber: normalizedPhone, updatedAt: new Date() })
              .where(eq(schema.persons.id, existingPerson.id));
          }
        } else {
          resolvedTempPassword = getDefaultMemberPassword();
          const passwordHash = hashPassword(resolvedTempPassword);
          const [createdPerson] = await tx
            .insert(schema.persons)
            .values({
              email: normalizedEmail,
              phoneNumber: normalizedPhone,
              fullName: trimmedName,
              passwordHash,
              mustChangePassword: true,
              isActive: true,
            })
            .returning();
          resolvedPersonId = createdPerson.id;
          resolvedPhone = createdPerson.phoneNumber;
        }

        const [membership] = await tx
          .insert(schema.rosterMemberships)
          .values({
            seasonId,
            personId: resolvedPersonId,
            role: input.role,
            committeeId: input.role === "director" ? null : committeeId,
            trackedCommitteeId,
            managedTrackId,
            isActive: true,
          })
          .returning();

        if (input.role === "hr_member" && trackedCommitteeIds.length > 0) {
          await tx
            .insert(schema.hrMemberTrackedCommittees)
            .values(
              trackedCommitteeIds.map((tcId) => ({
                seasonId,
                membershipId: membership.id,
                committeeId: tcId,
              }))
            )
            .onConflictDoNothing();
        }

        return {
          inserted: membership,
          personId: resolvedPersonId,
          resolvedPhoneNumber: resolvedPhone,
          existingPersonFlag: isExistingPerson,
          tempPassword: resolvedTempPassword,
        };
      });

    return {
      ok: true,
      memberId: inserted.id,
      personId,
      phoneNumber: resolvedPhoneNumber,
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
    phoneNumber?: string | null;
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
    phoneNumber?: string | null;
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
      const rowImported = await withTransaction(async (tx) => {
        const [existingPerson] = await tx
          .select()
          .from(schema.persons)
          .where(eq(schema.persons.email, rec.email))
          .limit(1);

        let personId: string;
        let personFullName: string;
        let personPhoneNumber: string | null = null;
        let tempPassword: string | undefined;

        const normalizedCsvPhone = rec.phoneNumber
          ? normalizePhoneNumber(rec.phoneNumber)
          : null;

        if (existingPerson) {
          personId = existingPerson.id;
          personFullName = existingPerson.fullName;
          personPhoneNumber = existingPerson.phoneNumber ?? null;
          if (!existingPerson.phoneNumber && normalizedCsvPhone) {
            await tx
              .update(schema.persons)
              .set({ phoneNumber: normalizedCsvPhone, updatedAt: new Date() })
              .where(eq(schema.persons.id, existingPerson.id));
            personPhoneNumber = normalizedCsvPhone;
          }
        } else {
          tempPassword = getDefaultMemberPassword();
          const [createdPerson] = await tx
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
          personId = createdPerson.id;
          personFullName = createdPerson.fullName;
          personPhoneNumber = createdPerson.phoneNumber ?? null;
        }

        let membershipCommitteeId = rec.role === "director" ? null : committeeId;
        let membershipTrackedCommitteeId: string | null = null;
        if (rec.role === "hr_member") {
          const hrComm = await ensureHrCommitteeForSeason(seasonId, tx);
          membershipTrackedCommitteeId =
            committeeId && committeeId !== hrComm.id ? committeeId : null;
          membershipCommitteeId = hrComm.id;
        }

        const [inserted] = await tx
          .insert(schema.rosterMemberships)
          .values({
            seasonId,
            personId,
            role: rec.role,
            committeeId: membershipCommitteeId,
            trackedCommitteeId: membershipTrackedCommitteeId,
            isActive: true,
          })
          .returning();

        if (rec.role === "hr_member" && membershipTrackedCommitteeId) {
          await tx
            .insert(schema.hrMemberTrackedCommittees)
            .values({
              seasonId,
              membershipId: inserted.id,
              committeeId: membershipTrackedCommitteeId,
            })
            .onConflictDoNothing();
        }

        return {
          id: inserted.id,
          personId,
          fullName: personFullName,
          email: rec.email,
          phoneNumber: personPhoneNumber,
          role: inserted.role as MembershipRole,
          committeeId: inserted.committeeId,
          ...(tempPassword ? { tempPassword } : {}),
        };
      });

      imported.push(rowImported);
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

    if (newRole === "hr_member") {
      const hrComm = await ensureHrCommitteeForSeason(target.seasonId);
      const preservedTracked =
        target.trackedCommitteeId ??
        (target.committeeId && target.committeeId !== hrComm.id
          ? target.committeeId
          : null);
      await withTransaction(async (tx) => {
        await tx
          .update(schema.rosterMemberships)
          .set({
            role: newRole,
            committeeId: hrComm.id,
            trackedCommitteeId: preservedTracked,
            managedTrackId: null,
          })
          .where(eq(schema.rosterMemberships.id, memberId));

        if (preservedTracked) {
          await tx
            .insert(schema.hrMemberTrackedCommittees)
            .values({
              seasonId: target.seasonId,
              membershipId: memberId,
              committeeId: preservedTracked,
            })
            .onConflictDoNothing();
        }
      });
      return { ok: true };
    }

    await withTransaction(async (tx) => {
      await tx
        .update(schema.rosterMemberships)
        .set({
          role: newRole,
          trackedCommitteeId: null,
          ...(newRole === "director"
            ? { committeeId: null }
            : { managedTrackId: null }),
        })
        .where(eq(schema.rosterMemberships.id, memberId));

      await tx
        .delete(schema.hrMemberTrackedCommittees)
        .where(eq(schema.hrMemberTrackedCommittees.membershipId, memberId));
    });
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

    if (target.role === "hr_member") {
      const hrComm = await ensureHrCommitteeForSeason(target.seasonId);
      const nextTracked =
        resolvedCommitteeId && resolvedCommitteeId !== hrComm.id
          ? resolvedCommitteeId
          : null;
      await withTransaction(async (tx) => {
        await tx
          .update(schema.rosterMemberships)
          .set({
            committeeId: hrComm.id,
            trackedCommitteeId: nextTracked,
          })
          .where(eq(schema.rosterMemberships.id, memberId));

        await tx
          .delete(schema.hrMemberTrackedCommittees)
          .where(eq(schema.hrMemberTrackedCommittees.membershipId, memberId));

        if (nextTracked) {
          await tx
            .insert(schema.hrMemberTrackedCommittees)
            .values({
              seasonId: target.seasonId,
              membershipId: memberId,
              committeeId: nextTracked,
            })
            .onConflictDoNothing();
        }
      });
    } else {
      await db
        .update(schema.rosterMemberships)
        .set({ committeeId: resolvedCommitteeId })
        .where(eq(schema.rosterMemberships.id, memberId));
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update member committee."),
    };
  }
}

export async function assignHrTrackedCommitteesAsActor(
  memberId: string,
  committeeIds: string[],
  actor: RosterActor
) {
  if (
    !canAssignRoles(actor.profile.role) &&
    !canAssignHrCommittees(actor.profile.role)
  ) {
    return {
      ok: false,
      error: "Unauthorized: cannot assign HR tracked committees.",
    };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);
    if (!target) return { ok: false, error: "Member not found." };

    if (target.role !== "hr_member") {
      return {
        ok: false,
        error: "Multiple tracked committees can only be assigned to HR Members.",
      };
    }

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const hrComm = await ensureHrCommitteeForSeason(target.seasonId);
    const uniqueRequested = Array.from(
      new Set(
        (committeeIds ?? [])
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id) && id !== hrComm.id)
      )
    );

    if (uniqueRequested.length > 0) {
      const validComms = await db
        .select({ id: schema.committees.id })
        .from(schema.committees)
        .where(
          and(
            inArray(schema.committees.id, uniqueRequested),
            eq(schema.committees.seasonId, target.seasonId),
            eq(schema.committees.isActive, true)
          )
        );
      if (validComms.length !== uniqueRequested.length) {
        return {
          ok: false,
          error: "One or more selected committees were not found in this season.",
        };
      }
    }

    await withTransaction(async (tx) => {
      await tx
        .update(schema.rosterMemberships)
        .set({
          committeeId: hrComm.id,
          trackedCommitteeId: uniqueRequested[0] ?? null,
        })
        .where(eq(schema.rosterMemberships.id, memberId));

      await tx
        .delete(schema.hrMemberTrackedCommittees)
        .where(eq(schema.hrMemberTrackedCommittees.membershipId, memberId));

      if (uniqueRequested.length > 0) {
        await tx
          .insert(schema.hrMemberTrackedCommittees)
          .values(
            uniqueRequested.map((tcId) => ({
              seasonId: target.seasonId,
              membershipId: memberId,
              committeeId: tcId,
            }))
          )
          .onConflictDoNothing();
      }
    });

    return { ok: true, trackedCommitteeIds: uniqueRequested };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update HR tracked committees."),
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

export async function updatePersonPhoneNumberAsActor(
  memberId: string,
  rawPhoneNumber: string | null,
  actor: RosterActor
): Promise<{ ok: boolean; phoneNumber?: string | null; error?: string }> {
  if (!canAssignHrCommittees(actor.profile.role)) {
    return {
      ok: false,
      error:
        "Unauthorized: only Master Admin and HR Admin can update member phone numbers.",
    };
  }

  const trimmed = rawPhoneNumber?.trim() ?? "";
  let normalizedPhone: string | null = null;
  if (trimmed.length > 0) {
    normalizedPhone = normalizePhoneNumber(trimmed);
    if (!normalizedPhone) {
      return {
        ok: false,
        error:
          "Invalid phone number. Enter an Egyptian mobile (e.g. 01012345678) or international E.164 number (+20...).",
      };
    }
  }

  try {
    const [target] = await db
      .select({
        id: schema.rosterMemberships.id,
        personId: schema.rosterMemberships.personId,
        seasonId: schema.rosterMemberships.seasonId,
      })
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);

    if (!target) {
      return { ok: false, error: "Member not found." };
    }

    const seasonRes = await resolveMutableSeason(target.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    if (normalizedPhone) {
      const [conflict] = await db
        .select({ id: schema.persons.id })
        .from(schema.persons)
        .where(
          and(
            eq(schema.persons.phoneNumber, normalizedPhone),
            ne(schema.persons.id, target.personId)
          )
        )
        .limit(1);
      if (conflict) {
        return {
          ok: false,
          error: "This phone number is already assigned to another member.",
        };
      }
    }

    await db
      .update(schema.persons)
      .set({
        phoneNumber: normalizedPhone,
        updatedAt: new Date(),
      })
      .where(eq(schema.persons.id, target.personId));

    return { ok: true, phoneNumber: normalizedPhone };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update phone number."),
    };
  }
}
