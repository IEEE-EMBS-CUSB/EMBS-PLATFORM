"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { addManualLedgerEntryAsActor } from "@/services/hr-ops/ledger.service";

function safeRevalidateLedger() {
  try {
    revalidatePath("/hr/ledger");
    revalidatePath("/hr/publishing");
    revalidatePath("/member");
    revalidatePath("/member/performance");
  } catch {
    // Outside Next.js request context
  }
}

export async function addManualLedgerEntryAction(input: {
  membershipId: string;
  points: number;
  month: string;
  reason: string;
}) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await addManualLedgerEntryAsActor(input, actor);
  if (res.ok) safeRevalidateLedger();
  return res;
}
