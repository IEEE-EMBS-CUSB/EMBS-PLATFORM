import { NextRequest, NextResponse } from "next/server";
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import {
  decodeSessionToken,
  encodeSessionToken,
  renewSessionUser,
} from "@/services/session.service";

const ACCESS_PATHS = new Set(["/access", "/member/access", "/attendee/access"]);

function isMemberPortalPath(pathname: string): boolean {
  return (
    (pathname === "/member" || pathname.startsWith("/member/")) &&
    pathname !== "/member/access"
  );
}

function isAttendeePortalPath(pathname: string): boolean {
  return (
    (pathname === "/attendee" || pathname.startsWith("/attendee/")) &&
    pathname !== "/attendee/access"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionUser = rawToken ? decodeSessionToken(rawToken) : null;

  const attachSessionCookie = (response: NextResponse) => {
    if (sessionUser) {
      const renewed = renewSessionUser(sessionUser);
      response.cookies.set(
        SESSION_COOKIE_NAME,
        encodeSessionToken(renewed),
        buildSessionCookieOptions()
      );
    } else if (rawToken) {
      response.cookies.set(
        SESSION_COOKIE_NAME,
        "",
        buildClearSessionCookieOptions()
      );
    }
    return response;
  };

  if (ACCESS_PATHS.has(pathname)) {
    if (sessionUser) {
      const destination =
        sessionUser.participantType === "member" ? "/member" : "/attendee";
      return attachSessionCookie(
        NextResponse.redirect(new URL(destination, request.url))
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  if (isMemberPortalPath(pathname)) {
    if (!sessionUser) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/member/access", request.url))
      );
    }
    if (sessionUser.participantType !== "member") {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/attendee", request.url))
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  if (isAttendeePortalPath(pathname)) {
    if (!sessionUser) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/attendee/access", request.url))
      );
    }
    if (sessionUser.participantType !== "attendee") {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/member", request.url))
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  return attachSessionCookie(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/access",
    "/leaderboards/:path*",
    "/member/:path*",
    "/attendee/:path*",
  ],
};
