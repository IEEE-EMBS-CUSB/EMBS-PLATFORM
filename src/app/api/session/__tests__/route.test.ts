import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET } from "@/app/api/session/route";
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import {
  createSessionForMember,
  encodeSessionToken,
  SESSION_DURATION_SECONDS,
} from "@/services/session.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";

function makeRequest(method: string, cookie?: string) {
  return new NextRequest("http://localhost:3000/api/session", {
    method,
    headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
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

  it("returns authenticated session metadata for an active DB member and renews the sliding cookie on GET", async () => {
    const [activeMember] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.isActive, true),
          eq(schema.rosterMemberships.mustChangePassword, false)
        )
      )
      .limit(1);

    expect(activeMember).toBeDefined();

    const sessionUser = createSessionForMember({
      id: activeMember.id,
      fullName: activeMember.fullName,
      role: activeMember.role,
    });
    const token = encodeSessionToken(sessionUser);

    const response = await GET(makeRequest("GET", token));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(data.user.fullName).toBe(activeMember.fullName);
    expect(response.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );
  });

  it("clears forged, invalid, or nonexistent-member session cookies on GET and clears active sessions on DELETE", async () => {
    const staleRes = await GET(makeRequest("GET", "invalid-token"));
    const staleData = await staleRes.json();
    expect(staleData.authenticated).toBe(false);
    expect(staleRes.headers.get("set-cookie")).toContain("Max-Age=0");

    // Signed token for a participant UUID not in DB must also be rejected and cleared
    const ghostToken = encodeSessionToken(
      createSessionForMember({
        id: "00000000-0000-4000-8000-000000000000",
        fullName: "Ghost User",
        role: "master_admin",
      })
    );
    const ghostRes = await GET(makeRequest("GET", ghostToken));
    const ghostData = await ghostRes.json();
    expect(ghostData.authenticated).toBe(false);
    expect(ghostRes.headers.get("set-cookie")).toContain("Max-Age=0");

    const logoutRes = await DELETE();
    const logoutData = await logoutRes.json();
    expect(logoutData.ok).toBe(true);
    expect(logoutRes.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
