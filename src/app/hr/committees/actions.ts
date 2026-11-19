"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canManageCommittees } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
}

export interface AddCommitteeInput {
  name: string;
  category: "technical" | "non_technical";
  slug?: string;
  seasonId?: string;
}

export async function addCommitteeAction(
  input: AddCommitteeInput,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canManageCommittees(actorRole)) {
    return { ok: false, error: "Unauthorized: only Master Admin can add committees." };
  }

  try {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { ok: false, error: "Committee name is required." };
    }

    const slug =
      input.slug?.trim().toLowerCase() ||
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    // Resolve active season
    let seasonId = input.seasonId;
    if (!seasonId) {
      const activeSeasons = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"));
      if (activeSeasons.length === 0) {
        return { ok: false, error: "No active season found for committee." };
      }
      seasonId = activeSeasons[0].id;
    }

    const [inserted] = await db
      .insert(schema.committees)
      .values({
        seasonId,
        name: trimmedName,
        slug,
        category: input.category,
        isActive: true,
      })
      .returning();

    safeRevalidatePath("/hr/committees");
    safeRevalidatePath("/hr/roster");
    return { ok: true, committeeId: inserted.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add committee";
    return { ok: false, error: message };
  }
}

export async function removeCommitteeAction(
  committeeId: string,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canManageCommittees(actorRole)) {
    return { ok: false, error: "Unauthorized: only Master Admin can remove committees." };
  }

  try {
    await db
      .delete(schema.committees)
      .where(eq(schema.committees.id, committeeId));

    safeRevalidatePath("/hr/committees");
    safeRevalidatePath("/hr/roster");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove committee";
    return { ok: false, error: message };
  }
}
