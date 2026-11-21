import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import {
  hashPassword,
  verifyPassword,
  generatePreassignedPassword,
  isPasswordStrong,
} from "@/lib/password";

export interface AuthenticatedMemberResult {
  id: string;
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
  email: string;
  fullName: string;
  role: MembershipRole;
  committeeId?: string | null;
  passwordHash?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

const GENERIC_AUTH_FAILURE = "Invalid email or password.";

/**
 * Resolves a roster membership for authentication by normalized email.
 * Precedence: active season membership -> active membership in an archived season.
 * Draft-season memberships are never permitted to authenticate.
 */
export async function resolveLoginMembershipByEmail(
  normalizedEmail: string
): Promise<RosterMemberLookupRecord | null> {
  const memberships = await db
    .select()
    .from(schema.rosterMemberships)
    .where(eq(schema.rosterMemberships.email, normalizedEmail));

  if (memberships.length === 0) return null;

  const seasons = await db.select().from(schema.seasons);
  const seasonMap = new Map(seasons.map((s) => [s.id, s]));

  const active = memberships.find(
    (m) => seasonMap.get(m.seasonId)?.status === "active"
  );
  const archived = memberships.find(
    (m) => seasonMap.get(m.seasonId)?.status === "archived" && m.isActive
  );

  return (active ?? archived) ?? null;
}

/**
 * Authenticates a user using their whitelisted email and password.
 * Checks active roster whitelist, verifies scrypt hash, and reports if first-login reset is required.
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
        reason: "Authentication service is temporarily unavailable. Please try again.",
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
 * Verifies current password, checks strength of new password, and updates hash with mustChangePassword = false.
 */
export async function changeFirstLoginPassword(params: {
  currentPassword: string;
  newPassword: string;
  member: {
    id: string;
    email: string;
    passwordHash: string;
    mustChangePassword: boolean;
  };
  updateMember?: (
    id: string,
    data: { passwordHash: string; mustChangePassword: boolean; passwordChangedAt: Date }
  ) => Promise<void>;
}): Promise<{ ok: boolean; reason?: string }> {
  const { currentPassword, newPassword, member, updateMember } = params;

  if (!member.mustChangePassword) {
    return {
      ok: false,
      reason: "Password change is not required for this account. Please sign in normally.",
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
      reason: "New password must be different from your pre-assigned temporary password.",
    };
  }

  const newHash = hashPassword(newPassword);
  const now = new Date();

  if (updateMember) {
    await updateMember(member.id, {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordChangedAt: now,
    });
  } else {
    await db
      .update(schema.rosterMemberships)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: now,
      })
      .where(eq(schema.rosterMemberships.id, member.id));
  }

  return { ok: true };
}

/**
 * Resets a member's password and sets mustChangePassword = true.
 * Used by Master Admin and HR Admin to grant initial passwords or help locked out members.
 */
export async function resetMemberPassword(params: {
  memberId: string;
  tempPassword?: string;
  updateMember?: (
    id: string,
    data: { passwordHash: string; mustChangePassword: boolean }
  ) => Promise<void>;
}): Promise<{ ok: boolean; tempPassword: string }> {
  const { memberId, tempPassword = generatePreassignedPassword(), updateMember } = params;
  const newHash = hashPassword(tempPassword);

  if (updateMember) {
    await updateMember(memberId, {
      passwordHash: newHash,
      mustChangePassword: true,
    });
  } else {
    await db
      .update(schema.rosterMemberships)
      .set({
        passwordHash: newHash,
        mustChangePassword: true,
      })
      .where(eq(schema.rosterMemberships.id, memberId));
  }

  return { ok: true, tempPassword };
}
