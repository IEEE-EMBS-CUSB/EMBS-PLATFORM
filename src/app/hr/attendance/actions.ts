"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { getServerSession } from "@/lib/session-cookie";
import {
  createSessionAsActor,
  extendSessionCheckinWindowAsActor,
  getSessionAttendanceRosterAsActor,
  recordMemberCheckin,
  setSessionMemberAttendanceAsActor,
  toggleSessionCheckinAsActor,
  type CreateSessionInput,
  type CreateSessionResult,
  type SessionAttendanceStatus,
  type SessionRosterRow,
} from "@/services/hr-ops/attendance.service";

export type {
  CreateSessionInput,
  CreateSessionResult,
  SessionAttendanceStatus,
  SessionRosterRow,
};

function safeRevalidateAttendance() {
  try {
    revalidatePath("/hr", "layout");
    revalidatePath("/member", "layout");
    revalidatePath("/attendee", "layout");
    revalidatePath("/hr/attendance");
    revalidatePath("/hr");
    revalidatePath("/hr/ledger");
    revalidatePath("/hr/publishing");
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

export async function extendSessionCheckinWindowAction(
  sessionId: string,
  extraMinutes: number = 15
): Promise<CreateSessionResult> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult() as CreateSessionResult;
  const res = await extendSessionCheckinWindowAsActor(
    sessionId,
    extraMinutes,
    actor
  );
  if (res.ok) safeRevalidateAttendance();
  return res;
}

export async function getSessionAttendanceRosterAction(
  sessionId: string
): Promise<{
  ok: boolean;
  error?: string;
  roster?: SessionRosterRow[];
}> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  return getSessionAttendanceRosterAsActor(sessionId, actor);
}

export async function setSessionMemberAttendanceAction(input: {
  sessionId: string;
  membershipId: string;
  status: SessionAttendanceStatus;
  overrideReason?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  pointsAwarded?: number;
  status?: SessionAttendanceStatus;
}> {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await setSessionMemberAttendanceAsActor(input, actor);
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
