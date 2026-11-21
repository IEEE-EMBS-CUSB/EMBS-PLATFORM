"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { canPublishLeaderboard } from "@/lib/permissions";
import {
  getSnapshotForPublishingPage,
  publishMonthlySnapshotAsActor,
} from "@/services/hr-ops/publishing.service";

function safeRevalidatePublishing() {
  try {
    revalidatePath("/hr/publishing");
    revalidatePath("/leaderboards");
    revalidatePath("/leaderboards/history");
    revalidatePath("/leaderboards/committees/[slug]", "page");
    revalidatePath("/");
  } catch {
    // Outside Next.js request context
  }
}

export async function publishMonthlySnapshotAction(month: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await publishMonthlySnapshotAsActor(month, actor);
  if (res.ok) safeRevalidatePublishing();
  return res;
}

export async function loadPublishingSnapshotAction(month: string) {
  const actor = await getActorContext();
  if (!actor || !canPublishLeaderboard(actor.profile.role)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const snapshot = await getSnapshotForPublishingPage(month);
  if (!snapshot) {
    return { ok: false as const, error: "Snapshot could not be loaded for this month." };
  }
  return { ok: true as const, snapshot };
}
