"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { addHrFeedbackAsActor } from "@/services/hr-ops/feedback.service";

function safeRevalidateFeedback() {
  try {
    revalidatePath("/hr/feedback");
    revalidatePath("/member/feedback");
    revalidatePath("/member");
  } catch {
    // Outside Next.js request context
  }
}

export async function addHrFeedbackAction(input: {
  membershipId: string;
  content: string;
  isWarning: boolean;
  isPublished?: boolean;
}) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addHrFeedbackAsActor(input, actor);
  if (res.ok) safeRevalidateFeedback();
  return res;
}
