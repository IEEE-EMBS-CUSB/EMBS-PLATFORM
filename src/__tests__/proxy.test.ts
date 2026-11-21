import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import {
  createSessionForMember,
  encodeSessionToken,
  SESSION_DURATION_SECONDS,
} from "@/services/session.service";

function makeMemberToken(role: string = "member", id = "mem-1") {
  const session = createSessionForMember({
    id,
    fullName: "Test User",
    role,
  });
  return encodeSessionToken(session);
}

describe("Next.js session proxy", () => {
  it("redirects returning authenticated users away from /login straight to their dashboard", () => {
    const memberToken = makeMemberToken("member", "mem-101");
    const memberReq = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const memberRes = proxy(memberReq);
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe("http://localhost:3000/member");
    expect(memberRes.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );

    const attendeeToken = makeMemberToken("attendee", "att-201");
    const attendeeReq = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
    });
    const attendeeRes = proxy(attendeeReq);
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe("http://localhost:3000/attendee");
  });

  it("clears cookie and allows /login?session=invalid to render without redirecting in a loop", () => {
    const memberToken = makeMemberToken("member", "mem-101");
    const req = new NextRequest("http://localhost:3000/login?session=invalid", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects and clears forged unsigned cookies on protected portals", () => {
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sid: "forged",
        pid: "admin-1",
        did: "admin",
        name: "Attacker",
        role: "member",
        mrole: "master_admin",
        kv: 1,
        iat: new Date().toISOString(),
        exp: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      "utf8"
    ).toString("base64url");

    const res = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${forgedPayload}` },
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("redirects unauthenticated visitors on protected portals to /login", () => {
    const memberRes = proxy(
      new NextRequest("http://localhost:3000/member/performance")
    );
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe("http://localhost:3000/login");

    const attendeeRes = proxy(
      new NextRequest("http://localhost:3000/attendee/assignments")
    );
    expect(attendeeRes.status).toBe(307);
    expect(attendeeRes.headers.get("location")).toBe("http://localhost:3000/login");

    const hrRes = proxy(new NextRequest("http://localhost:3000/hr"));
    expect(hrRes.status).toBe(307);
    expect(hrRes.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("enforces member/attendee portal isolation by redirecting cross-role access", () => {
    const attendeeToken = makeMemberToken("attendee", "att-201");
    const crossMemberRes = proxy(
      new NextRequest("http://localhost:3000/member/tasks", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
      })
    );
    expect(crossMemberRes.status).toBe(307);
    expect(crossMemberRes.headers.get("location")).toBe("http://localhost:3000/attendee");

    const crossHrRes = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${attendeeToken}` },
      })
    );
    expect(crossHrRes.status).toBe(307);
    expect(crossHrRes.headers.get("location")).toBe("http://localhost:3000/attendee");

    const memberToken = makeMemberToken("member", "mem-101");
    const crossAttendeeRes = proxy(
      new NextRequest("http://localhost:3000/attendee/assignments", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    expect(crossAttendeeRes.status).toBe(307);
    expect(crossAttendeeRes.headers.get("location")).toBe("http://localhost:3000/member");
  });

  it("allows authenticated visits and renews the sliding session cookie", () => {
    const memberToken = makeMemberToken("member", "mem-101");
    const res = proxy(
      new NextRequest("http://localhost:3000/member", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(
      `Max-Age=${SESSION_DURATION_SECONDS}`
    );
  });

  it("redirects operational roles directly to /hr from /member and /login", () => {
    const directorToken = makeMemberToken("director", "dir-1");

    const memberRes = proxy(
      new NextRequest("http://localhost:3000/member", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
      })
    );
    expect(memberRes.status).toBe(307);
    expect(memberRes.headers.get("location")).toBe("http://localhost:3000/hr");

    const loginRes = proxy(
      new NextRequest("http://localhost:3000/login", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
      })
    );
    expect(loginRes.status).toBe(307);
    expect(loginRes.headers.get("location")).toBe("http://localhost:3000/hr");

    const hrRes = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${directorToken}` },
      })
    );
    expect(hrRes.status).toBe(200);
  });

  it("allows committee_head to switch between /hr (leader view) and /member (member view)", () => {
    const headToken = makeMemberToken("committee_head", "head-1");

    // Default landing from /login remains /hr
    const loginRes = proxy(
      new NextRequest("http://localhost:3000/login", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${headToken}` },
      })
    );
    expect(loginRes.status).toBe(307);
    expect(loginRes.headers.get("location")).toBe("http://localhost:3000/hr");

    // Can access /hr
    const hrRes = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${headToken}` },
      })
    );
    expect(hrRes.status).toBe(200);

    // Can ALSO switch into /member and /member/tasks to see assignments given to heads
    const memberRes = proxy(
      new NextRequest("http://localhost:3000/member/tasks", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${headToken}` },
      })
    );
    expect(memberRes.status).toBe(200);
    expect(memberRes.headers.get("location")).toBeNull();
  });

  it("fails closed on /hr when membershipRole is member or undefined", () => {
    const memberToken = makeMemberToken("member", "mem-1");
    const hrRes = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    expect(hrRes.status).toBe(307);
    expect(hrRes.headers.get("location")).toBe("http://localhost:3000/member");

    // Token with undefined membershipRole must ALSO be blocked from /hr
    const noRoleToken = encodeSessionToken({
      sessionId: "sess-no-role",
      participantId: "mem-no-role",
      displayId: "M999",
      fullName: "No Role",
      participantType: "member",
      keyVersion: 1,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const noRoleHrRes = proxy(
      new NextRequest("http://localhost:3000/hr", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${noRoleToken}` },
      })
    );
    expect(noRoleHrRes.status).toBe(307);
    expect(noRoleHrRes.headers.get("location")).toBe("http://localhost:3000/member");
  });
});
