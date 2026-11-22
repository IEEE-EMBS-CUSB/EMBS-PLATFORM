"use server";

import { cookies } from "next/headers";
import {
  authenticateWithPassword,
  changeFirstLoginPassword,
  resolveLoginMembershipByEmail,
} from "@/services/auth-password.service";
import {
  createSessionForMember,
  encodeSessionToken,
} from "@/services/session.service";
import {
  LAST_CONTEXT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  buildLastContextCookieOptions,
  buildSessionCookieOptions,
} from "@/lib/session-cookie";
import { getRoleLandingPath, normalizeEmail } from "@/lib/auth-helpers";
import { sanitizeNextPath } from "@/lib/checkin-url";

export interface LoginActionResult {
  ok: boolean;
  mustChangePassword?: boolean;
  redirectTo?: string;
  error?: string;
}

export async function loginWithPasswordAction(
  email: string,
  password: string,
  nextPath?: string | null
): Promise<LoginActionResult> {
  const cookieStore = await cookies();
  const preferredMembershipId =
    cookieStore.get(LAST_CONTEXT_COOKIE_NAME)?.value ?? null;

  const result = await authenticateWithPassword({
    email,
    password,
    preferredMembershipId,
  });

  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  if (result.mustChangePassword) {
    return {
      ok: true,
      mustChangePassword: true,
    };
  }

  const sessionUser = createSessionForMember({
    id: result.member.id,
    personId: result.member.personId,
    fullName: result.member.fullName,
    role: result.member.role,
  });

  let signedToken: string;
  try {
    signedToken = encodeSessionToken(sessionUser);
  } catch (err) {
    console.error("[loginWithPasswordAction] Session signing error:", err);
    return {
      ok: false,
      error: "Authentication configuration error. Please contact your chapter administrator.",
    };
  }

  cookieStore.set(
    SESSION_COOKIE_NAME,
    signedToken,
    buildSessionCookieOptions()
  );
  cookieStore.set(
    LAST_CONTEXT_COOKIE_NAME,
    result.member.id,
    buildLastContextCookieOptions()
  );

  const safeNext = sanitizeNextPath(nextPath);

  return {
    ok: true,
    mustChangePassword: false,
    redirectTo: safeNext ?? getRoleLandingPath(result.member.role),
  };
}

export async function changePasswordOnFirstLoginAction(
  email: string,
  currentPassword: string,
  newPassword: string,
  nextPath?: string | null
): Promise<LoginActionResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  const cookieStore = await cookies();
  const preferredMembershipId =
    cookieStore.get(LAST_CONTEXT_COOKIE_NAME)?.value ?? null;

  const member = await resolveLoginMembershipByEmail(
    normalized,
    preferredMembershipId
  );
  if (!member || !member.isActive || !member.passwordHash) {
    return { ok: false, error: "Invalid email or password." };
  }

  // Verify session token signing works BEFORE mutating the password in PostgreSQL
  const preflightUser = createSessionForMember({
    id: member.id,
    personId: member.personId,
    fullName: member.fullName,
    role: member.role,
  });

  try {
    encodeSessionToken(preflightUser);
  } catch (err) {
    console.error("[changePasswordOnFirstLoginAction] Session signing error:", err);
    return {
      ok: false,
      error: "Authentication configuration error. Please contact your chapter administrator.",
    };
  }

  const changeRes = await changeFirstLoginPassword({
    currentPassword,
    newPassword,
    member: {
      id: member.id,
      personId: member.personId,
      email: member.email,
      passwordHash: member.passwordHash,
      mustChangePassword: member.mustChangePassword,
    },
  });

  if (!changeRes.ok) {
    return { ok: false, error: changeRes.reason };
  }

  // Mint the final session AFTER passwordChangedAt is recorded so issuedAt >= passwordChangedAt
  const sessionUser = createSessionForMember({
    id: member.id,
    personId: member.personId,
    fullName: member.fullName,
    role: member.role,
  });
  const signedToken = encodeSessionToken(sessionUser);

  cookieStore.set(
    SESSION_COOKIE_NAME,
    signedToken,
    buildSessionCookieOptions()
  );
  cookieStore.set(
    LAST_CONTEXT_COOKIE_NAME,
    member.id,
    buildLastContextCookieOptions()
  );

  const safeNext = sanitizeNextPath(nextPath);

  return {
    ok: true,
    mustChangePassword: false,
    redirectTo: safeNext ?? getRoleLandingPath(member.role),
  };
}
