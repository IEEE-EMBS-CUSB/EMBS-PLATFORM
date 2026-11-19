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
import type { SessionUser } from "@/types";

const AUTH_PAGES = new Set([
  "/login",
  "/access",
  "/member/access",
  "/attendee/access",
]);

function getLandingDestination(sessionUser: SessionUser): string {
  if (sessionUser.participantType === "attendee") {
    return "/attendee";
  }
  if (
    sessionUser.membershipRole === "director" ||
    sessionUser.membershipRole === "master_admin"
  ) {
    return "/hr";
  }
  return "/member";
}

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

function isHrPortalPath(pathname: string): boolean {
  return pathname === "/hr" || pathname.startsWith("/hr/");
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

  // If visiting login/access page while already authenticated, redirect to portal
  if (AUTH_PAGES.has(pathname)) {
    if (sessionUser) {
      const destination = getLandingDestination(sessionUser);
      return attachSessionCookie(
        NextResponse.redirect(new URL(destination, request.url))
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  // Member Portal Guard
  if (isMemberPortalPath(pathname)) {
    if (!sessionUser) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/login", request.url))
      );
    }
    if (sessionUser.participantType !== "member") {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/attendee", request.url))
      );
    }
    if (
      sessionUser.membershipRole === "director" ||
      sessionUser.membershipRole === "master_admin"
    ) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/hr", request.url))
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  // Attendee Portal Guard
  if (isAttendeePortalPath(pathname)) {
    if (!sessionUser) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/login", request.url))
      );
    }
    if (sessionUser.participantType !== "attendee") {
      return attachSessionCookie(
        NextResponse.redirect(
          new URL(getLandingDestination(sessionUser), request.url)
        )
      );
    }
    return attachSessionCookie(NextResponse.next());
  }

  // HR Portal Guard
  if (isHrPortalPath(pathname)) {
    if (!sessionUser) {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/login", request.url))
      );
    }
    if (sessionUser.participantType !== "member") {
      return attachSessionCookie(
        NextResponse.redirect(new URL("/attendee", request.url))
      );
    }
    if (sessionUser.membershipRole === "member") {
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
    "/login",
    "/access",
    "/leaderboards/:path*",
    "/member/:path*",
    "/attendee/:path*",
    "/hr/:path*",
  ],
};
