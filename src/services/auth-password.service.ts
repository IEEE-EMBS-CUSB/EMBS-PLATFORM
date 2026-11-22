import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  normalizeEmail,
  type MembershipRole,
  type SeasonStatus,
} from "@/lib/auth-helpers";
import {
  hashPassword,
  verifyPassword,
  generatePreassignedPassword,
  isPasswordStrong,
} from "@/lib/password";

export interface AuthenticatedMemberResult {
  id: string;
  personId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
  committeeId?: string | null;
  mustChangePassword: boolean;
}

export interface PasswordAuthSuccess {
  ok: true;
  member: AuthenticatedMemberResult;
  mustChangePassword: boolean;
}

export interface PasswordAuthFailure {
  ok: false;
  reason: string;
}

export type PasswordAuthResult = PasswordAuthSuccess | PasswordAuthFailure;

export interface RosterMemberLookupRecord {
  id: string;
  personId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
  committeeId?: string | null;
  passwordHash?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

export interface LoginMembershipCandidate {
  id: string;
  role: MembershipRole;
  committeeId: string | null;
  isActive: boolean;
  seasonStatus: SeasonStatus;
  seasonStartDate: Date;
  createdAt: Date;
}

const ROLE_PRECEDENCE: Record<MembershipRole, number> = {
  master_admin: 0,
  director: 1,
  hr_admin: 2,
  committee_head: 3,
  hr_member: 4,
  member: 5,
  attendee: 6,
};

const GENERIC_AUTH_FAILURE = "Invalid email or password.";

/**
 * Deterministically chooses the initial login membership for a person across seasons and hats:
 * 1. If the person has any membership in an active season, only active memberships in that
 *    active season are eligible (deactivated active-season members never fall back to archived).
 *    Multiple hats in the active season break ties by operational precedence, then createdAt ASC.
 * 2. Otherwise, alumni with no active-season membership may log into their most recent
 *    active membership in an archived season (read-only).
 * 3. Draft-season memberships are never permitted to authenticate.
 */
export function pickPreferredLoginMembership(
  candidates: readonly LoginMembershipCandidate[]
): LoginMembershipCandidate | null {
  const activeSeasonRows = candidates.filter((c) => c.seasonStatus === "active");
  if (activeSeasonRows.length > 0) {
    const eligibleActive = activeSeasonRows.filter((c) => c.isActive);
    if (eligibleActive.length === 0) return null;

    return [...eligibleActive].sort((a, b) => {
      const roleDiff =
        (ROLE_PRECEDENCE[a.role] ?? 99) - (ROLE_PRECEDENCE[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];
  }

  const archivedEligible = candidates.filter(
    (c) => c.seasonStatus === "archived" && c.isActive
  );
  if (archivedEligible.length === 0) return null;

  return [...archivedEligible].sort((a, b) => {
    const seasonDiff =
      b.seasonStartDate.getTime() - a.seasonStartDate.getTime();
    if (seasonDiff !== 0) return seasonDiff;
    const roleDiff =
      (ROLE_PRECEDENCE[a.role] ?? 99) - (ROLE_PRECEDENCE[b.role] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

/**
 * Resolves a person and their preferred login membership by normalized email.
 * Credentials live on `persons`; role/committee/season scoping lives on `roster_memberships`.
 */
export async function resolveLoginMembershipByEmail(
  normalizedEmail: string
): Promise<RosterMemberLookupRecord | null> {
  const [person] = await db
    .select()
    .from(schema.persons)
    .where(eq(schema.persons.email, normalizedEmail))
    .limit(1);

  if (!person || !person.isActive) return null;

  const memberships = await db
    .select({
      id: schema.rosterMemberships.id,
      role: schema.rosterMemberships.role,
      committeeId: schema.rosterMemberships.committeeId,
      isActive: schema.rosterMemberships.isActive,
      createdAt: schema.rosterMemberships.createdAt,
      seasonStatus: schema.seasons.status,
      seasonStartDate: schema.seasons.startDate,
    })
    .from(schema.rosterMemberships)
    .innerJoin(
      schema.seasons,
      eq(schema.rosterMemberships.seasonId, schema.seasons.id)
    )
    .where(eq(schema.rosterMemberships.personId, person.id));

  if (memberships.length === 0) return null;

  const chosen = pickPreferredLoginMembership(
    memberships.map((m) => ({
      id: m.id,
      role: m.role as MembershipRole,
      committeeId: m.committeeId,
      isActive: m.isActive,
      seasonStatus: m.seasonStatus as SeasonStatus,
      seasonStartDate: m.seasonStartDate,
      createdAt: m.createdAt,
    }))
  );

  if (!chosen) return null;

  return {
    id: chosen.id,
    personId: person.id,
    email: person.email,
    fullName: person.fullName,
    role: chosen.role,
    committeeId: chosen.committeeId,
    passwordHash: person.passwordHash,
    mustChangePassword: person.mustChangePassword,
    isActive: person.isActive && chosen.isActive,
  };
}

/**
 * Authenticates a user using their whitelisted email and password.
 * Checks person + active roster whitelist, verifies scrypt hash, and reports if first-login reset is required.
 */
export async function authenticateWithPassword(params: {
  email: string;
  password: string;
  rosterLookup?: (email: string) => Promise<RosterMemberLookupRecord | null>;
}): Promise<PasswordAuthResult> {
  const { email, password, rosterLookup } = params;
  const normalized = normalizeEmail(email);

  if (!normalized || !normalized.includes("@")) {
    return { ok: false, reason: "Please provide a valid email address." };
  }

  if (!password) {
    return { ok: false, reason: "Please enter your password." };
  }

  let member: RosterMemberLookupRecord | null = null;

  if (rosterLookup) {
    member = await rosterLookup(normalized);
  } else {
    try {
      member = await resolveLoginMembershipByEmail(normalized);
    } catch {
      return {
        ok: false,
        reason:
          "Authentication service is temporarily unavailable. Please try again.",
      };
    }
  }

  if (!member || !member.isActive || !member.passwordHash) {
    return { ok: false, reason: GENERIC_AUTH_FAILURE };
  }

  const valid = verifyPassword(password, member.passwordHash);
  if (!valid) {
    return { ok: false, reason: GENERIC_AUTH_FAILURE };
  }

  return {
    ok: true,
    mustChangePassword: member.mustChangePassword,
    member: {
      id: member.id,
      personId: member.personId,
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      committeeId: member.committeeId,
      mustChangePassword: member.mustChangePassword,
    },
  };
}

/**
 * Required first-login password change.
 * Verifies current password, checks strength of new password, and updates hash on `persons`.
 */
export async function changeFirstLoginPassword(params: {
  currentPassword: string;
  newPassword: string;
  member: {
    id: string;
    personId?: string;
    email: string;
    passwordHash: string;
    mustChangePassword: boolean;
  };
  updateMember?: (
    id: string,
    data: {
      passwordHash: string;
      mustChangePassword: boolean;
      passwordChangedAt: Date;
    }
  ) => Promise<void>;
}): Promise<{ ok: boolean; reason?: string; passwordChangedAt?: Date }> {
  const { currentPassword, newPassword, member, updateMember } = params;

  if (!member.mustChangePassword) {
    return {
      ok: false,
      reason:
        "Password change is not required for this account. Please sign in normally.",
    };
  }

  if (!verifyPassword(currentPassword, member.passwordHash)) {
    return { ok: false, reason: "Current temporary password is incorrect." };
  }

  const strength = isPasswordStrong(newPassword);
  if (!strength.valid) {
    return { ok: false, reason: strength.reason };
  }

  if (currentPassword === newPassword) {
    return {
      ok: false,
      reason:
        "New password must be different from your pre-assigned temporary password.",
    };
  }

  const newHash = hashPassword(newPassword);
  const now = new Date();
  const targetPersonId = member.personId ?? member.id;

  if (updateMember) {
    await updateMember(targetPersonId, {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    });
  } else {
    await db
      .update(schema.persons)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.persons.id, targetPersonId));
  }

  return { ok: true, passwordChangedAt: now };
}

/**
 * Resets a person's password on `persons` and sets mustChangePassword = true.
 * Used by Master Admin and HR Admin to grant initial passwords or help locked-out users.
 */
export async function resetPersonPassword(params: {
  personId: string;
  tempPassword?: string;
  updatePerson?: (
    personId: string,
    data: { passwordHash: string; mustChangePassword: boolean }
  ) => Promise<void>;
}): Promise<{ ok: boolean; tempPassword: string }> {
  const {
    personId,
    tempPassword = generatePreassignedPassword(),
    updatePerson,
  } = params;
  const newHash = hashPassword(tempPassword);
  const now = new Date();

  if (updatePerson) {
    await updatePerson(personId, {
      passwordHash: newHash,
      mustChangePassword: true,
    });
  } else {
    await db
      .update(schema.persons)
      .set({
        passwordHash: newHash,
        mustChangePassword: true,
        updatedAt: now,
      })
      .where(eq(schema.persons.id, personId));
  }

  return { ok: true, tempPassword };
}
