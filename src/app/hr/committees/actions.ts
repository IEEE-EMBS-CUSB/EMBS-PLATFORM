"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import {
  addCommitteeAsActor,
  addRubricAsActor,
  removeCommitteeAsActor,
  removeRubricAsActor,
  type AddCommitteeInput,
  type AddRubricInput,
} from "@/services/hr-ops/committees.service";

export type { AddCommitteeInput, AddRubricInput };

function safeRevalidate() {
  try {
    revalidatePath("/hr/committees");
    revalidatePath("/hr/roster");
    revalidatePath("/leaderboards");
    revalidatePath("/");
  } catch {
    // Outside Next.js request context
  }
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
