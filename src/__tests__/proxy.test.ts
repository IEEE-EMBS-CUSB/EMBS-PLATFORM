import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import {
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
  it("redirects returning authenticated users away from /access straight to their dashboard", async () => {
    const memberToken = await makeToken("EMBS-MEM-2026-SALMA");
    const memberReq = new NextRequest("http://localhost:3000/access", {
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
    const attendeeReq = new NextRequest("http://localhost:3000/member/access", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
    });
    const attendeeRes = proxy(attendeeReq);
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe(
      "http://localhost:3000/attendee"
    );
  });

  it("redirects unauthenticated visitors on protected portals to their access page", () => {
    const memberRes = proxy(
      new NextRequest("http://localhost:3000/member/performance")
    );
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe(
      "http://localhost:3000/member/access"
    );

    const attendeeRes = proxy(
      new NextRequest("http://localhost:3000/attendee/assignments")
    );
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe(
      "http://localhost:3000/attendee/access"
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
});
