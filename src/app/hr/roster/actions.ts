"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  addRosterMemberAsActor,
  assignDirectorTrackAsActor,
  assignMemberCommitteeAsActor,
  assignMemberRoleAsActor,
  bulkImportRosterAsActor,
  removeRosterMemberAsActor,
  resetMemberPasswordAsActor,
  type AddRosterMemberInput,
} from "@/services/hr-ops/roster.service";

export type { AddRosterMemberInput };

function safeRevalidateRoster() {
  try {
    revalidatePath("/hr/roster");
    revalidatePath("/hr");
  } catch {
    // Outside Next.js request context
  }
}

export async function addRosterMemberAction(input: AddRosterMemberInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addRosterMemberAsActor(input, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function bulkImportRosterAction(csvContent: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await bulkImportRosterAsActor(csvContent, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function removeRosterMemberAction(memberId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await removeRosterMemberAsActor(memberId, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function resetMemberPasswordAction(memberId: string) {
  const actor = await getActorContext();
  if (!actor) return { ok: false, tempPassword: "", error: "Unauthorized" };
  const res = await resetMemberPasswordAsActor(memberId, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function assignMemberRoleAction(
  memberId: string,
  newRole: MembershipRole
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await assignMemberRoleAsActor(memberId, newRole, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function assignMemberCommitteeAction(
  memberId: string,
  committeeId: string | null
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await assignMemberCommitteeAsActor(memberId, committeeId, actor);
  if (res.ok) safeRevalidateRoster();
  return res;
}

export async function assignDirectorTrackAction(
  memberId: string,
  trackId: string | null
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await assignDirectorTrackAsActor(memberId, trackId, actor);
  if (res.ok) {
    safeRevalidateRoster();
    try {
      revalidatePath("/hr/committees");
      revalidatePath("/hr/tasks");
      revalidatePath("/hr/ledger");
      revalidatePath("/hr/feedback");
    } catch {
      // Outside Next.js request context
    }
  }
  return res;
}
