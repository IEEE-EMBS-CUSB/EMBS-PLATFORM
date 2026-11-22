"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import {
  addHrFeedbackAsActor,
  type AddHrFeedbackInput,
} from "@/services/hr-ops/feedback.service";

function safeRevalidateFeedback() {
  try {
    revalidatePath("/hr/feedback");
    revalidatePath("/hr/ledger");
    revalidatePath("/hr/publishing");
    revalidatePath("/member/feedback");
    revalidatePath("/member/performance");
    revalidatePath("/member");
  } catch {
    // Outside Next.js request context
  }
}

export async function addHrFeedbackAction(input: AddHrFeedbackInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addHrFeedbackAsActor(input, actor);
  if (res.ok) safeRevalidateFeedback();
  return res;
}
