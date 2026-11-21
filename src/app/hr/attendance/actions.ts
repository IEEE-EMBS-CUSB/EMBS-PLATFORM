"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { getServerSession } from "@/lib/session-cookie";
import {
  createSessionAsActor,
  recordMemberCheckin,
  rotateSessionCheckinCodeAsActor,
  toggleSessionCheckinAsActor,
  type CreateSessionInput,
  type CreateSessionResult,
} from "@/services/hr-ops/attendance.service";

export type { CreateSessionInput, CreateSessionResult };

function safeRevalidateAttendance() {
  try {
    revalidatePath("/hr/attendance");
    revalidatePath("/hr");
    revalidatePath("/member/attendance");
    revalidatePath("/member");
    revalidatePath("/member/performance");
    revalidatePath("/attendee/attendance");
    revalidatePath("/attendee");
  } catch {
    // Outside Next.js request context
  }
}

export async function createSessionAction(
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult() as CreateSessionResult;
  const res = await createSessionAsActor(input, actor);
  if (res.ok) safeRevalidateAttendance();
  return res;
}

export async function toggleSessionCheckinAction(
  sessionId: string,
  open: boolean,
  windowMinutes: number = 30
): Promise<CreateSessionResult> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult() as CreateSessionResult;
  const res = await toggleSessionCheckinAsActor(
    sessionId,
    open,
    windowMinutes,
    actor
  );
  if (res.ok) safeRevalidateAttendance();
  return res;
}

export async function rotateSessionCheckinCodeAction(
  sessionId: string,
  windowMinutes: number = 30
): Promise<{
  ok: boolean;
  error?: string;
  checkinCode?: string | null;
  checkinExpiresAt?: Date | null;
}> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await rotateSessionCheckinCodeAsActor(
    sessionId,
    windowMinutes,
    actor
  );
  if (res.ok) safeRevalidateAttendance();
  return res;
}

/**
 * Authenticated self-check-in for signed-in members/attendees.
 * Strictly ignores any client-supplied membershipId to prevent IDOR.
 */
export async function memberCheckinAction(
  checkinCode: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _unusedMembershipId?: string
): Promise<{
  ok: boolean;
  error?: string;
  pointsAwarded?: number;
  isPunctual?: boolean;
  sessionTitle?: string;
}> {
  const session = await getServerSession();
  if (!session) {
    return {
      ok: false,
      error: "Unauthorized: please sign in to check in to a live session.",
    };
  }

  const res = await recordMemberCheckin(checkinCode, session.participantId);
  if (res.ok) safeRevalidateAttendance();
  return res;
}
