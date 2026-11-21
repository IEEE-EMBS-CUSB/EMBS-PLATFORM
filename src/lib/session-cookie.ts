import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  decodeSessionToken,
  SESSION_DURATION_SECONDS,
} from "@/services/session.service";
import type { SessionUser } from "@/types";
import type { MembershipRole } from "@/lib/auth-helpers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "embs_portal_session";

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

/**
 * Verifies a decoded session against live roster_memberships + seasons state.
 * Revokes deactivated, password-reset-pending, missing, or draft-season sessions,
 * and refreshes live role/name claims from PostgreSQL so demotions take effect immediately.
 */
export async function validateSessionAgainstDb(
  sessionUser: SessionUser
): Promise<SessionUser | null> {
  try {
    const rows = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.rosterMemberships.fullName,
        role: schema.rosterMemberships.role,
        isActive: schema.rosterMemberships.isActive,
        mustChangePassword: schema.rosterMemberships.mustChangePassword,
        seasonStatus: schema.seasons.status,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.seasons,
        eq(schema.rosterMemberships.seasonId, schema.seasons.id)
      )
      .where(
        and(
          eq(schema.rosterMemberships.id, sessionUser.participantId),
          eq(schema.rosterMemberships.isActive, true),
          eq(schema.rosterMemberships.mustChangePassword, false),
          ne(schema.seasons.status, "draft")
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const member = rows[0];
    const participantType = member.role === "attendee" ? "attendee" : "member";

    return {
      ...sessionUser,
      fullName: member.fullName,
      participantType,
      membershipRole: member.role as MembershipRole,
    };
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
