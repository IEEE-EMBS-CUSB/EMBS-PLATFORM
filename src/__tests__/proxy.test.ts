import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import {
  createSessionForMember,
  encodeSessionToken,
  SESSION_DURATION_SECONDS,
  verifyAccessKey,
} from "@/services/session.service";

async function makeToken(accessKey: string) {
  const verified = await verifyAccessKey(accessKey);
  if (!verified.ok) throw new Error(`Failed to verify ${accessKey}`);
  return encodeSessionToken(verified.user);
}

describe("Next.js session proxy", () => {
  it("redirects returning authenticated users away from /login straight to their dashboard", async () => {
    const memberToken = await makeToken("EMBS-MEM-2026-SALMA");
    const memberReq = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const memberRes = proxy(memberReq);
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe(
      "http://localhost:3000/member"
    );
    expect(memberRes.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );

    const attendeeToken = await makeToken("EMBS-ATT-2026-MARIAM");
    const attendeeReq = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
    });
    const attendeeRes = proxy(attendeeReq);
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe(
      "http://localhost:3000/attendee"
    );
  });

  it("redirects unauthenticated visitors on protected portals to /login", () => {
    const memberRes = proxy(
      new NextRequest("http://localhost:3000/member/performance")
    );
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );

    const attendeeRes = proxy(
      new NextRequest("http://localhost:3000/attendee/assignments")
    );
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );

    const hrRes = proxy(
      new NextRequest("http://localhost:3000/hr")
    );
    expect(hrRes.status).toBe(307);
    expect(hrRes.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );
  });

  it("enforces member/attendee portal isolation by redirecting cross-role access", async () => {
    const attendeeToken = await makeToken("EMBS-ATT-2026-MARIAM");
    const crossMemberReq = new NextRequest(
      "http://localhost:3000/member/tasks",
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
      }
    );
    const crossMemberRes = proxy(crossMemberReq);
    expect(crossMemberRes.status).toBe(307);
    expect(crossMemberRes.headers.get("location")).toBe(
      "http://localhost:3000/attendee"
    );

    const crossHrReq = new NextRequest(
      "http://localhost:3000/hr",
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
      }
    );
    const crossHrRes = proxy(crossHrReq);
    expect(crossHrRes.status).toBe(307);
    expect(crossHrRes.headers.get("location")).toBe(
      "http://localhost:3000/attendee"
    );

    const memberToken = await makeToken("EMBS-MEM-2026-SALMA");
    const crossAttendeeReq = new NextRequest(
      "http://localhost:3000/attendee/assignments",
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      }
    );
    const crossAttendeeRes = proxy(crossAttendeeReq);
    expect(crossAttendeeRes.status).toBe(307);
    expect(crossAttendeeRes.headers.get("location")).toBe(
      "http://localhost:3000/member"
    );
  });

  it("allows authenticated visits and renews the sliding session cookie", async () => {
    const memberToken = await makeToken("EMBS-MEM-2026-SALMA");
    const req = new NextRequest("http://localhost:3000/member", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );
  });

  it("redirects chapter leadership (director and master_admin) directly to /hr from /member and /login", () => {
    const directorSession = createSessionForMember({
      id: "dir-1",
      fullName: "Khaled Mansour",
      role: "director",
    });
    const directorToken = encodeSessionToken(directorSession);

    // Accessing /member should redirect directly to /hr
    const memberReq = new NextRequest("http://localhost:3000/member", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
    });
    const memberRes = proxy(memberReq);
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe("http://localhost:3000/hr");

    // Accessing /login should redirect directly to /hr
    const loginReq = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
    });
    const loginRes = proxy(loginReq);
    expect(loginRes.status).toBe(307);
    expect(loginRes.headers.get("location")).toBe("http://localhost:3000/hr");

    // Accessing /hr should be permitted (status 200)
    const hrReq = new NextRequest("http://localhost:3000/hr", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
    });
    const hrRes = proxy(hrReq);
    expect(hrRes.status).toBe(200);
  });

  it("redirects regular members attempting to visit /hr back to /member", () => {
    const memberSession = createSessionForMember({
      id: "mem-1",
      fullName: "Omar Tarek",
      role: "member",
    });
    const memberToken = encodeSessionToken(memberSession);

    const hrReq = new NextRequest("http://localhost:3000/hr", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const hrRes = proxy(hrReq);
    expect(hrRes.status).toBe(307);
    expect(hrRes.headers.get("location")).toBe("http://localhost:3000/member");
  });
});
