"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  buildLastContextCookieOptions,
  buildSessionCookieOptions,
  getServerSession,
  LAST_CONTEXT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import {
  resolveDestinationForContext,
  validateMembershipSwitch,
  type ContextViewMode,
} from "@/services/context.service";
import {
  encodeSessionToken,
  switchSessionMembership,
} from "@/services/session.service";

export interface SwitchContextActionResult {
  ok: boolean;
  redirectTo?: "/hr" | "/member" | "/attendee";
  activeMembershipId?: string;
  error?: string;
}

/**
 * Server-validated context switch action.
 * Verifies the authenticated person owns an active eligible membership for `membershipId`,
 * re-mints the signed session cookie (preserving sessionId & issuedAt), and persists `embs_last_context`.
 */
export async function switchActiveContextAction(
  membershipId: string,
  view?: ContextViewMode
): Promise<SwitchContextActionResult> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Unauthorized: please sign in." };
  }

  const validated = await validateMembershipSwitch(
    session.personId,
    membershipId
  );
  if (!validated.ok) {
    return { ok: false, error: validated.error };
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
    return { ok: false, error: "Authentication configuration error." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    signedToken,
    buildSessionCookieOptions()
  );
  cookieStore.set(
    LAST_CONTEXT_COOKIE_NAME,
    switched.participantId,
    buildLastContextCookieOptions()
  );

  try {
    revalidatePath("/hr");
    revalidatePath("/member");
    revalidatePath("/attendee");
  } catch {
    // Outside Next.js request context
  }

  return {
    ok: true,
    activeMembershipId: switched.participantId,
    redirectTo: resolveDestinationForContext(validated.context, view),
  };
}
