"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import {
  addCommitteeAsActor,
  addCommitteeTrackAsActor,
  addRubricAsActor,
  assignCommitteeTrackAsActor,
  deleteCommitteeTrackAsActor,
  removeCommitteeAsActor,
  removeRubricAsActor,
  renameCommitteeTrackAsActor,
  type AddCommitteeInput,
  type AddCommitteeTrackInput,
  type AddRubricInput,
  type RenameCommitteeTrackInput,
} from "@/services/hr-ops/committees.service";

export type {
  AddCommitteeInput,
  AddCommitteeTrackInput,
  AddRubricInput,
  RenameCommitteeTrackInput,
};

function safeRevalidate() {
  try {
    revalidatePath("/hr/committees");
    revalidatePath("/hr/seasons");
    revalidatePath("/hr/roster");
    revalidatePath("/hr/tasks");
    revalidatePath("/leaderboards");
    revalidatePath("/");
  } catch {
    // Outside Next.js request context
  }
}

export async function addCommitteeTrackAction(input: AddCommitteeTrackInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addCommitteeTrackAsActor(input, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function renameCommitteeTrackAction(
  input: RenameCommitteeTrackInput
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await renameCommitteeTrackAsActor(input, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function deleteCommitteeTrackAction(trackId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await deleteCommitteeTrackAsActor(trackId, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function assignCommitteeTrackAction(
  committeeId: string,
  trackId: string
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await assignCommitteeTrackAsActor(committeeId, trackId, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function addCommitteeAction(input: AddCommitteeInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addCommitteeAsActor(input, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function removeCommitteeAction(committeeId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await removeCommitteeAsActor(committeeId, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function addRubricAction(input: AddRubricInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addRubricAsActor(input, actor);
  if (res.ok) safeRevalidate();
  return res;
}

export async function removeRubricAction(rubricId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await removeRubricAsActor(rubricId, actor);
  if (res.ok) safeRevalidate();
  return res;
}
