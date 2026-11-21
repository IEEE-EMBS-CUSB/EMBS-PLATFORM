"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import type { SeasonSettings } from "@/lib/season-settings";
import {
  activateSeasonAsActor,
  archiveSeasonAsActor,
  cloneSeasonAsActor,
  createSeasonAsActor,
  updateSeasonSettingsAsActor,
} from "@/services/hr-ops/seasons.service";

function safeRevalidateSeasons() {
  try {
    revalidatePath("/hr/seasons");
    revalidatePath("/hr");
    revalidatePath("/hr/committees");
    revalidatePath("/hr/roster");
    revalidatePath("/hr/attendance");
    revalidatePath("/hr/tasks");
    revalidatePath("/leaderboards");
    revalidatePath("/member");
    revalidatePath("/");
  } catch {
    // Outside Next.js request context
  }
}

export async function createSeasonAction(input: {
  name: string;
  startDate: string;
  endDate?: string;
  settings?: SeasonSettings;
}) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await createSeasonAsActor(input, actor);
  if (res.ok) safeRevalidateSeasons();
  return res;
}

export async function updateSeasonSettingsAction(
  seasonId: string,
  settings: SeasonSettings
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await updateSeasonSettingsAsActor(seasonId, settings, actor);
  if (res.ok) safeRevalidateSeasons();
  return res;
}

export async function cloneSeasonAction(
  sourceSeasonId: string,
  newName: string,
  options?: { includeRoster?: boolean }
) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await cloneSeasonAsActor(sourceSeasonId, newName, actor, options);
  if (res.ok) safeRevalidateSeasons();
  return res;
}

export async function activateSeasonAction(seasonId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await activateSeasonAsActor(seasonId, actor);
  if (res.ok) safeRevalidateSeasons();
  return res;
}

export async function archiveSeasonAction(seasonId: string) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await archiveSeasonAsActor(seasonId, actor);
  if (res.ok) safeRevalidateSeasons();
  return res;
}
