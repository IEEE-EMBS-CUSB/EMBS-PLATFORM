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
  verifyAccessKey,
} from "@/services/session.service";

export async function POST(request: NextRequest) {
  let rawKey = "";

  try {
    const body = (await request.json()) as { accessKey?: unknown };
    if (typeof body?.accessKey === "string") {
      rawKey = body.accessKey;
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "EMPTY_KEY",
        message: "Enter the access key provided by HR to continue.",
      },
      { status: 400 }
    );
  }

  const verification = await verifyAccessKey(rawKey);

  if (!verification.ok) {
    const status = verification.code === "EMPTY_KEY" ? 400 : 401;
    return NextResponse.json(
      {
        ok: false,
        code: verification.code,
        message: verification.message,
      },
      { status }
    );
  }

  const sessionToken = encodeSessionToken(verification.user);
  const response = NextResponse.json(
    {
      ok: true,
      participantType: verification.user.participantType,
      redirectTo: verification.redirectTo,
      user: {
        displayId: verification.user.displayId,
        fullName: verification.user.fullName,
        participantType: verification.user.participantType,
      },
    },
    { status: 200 }
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    sessionToken,
    buildSessionCookieOptions()
  );

  return response;
}

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }

  const sessionUser = decodeSessionToken(rawToken);
  if (!sessionUser) {
    const response = NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      "",
      buildClearSessionCookieOptions()
    );
    return response;
  }

  const renewed = renewSessionUser(sessionUser);
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
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    buildClearSessionCookieOptions()
  );
  return response;
}
