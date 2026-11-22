import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  decodeSessionToken,
  SESSION_DURATION_SECONDS,
} from "@/services/session.service";
import {
  listEligibleContextsForPerson,
  type EligibleContextOption,
} from "@/services/context.service";
import type { SessionUser } from "@/types";
import type { MembershipRole } from "@/lib/auth-helpers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "embs_portal_session";
export const LAST_CONTEXT_COOKIE_NAME = "embs_last_context";

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function buildSessionCookieOptions(
  secure: boolean = isProductionEnv()
): Omit<ResponseCookie, "name" | "value"> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function buildClearSessionCookieOptions(
  secure: boolean = isProductionEnv()
): Omit<ResponseCookie, "name" | "value"> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  };
}

export function buildLastContextCookieOptions(
  secure: boolean = isProductionEnv()
): Omit<ResponseCookie, "name" | "value"> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function buildClearLastContextCookieOptions(
  secure: boolean = isProductionEnv()
): Omit<ResponseCookie, "name" | "value"> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  };
}

export interface LivePersonRecord {
  id: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
}

/**
 * Pure resolution of live session state from a person's DB record and eligible season contexts.
 * - Revokes if person is inactive, mustChangePassword is true, password changed after issuedAt,
 *   or zero eligible memberships remain.
 * - Preserves the pinned `participantId` if still active & eligible; otherwise seamlessly
 *   auto-falls back to the highest-precedence remaining active hat in the same eligible season.
 */
export function resolveLiveSessionFromPersonState(input: {
  sessionUser: SessionUser;
  person: LivePersonRecord | null;
  eligibleContexts: readonly EligibleContextOption[];
}): SessionUser | null {
  const { sessionUser, person, eligibleContexts } = input;
  if (!person || !person.isActive || person.mustChangePassword) {
    return null;
  }

  const issuedAtMs = Date.parse(sessionUser.issuedAt);
  if (
    person.passwordChangedAt &&
    !Number.isNaN(issuedAtMs) &&
    person.passwordChangedAt.getTime() > issuedAtMs
  ) {
    return null;
  }

  if (eligibleContexts.length === 0) {
    return null;
  }

  const activeContext =
    eligibleContexts.find((c) => c.membershipId === sessionUser.participantId) ??
    eligibleContexts[0];

  const participantType =
    activeContext.role === "attendee" ? "attendee" : "member";

  return {
    ...sessionUser,
    personId: person.id,
    participantId: activeContext.membershipId,
    displayId: activeContext.membershipId.slice(0, 8),
    fullName: person.fullName,
    participantType,
    membershipRole: activeContext.role as MembershipRole,
  };
}

/**
 * Verifies a decoded session against live persons + roster_memberships + seasons state.
 * Revokes deactivated accounts, password-reset-pending, password-changed-after-issue,
 * or zero-active-membership sessions. Auto-falls back if only the pinned hat was deactivated
 * while another active hat remains in the same eligible season.
 */
export async function validateSessionAgainstDb(
  sessionUser: SessionUser
): Promise<SessionUser | null> {
  try {
    const [person] = await db
      .select({
        id: schema.persons.id,
        fullName: schema.persons.fullName,
        isActive: schema.persons.isActive,
        mustChangePassword: schema.persons.mustChangePassword,
        passwordChangedAt: schema.persons.passwordChangedAt,
      })
      .from(schema.persons)
      .where(eq(schema.persons.id, sessionUser.personId))
      .limit(1);

    if (!person || !person.isActive || person.mustChangePassword) {
      return null;
    }

    const eligibleContexts = await listEligibleContextsForPerson(person.id);

    return resolveLiveSessionFromPersonState({
      sessionUser,
      person,
      eligibleContexts,
    });
  } catch {
    return null;
  }
}

/**
 * Reads and validates the active session cookie in Server Components and Route Handlers.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  try {
    await connection();
  } catch {
    // Outside request scope (e.g. tests or build). Fall through to cookie access if possible.
  }
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return null;
    const sessionUser = decodeSessionToken(rawToken, new Date());
    if (!sessionUser) return null;

    return await validateSessionAgainstDb(sessionUser);
  } catch {
    return null;
  }
}
