"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  buildLastContextCookieOptions,
  buildSessionCookieOptions,
  encodeLastContextCookie,
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
  activeTrackedCommitteeId?: string | null;
  error?: string;
}

/**
 * Server-validated context switch action.
 * Verifies the authenticated person owns an active eligible membership for `membershipId`
 * (and optional `trackedCommitteeId` for multi-committee `hr_member` hats),
 * re-mints the signed session cookie (preserving sessionId & issuedAt), and persists `embs_last_context`.
 */
export async function switchActiveContextAction(
  membershipId: string,
  view?: ContextViewMode,
  trackedCommitteeId?: string | null
): Promise<SwitchContextActionResult> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Unauthorized: please sign in." };
  }

  const validated = await validateMembershipSwitch(
    session.personId,
    membershipId,
    trackedCommitteeId
  );
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const switched = switchSessionMembership(session, {
    id: validated.context.membershipId,
    fullName: session.fullName,
    role: validated.context.role,
    trackedCommitteeId: validated.context.trackedCommitteeId ?? null,
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
    encodeLastContextCookie(switched.participantId, switched.trackedCommitteeId),
    buildLastContextCookieOptions()
  );

  try {
    revalidatePath("/hr", "layout");
    revalidatePath("/hr");
    revalidatePath("/member");
    revalidatePath("/attendee");
  } catch {
    // Outside Next.js request context
  }

  return {
    ok: true,
    activeMembershipId: switched.participantId,
    activeTrackedCommitteeId: switched.trackedCommitteeId ?? null,
    redirectTo: resolveDestinationForContext(validated.context, view),
  };
}
