import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import {
  buildClearLastContextCookieOptions,
  buildClearSessionCookieOptions,
  buildLastContextCookieOptions,
  buildSessionCookieOptions,
  encodeLastContextCookie,
  LAST_CONTEXT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  validateSessionAgainstDb,
} from "@/lib/session-cookie";
import {
  decodeSessionToken,
  encodeSessionToken,
  renewSessionUser,
} from "@/services/session.service";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  const decoded = decodeSessionToken(rawToken);
  if (!decoded) {
    const response = NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, "", buildClearSessionCookieOptions());
    return response;
  }

  const liveUser = await validateSessionAgainstDb(decoded);
  if (!liveUser) {
    const response = NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, "", buildClearSessionCookieOptions());
    return response;
  }

  const renewed = renewSessionUser(liveUser);
  const response = NextResponse.json(
    {
      authenticated: true,
      user: {
        displayId: renewed.displayId,
        fullName: renewed.fullName,
        participantType: renewed.participantType,
        activeMembershipId: renewed.participantId,
        activeTrackedCommitteeId: renewed.trackedCommitteeId ?? null,
        membershipRole: renewed.membershipRole,
      },
    },
    { status: 200 }
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    encodeSessionToken(renewed),
    buildSessionCookieOptions()
  );
  if (
    liveUser.participantId !== decoded.participantId ||
    (liveUser.trackedCommitteeId ?? null) !== (decoded.trackedCommitteeId ?? null)
  ) {
    response.cookies.set(
      LAST_CONTEXT_COOKIE_NAME,
      encodeLastContextCookie(
        liveUser.participantId,
        liveUser.trackedCommitteeId
      ),
      buildLastContextCookieOptions()
    );
  }
  return response;
}

export async function DELETE(request?: NextRequest) {
  if (request && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: cross-origin request rejected." },
      { status: 403 }
    );
  }
  const response = NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", buildClearSessionCookieOptions());
  response.cookies.set(
    LAST_CONTEXT_COOKIE_NAME,
    "",
    buildClearLastContextCookieOptions()
  );
  return response;
}
