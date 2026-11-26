import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/session/context/route";
import { DELETE as DELETE_SESSION } from "@/app/api/session/route";
import {
  LAST_CONTEXT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  resolveLiveSessionFromPersonState,
} from "@/lib/session-cookie";
import {
  createSessionForMember,
  decodeSessionToken,
} from "@/services/session.service";
import type { EligibleContextOption } from "@/services/context.service";
import type { SessionUser } from "@/types";

let mockSession: SessionUser | null = null;
let mockEligibleContexts: EligibleContextOption[] = [];

vi.mock("@/lib/session-cookie", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session-cookie")>();
  return {
    ...actual,
    getServerSession: vi.fn(async () => mockSession),
  };
});

vi.mock("@/services/context.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/context.service")>();
  return {
    ...actual,
    listEligibleContextsForPerson: vi.fn(async () => mockEligibleContexts),
    validateMembershipSwitch: vi.fn(
      async (
        _personId: string,
        targetMembershipId: string,
        targetTrackedCommitteeId?: string | null
      ) =>
        actual.resolveContextSwitch(
          mockEligibleContexts,
          targetMembershipId,
          targetTrackedCommitteeId
        )
    ),
  };
});

const headContext: EligibleContextOption = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  seasonId: "season-1",
  seasonName: "Fall 2026",
  seasonStatus: "active",
  role: "committee_head",
  committeeId: "comm-pr",
  committeeName: "PR",
  committeeSlug: "pr",
  managedTrackId: null,
  managedTrackName: null,
  isActive: true,
  createdAt: new Date("2026-09-01T00:00:00Z"),
};

const memberContext: EligibleContextOption = {
  membershipId: "22222222-2222-4222-8222-222222222222",
  personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  seasonId: "season-1",
  seasonName: "Fall 2026",
  seasonStatus: "active",
  role: "member",
  committeeId: "comm-ai",
  committeeName: "AI",
  committeeSlug: "ai",
  managedTrackId: null,
  managedTrackName: null,
  isActive: true,
  createdAt: new Date("2026-09-02T00:00:00Z"),
};

describe("POST/GET /api/session/context and session auto-fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockEligibleContexts = [];
  });

  it("auto-falls back to another active hat if pinned hat is deactivated, and revokes on password change or zero hats", () => {
    const issued = createSessionForMember({
      id: headContext.membershipId,
      personId: headContext.personId,
      fullName: "Salma El-Sayed",
      role: "committee_head",
    });

    // Head hat deactivated, only memberContext remains -> seamless fallback
    const fallback = resolveLiveSessionFromPersonState({
      sessionUser: issued,
      person: {
        id: headContext.personId,
        fullName: "Salma El-Sayed",
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: null,
      },
      eligibleContexts: [memberContext],
    });
    expect(fallback).not.toBeNull();
    expect(fallback?.participantId).toBe(memberContext.membershipId);
    expect(fallback?.membershipRole).toBe("member");
    expect(fallback?.sessionId).toBe(issued.sessionId);
    expect(fallback?.issuedAt).toBe(issued.issuedAt);

    // Zero active hats -> revoked
    expect(
      resolveLiveSessionFromPersonState({
        sessionUser: issued,
        person: {
          id: headContext.personId,
          fullName: "Salma El-Sayed",
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: null,
        },
        eligibleContexts: [],
      })
    ).toBeNull();

    // Password changed AFTER session issued -> revoked even with active hats
    expect(
      resolveLiveSessionFromPersonState({
        sessionUser: issued,
        person: {
          id: headContext.personId,
          fullName: "Salma El-Sayed",
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(Date.parse(issued.issuedAt) + 5000),
        },
        eligibleContexts: [headContext, memberContext],
      })
    ).toBeNull();

    // Person deactivated -> revoked
    expect(
      resolveLiveSessionFromPersonState({
        sessionUser: issued,
        person: {
          id: headContext.personId,
          fullName: "Salma El-Sayed",
          isActive: false,
          mustChangePassword: false,
          passwordChangedAt: null,
        },
        eligibleContexts: [headContext],
      })
    ).toBeNull();
  });

  it("rejects unauthenticated requests to GET and POST /api/session/context with 401", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(401);

    const postRes = await POST(
      new NextRequest("http://localhost:3000/api/session/context", {
        method: "POST",
        body: JSON.stringify({ membershipId: memberContext.membershipId }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(postRes.status).toBe(401);
  });

  it("refuses switching to a foreign membership with 403 and does not issue cookies", async () => {
    mockSession = createSessionForMember({
      id: headContext.membershipId,
      personId: headContext.personId,
      fullName: "Salma El-Sayed",
      role: "committee_head",
    });
    mockEligibleContexts = [headContext, memberContext];

    const res = await POST(
      new NextRequest("http://localhost:3000/api/session/context", {
        method: "POST",
        body: JSON.stringify({
          membershipId: "99999999-9999-4999-8999-999999999999",
        }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("re-mints signed session cookie and persists embs_last_context when switching to an owned hat", async () => {
    const initialSession = createSessionForMember({
      id: headContext.membershipId,
      personId: headContext.personId,
      fullName: "Salma El-Sayed",
      role: "committee_head",
    });
    mockSession = initialSession;
    mockEligibleContexts = [headContext, memberContext];

    const res = await POST(
      new NextRequest("http://localhost:3000/api/session/context", {
        method: "POST",
        body: JSON.stringify({ membershipId: memberContext.membershipId }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.activeMembershipId).toBe(memberContext.membershipId);
    expect(body.redirectTo).toBe("/member");

    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME)?.value;
    const lastContextCookie = res.cookies.get(LAST_CONTEXT_COOKIE_NAME)?.value;
    expect(sessionCookie).toBeDefined();
    expect(lastContextCookie).toBe(memberContext.membershipId);

    const decoded = decodeSessionToken(sessionCookie!);
    expect(decoded?.participantId).toBe(memberContext.membershipId);
    expect(decoded?.membershipRole).toBe("member");
    expect(decoded?.personId).toBe(initialSession.personId);
    expect(decoded?.sessionId).toBe(initialSession.sessionId);
    expect(decoded?.issuedAt).toBe(initialSession.issuedAt);
  });

  it("clears both session and last-context cookies on DELETE /api/session", async () => {
    const res = await DELETE_SESSION();
    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
    expect(res.cookies.get(LAST_CONTEXT_COOKIE_NAME)?.value).toBe("");
  });

  it("switches active trackedCommitteeId for an hr_member and rejects unassigned committees with 403", async () => {
    const hrMembershipId = "77777777-7777-4777-8777-777777777777";
    const hrContext = {
      ...headContext,
      membershipId: hrMembershipId,
      role: "hr_member" as const,
      committeeId: "comm-hr",
      committeeName: "Human Resources",
      committeeSlug: "human-resources",
      trackedCommitteeId: "comm-ai",
      trackedCommitteeName: "AI & ML",
      trackedCommittees: [
        { id: "comm-ai", name: "AI & ML" },
        { id: "comm-robotics", name: "Robotics" },
      ],
    };
    const initialSession = createSessionForMember({
      id: hrMembershipId,
      personId: hrContext.personId,
      fullName: "Nourhan HR",
      role: "hr_member",
      trackedCommitteeId: "comm-ai",
    });
    mockSession = initialSession;
    mockEligibleContexts = [hrContext];

    // Switch to assigned second tracked committee succeeds
    const okRes = await POST(
      new NextRequest("http://localhost:3000/api/session/context", {
        method: "POST",
        body: JSON.stringify({
          membershipId: hrMembershipId,
          view: "manage",
          trackedCommitteeId: "comm-robotics",
        }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(okRes.status).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.ok).toBe(true);
    expect(okBody.activeTrackedCommitteeId).toBe("comm-robotics");
    expect(okBody.redirectTo).toBe("/hr");

    const decoded = decodeSessionToken(
      okRes.cookies.get(SESSION_COOKIE_NAME)!.value
    );
    expect(decoded?.participantId).toBe(hrMembershipId);
    expect(decoded?.trackedCommitteeId).toBe("comm-robotics");
    expect(okRes.cookies.get(LAST_CONTEXT_COOKIE_NAME)?.value).toBe(
      `${hrMembershipId}:comm-robotics`
    );

    // Switch to unassigned committee is rejected with 403
    const badRes = await POST(
      new NextRequest("http://localhost:3000/api/session/context", {
        method: "POST",
        body: JSON.stringify({
          membershipId: hrMembershipId,
          view: "manage",
          trackedCommitteeId: "comm-unauthorized",
        }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(badRes.status).toBe(403);
  });
});
