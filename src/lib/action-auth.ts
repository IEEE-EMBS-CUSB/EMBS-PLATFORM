import { getServerSession } from "@/lib/session-cookie";
import { isOperationalRole } from "@/lib/auth-helpers";
import { getOperationalUserProfile } from "@/services/member.service";
import type { MembershipRole } from "@/lib/auth-helpers";
import type { OperationalUserProfile } from "@/services/member.service";

export interface ActorContext {
  sessionId: string;
  participantId: string;
  profile: OperationalUserProfile;
}

/**
 * Resolves the currently authenticated operational user from the session cookie.
 * Server actions must use this instead of trusting client-supplied role strings.
 */
export async function getActorContext(): Promise<ActorContext | null> {
  const session = await getServerSession();
  if (!session || session.participantType !== "member") return null;

  const profile = await getOperationalUserProfile(session.participantId);
  if (!profile || !isOperationalRole(profile.role)) return null;

  return {
    sessionId: session.sessionId,
    participantId: session.participantId,
    profile,
  };
}

export function unauthorizedResult(error = "Unauthorized: you must be signed in as an operational user.") {
  return { ok: false, error };
}

export function hasRole(actor: ActorContext, ...roles: MembershipRole[]): boolean {
  return roles.includes(actor.profile.role);
}
