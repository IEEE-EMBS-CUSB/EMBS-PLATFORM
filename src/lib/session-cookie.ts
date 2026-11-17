import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  decodeSessionToken,
  SESSION_DURATION_SECONDS,
} from "@/services/session.service";
import type { SessionUser } from "@/types";

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
 * Reads and validates the active session cookie in Server Components and Route Handlers.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  await connection();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;
  return decodeSessionToken(rawToken, new Date());
}
