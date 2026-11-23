import type { NextRequest } from "next/server";

/**
 * Verifies that a browser-sent `Origin` header matches the request's host/origin.
 * Blocks cross-site state-changing API requests (CSRF defense-in-depth alongside SameSite=Lax).
 * Requests without an `Origin` header (non-browser callers, same-origin GETs, tests) are allowed.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return true;
  }

  try {
    const originUrl = new URL(originHeader);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const hostHeader = forwardedHost || request.headers.get("host")?.trim();

    if (hostHeader) {
      return originUrl.host.toLowerCase() === hostHeader.toLowerCase();
    }

    return originUrl.origin.toLowerCase() === request.nextUrl.origin.toLowerCase();
  } catch {
    return false;
  }
}
