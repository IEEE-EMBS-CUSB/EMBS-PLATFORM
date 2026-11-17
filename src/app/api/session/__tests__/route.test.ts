import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/session/route";
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import {
  encodeSessionToken,
  SESSION_DURATION_SECONDS,
  verifyAccessKey,
} from "@/services/session.service";

function makeJsonRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/session route handler", () => {
  it("configures HttpOnly, SameSite=Lax, 30-day Max-Age, and Secure in production", () => {
    const prodOptions = buildSessionCookieOptions(true);
    expect(prodOptions.httpOnly).toBe(true);
    expect(prodOptions.sameSite).toBe("lax");
    expect(prodOptions.secure).toBe(true);
    expect(prodOptions.path).toBe("/");
    expect(prodOptions.maxAge).toBe(SESSION_DURATION_SECONDS);

    const devOptions = buildSessionCookieOptions(false);
    expect(devOptions.httpOnly).toBe(true);
    expect(devOptions.secure).toBe(false);
  });

  it("sets an HttpOnly session cookie for a valid member key without exposing the raw key", async () => {
    const rawKey = "EMBS-MEM-2026-SALMA";
    const response = await POST(makeJsonRequest({ accessKey: rawKey }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.participantType).toBe("member");
    expect(data.redirectTo).toBe("/member");
    expect(JSON.stringify(data)).not.toContain(rawKey);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain(`Max-Age=${SESSION_DURATION_SECONDS}`);
    expect(setCookie).not.toContain(rawKey);
  });

  it("routes a valid attendee key automatically to /attendee", async () => {
    const response = await POST(
      makeJsonRequest({ accessKey: "EMBS-ATT-2026-MARIAM" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.participantType).toBe("attendee");
    expect(data.redirectTo).toBe("/attendee");
  });

  it("rejects revoked and empty keys without issuing a session cookie", async () => {
    const revokedRes = await POST(
      makeJsonRequest({ accessKey: "EMBS-MEM-2026-REVOKED" })
    );
    const revokedBody = await revokedRes.json();
    expect(revokedRes.status).toBe(401);
    expect(revokedBody.ok).toBe(false);
    expect(revokedBody.code).toBe("REVOKED_KEY");
    expect(revokedRes.headers.get("set-cookie")).toBeNull();

    const emptyRes = await POST(makeJsonRequest({ accessKey: "  " }));
    const emptyBody = await emptyRes.json();
    expect(emptyRes.status).toBe(400);
    expect(emptyBody.code).toBe("EMPTY_KEY");
  });

  it("returns authenticated session metadata and renews the sliding cookie on GET", async () => {
    const verified = await verifyAccessKey("EMBS-MEM-2026-SALMA");
    if (!verified.ok) throw new Error("Expected mock key to verify");

    const token = encodeSessionToken(verified.user);
    const request = new NextRequest("http://localhost:3000/api/session", {
      method: "GET",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(data.user.displayId).toBe("M001");
    expect(response.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );
  });

  it("clears invalid or revoked session cookies on GET and clears active sessions on DELETE", async () => {
    const staleReq = new NextRequest("http://localhost:3000/api/session", {
      method: "GET",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=invalid-token`,
      },
    });
    const staleRes = await GET(staleReq);
    const staleData = await staleRes.json();

    expect(staleData.authenticated).toBe(false);
    expect(staleRes.headers.get("set-cookie")).toContain("Max-Age=0");

    const logoutRes = await DELETE();
    const logoutData = await logoutRes.json();
    expect(logoutRes.status).toBe(200);
    expect(logoutData.ok).toBe(true);
    expect(logoutRes.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
