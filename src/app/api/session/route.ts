import { NextRequest, NextResponse } from "next/server";
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
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
      },
    },
    { status: 200 }
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    encodeSessionToken(renewed),
    buildSessionCookieOptions()
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", buildClearSessionCookieOptions());
  return response;
}
