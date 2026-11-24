"use server";

import { cookies, headers } from "next/headers";
import {
  authenticateWithPassword,
  changeFirstLoginPassword,
  resolveLoginMembershipByIdentifier,
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
import { getRoleLandingPath } from "@/lib/auth-helpers";
import { parseLoginIdentifier } from "@/lib/phone";
import { sanitizeNextPath } from "@/lib/checkin-url";
import {
  checkRateLimit,
  clearRateLimit,
  extractClientIp,
  formatRateLimitMessage,
  RATE_LIMIT_POLICIES,
  recordRateLimitFailure,
} from "@/lib/rate-limit";

async function getSafeRequestIp(): Promise<string> {
  try {
    const hdrs = await headers();
    return extractClientIp((name) => hdrs.get(name));
  } catch {
    return "unknown";
  }
}

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
  const parsed = parseLoginIdentifier(email);
  const clientIp = await getSafeRequestIp();
  const ipKey = `login:ip:${clientIp}`;
  const identifierKey = parsed ? `login:email:${parsed.value}` : null;

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(ipKey, RATE_LIMIT_POLICIES.loginIp),
    identifierKey
      ? checkRateLimit(identifierKey, RATE_LIMIT_POLICIES.loginEmail)
      : Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
  ]);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(
      ipLimit.retryAfterSeconds,
      emailLimit.retryAfterSeconds
    );
    return {
      ok: false,
      error: formatRateLimitMessage(retryAfter, "sign-in"),
    };
  }

  const cookieStore = await cookies();
  const preferredMembershipId =
    cookieStore.get(LAST_CONTEXT_COOKIE_NAME)?.value ?? null;

  const result = await authenticateWithPassword({
    email,
    password,
    preferredMembershipId,
  });

  if (!result.ok) {
    await Promise.all([
      recordRateLimitFailure(ipKey, RATE_LIMIT_POLICIES.loginIp),
      identifierKey
        ? recordRateLimitFailure(identifierKey, RATE_LIMIT_POLICIES.loginEmail)
        : Promise.resolve(),
    ]);
    return { ok: false, error: result.reason };
  }

  if (identifierKey) {
    await clearRateLimit(identifierKey);
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
  const parsed = parseLoginIdentifier(email);
  if (!parsed) {
    return {
      ok: false,
      error: "Please provide a valid email address or phone number.",
    };
  }

  const clientIp = await getSafeRequestIp();
  const ipKey = `login:ip:${clientIp}`;
  const emailKey = `login:email:${parsed.value}`;
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(ipKey, RATE_LIMIT_POLICIES.loginIp),
    checkRateLimit(emailKey, RATE_LIMIT_POLICIES.loginEmail),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(
      ipLimit.retryAfterSeconds,
      emailLimit.retryAfterSeconds
    );
    return {
      ok: false,
      error: formatRateLimitMessage(retryAfter, "password setup"),
    };
  }

  const cookieStore = await cookies();
  const preferredMembershipId =
    cookieStore.get(LAST_CONTEXT_COOKIE_NAME)?.value ?? null;

  const member = await resolveLoginMembershipByIdentifier(
    parsed.value,
    preferredMembershipId
  );
  if (!member || !member.isActive || !member.passwordHash) {
    await Promise.all([
      recordRateLimitFailure(ipKey, RATE_LIMIT_POLICIES.loginIp),
      recordRateLimitFailure(emailKey, RATE_LIMIT_POLICIES.loginEmail),
    ]);
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
    await Promise.all([
      recordRateLimitFailure(ipKey, RATE_LIMIT_POLICIES.loginIp),
      recordRateLimitFailure(emailKey, RATE_LIMIT_POLICIES.loginEmail),
    ]);
    return { ok: false, error: changeRes.reason };
  }

  await clearRateLimit(emailKey);

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
