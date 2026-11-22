import { NextRequest, NextResponse } from "next/server";
import {
  buildLastContextCookieOptions,
  buildSessionCookieOptions,
  getServerSession,
  LAST_CONTEXT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import {
  listEligibleContextsForPerson,
  resolveDestinationForContext,
  validateMembershipSwitch,
  type ContextViewMode,
} from "@/services/context.service";
import {
  encodeSessionToken,
  switchSessionMembership,
} from "@/services/session.service";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const contexts = await listEligibleContextsForPerson(session.personId);
  return NextResponse.json(
    {
      authenticated: true,
      activeMembershipId: session.participantId,
      contexts: contexts.map((c) => ({
        membershipId: c.membershipId,
        seasonId: c.seasonId,
        seasonName: c.seasonName,
        role: c.role,
        committeeId: c.committeeId,
        committeeName: c.committeeName,
        committeeSlug: c.committeeSlug,
        managedTrackId: c.managedTrackId,
        managedTrackName: c.managedTrackName,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: please sign in." },
      { status: 401 }
    );
  }

  let body: { membershipId?: unknown; view?: unknown };
  try {
    body = (await request.json()) as { membershipId?: unknown; view?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const membershipId =
    typeof body.membershipId === "string" ? body.membershipId.trim() : "";
  const view: ContextViewMode | undefined =
    body.view === "personal" || body.view === "manage" ? body.view : undefined;

  const validated = await validateMembershipSwitch(
    session.personId,
    membershipId
  );
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 403 }
    );
  }

  const switched = switchSessionMembership(session, {
    id: validated.context.membershipId,
    fullName: session.fullName,
    role: validated.context.role,
  });

  let signedToken: string;
  try {
    signedToken = encodeSessionToken(switched);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Authentication configuration error." },
      { status: 500 }
    );
  }

  const redirectTo = resolveDestinationForContext(validated.context, view);
  const response = NextResponse.json(
    {
      ok: true,
      activeMembershipId: switched.participantId,
      role: validated.context.role,
      redirectTo,
    },
    { status: 200 }
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    signedToken,
    buildSessionCookieOptions()
  );
  response.cookies.set(
    LAST_CONTEXT_COOKIE_NAME,
    switched.participantId,
    buildLastContextCookieOptions()
  );

  return response;
}
