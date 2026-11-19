"use server";

import { cookies } from "next/headers";
import {
  authenticateWithPassword,
  changeFirstLoginPassword,
} from "@/services/auth-password.service";
import {
  createSessionForMember,
  encodeSessionToken,
} from "@/services/session.service";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
} from "@/lib/session-cookie";
import { getRoleLandingPath } from "@/lib/auth-helpers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth-helpers";

export interface LoginActionResult {
  ok: boolean;
  mustChangePassword?: boolean;
  redirectTo?: string;
  error?: string;
}

export async function loginWithPasswordAction(
  email: string,
  password: string
): Promise<LoginActionResult> {
  const result = await authenticateWithPassword({ email, password });

  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  if (result.mustChangePassword) {
    return {
      ok: true,
      mustChangePassword: true,
    };
  }

  // Set session cookie
  const sessionUser = createSessionForMember({
    id: result.member.id,
    fullName: result.member.fullName,
    role: result.member.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    encodeSessionToken(sessionUser),
    buildSessionCookieOptions()
  );

  return {
    ok: true,
    mustChangePassword: false,
    redirectTo: getRoleLandingPath(result.member.role),
  };
}

export async function changePasswordOnFirstLoginAction(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<LoginActionResult> {
  const normalized = normalizeEmail(email);

  const rows = await db
    .select()
    .from(schema.rosterMemberships)
    .where(eq(schema.rosterMemberships.email, normalized));

  const member = rows[0];
  if (!member || !member.passwordHash) {
    return { ok: false, error: "Member profile not found." };
  }

  const changeRes = await changeFirstLoginPassword({
    currentPassword,
    newPassword,
    member: {
      id: member.id,
      email: member.email,
      passwordHash: member.passwordHash,
      mustChangePassword: member.mustChangePassword,
    },
  });

  if (!changeRes.ok) {
    return { ok: false, error: changeRes.reason };
  }

  // Set session cookie now that password has been established
  const sessionUser = createSessionForMember({
    id: member.id,
    fullName: member.fullName,
    role: member.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    encodeSessionToken(sessionUser),
    buildSessionCookieOptions()
  );

  return {
    ok: true,
    mustChangePassword: false,
    redirectTo: getRoleLandingPath(member.role),
  };
}
