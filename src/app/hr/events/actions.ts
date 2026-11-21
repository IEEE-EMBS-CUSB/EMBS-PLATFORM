"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { logEventAsActor } from "@/services/hr-ops/events.service";

function safeRevalidateEvents() {
  try {
    revalidatePath("/hr/events");
    revalidatePath("/hr/ledger");
    revalidatePath("/hr/publishing");
    revalidatePath("/member");
    revalidatePath("/member/performance");
  } catch {
    // Outside Next.js request context
  }
}

export async function logEventAction(input: {
  title: string;
  description?: string;
  committeeId?: string | null;
  eventDate: string;
  points: number;
  targetMembershipIds: string[];
}): Promise<{ ok: boolean; error?: string; eventId?: string; awarded?: number }> {
  const actor = await getActorContext();
  if (!actor) {
    return unauthorizedResult() as {
      ok: boolean;
      error?: string;
      eventId?: string;
      awarded?: number;
    };
  }
  const res = await logEventAsActor(input, actor);
  if (res.ok) safeRevalidateEvents();
  return res;
}
