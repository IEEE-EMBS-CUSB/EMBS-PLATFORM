import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { canManageCommittees, canManageRubrics } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/auth-helpers";
import { resolveMutableSeason, sanitizeDbError } from "./helpers";

interface CommitteeActor {
  profile: { role: MembershipRole };
}

export interface AddCommitteeInput {
  name: string;
  category: "technical" | "non_technical";
  slug?: string;
  seasonId?: string;
}

export interface AddRubricInput {
  name: string;
  maxPoints: number;
  weight?: string;
  leadersOnly?: boolean;
  seasonId?: string;
}

export async function addCommitteeAsActor(
  input: AddCommitteeInput,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can add committees." };
  }
  try {
    const trimmedName = input.name?.trim() ?? "";
    if (!trimmedName) {
      return { ok: false, error: "Committee name is required." };
    }
    if (input.category !== "technical" && input.category !== "non_technical") {
      return { ok: false, error: "Committee category must be technical or non_technical." };
    }

    const slug =
      input.slug?.trim().toLowerCase() ||
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    if (!slug) {
      return { ok: false, error: "Committee slug could not be derived from name." };
    }

    const seasonRes = await resolveMutableSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const [inserted] = await db
      .insert(schema.committees)
      .values({
        seasonId: seasonRes.season.id,
        name: trimmedName,
        slug,
        category: input.category,
        isActive: true,
      })
      .returning();

    return { ok: true, committeeId: inserted.id, slug: inserted.slug };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to add committee.") };
  }
}

export async function removeCommitteeAsActor(
  committeeId: string,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can remove committees." };
  }
  try {
    const [existing] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.id, committeeId))
      .limit(1);
    if (!existing) {
      return { ok: false, error: "Committee not found." };
    }

    const seasonRes = await resolveMutableSeason(existing.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    await db
      .update(schema.committees)
      .set({ isActive: false })
      .where(eq(schema.committees.id, committeeId));
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to remove committee.") };
  }
}

export async function addRubricAsActor(input: AddRubricInput, actor: CommitteeActor) {
  if (!canManageRubrics(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: cannot manage scoring rubrics." };
  }
  try {
    const trimmedName = input.name?.trim() ?? "";
    if (!trimmedName) {
      return { ok: false, error: "Rubric name is required." };
    }
    if (!Number.isInteger(input.maxPoints) || input.maxPoints <= 0 || input.maxPoints > 1000) {
      return { ok: false, error: "Max points must be an integer between 1 and 1000." };
    }
    const weightNum = Number(input.weight ?? "1.0");
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 10) {
      return { ok: false, error: "Weight must be a number between 0.1 and 10." };
    }

    const seasonRes = await resolveMutableSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const [row] = await db
      .insert(schema.scoringRubrics)
      .values({
        seasonId: seasonRes.season.id,
        name: trimmedName,
        maxPoints: input.maxPoints,
        weight: weightNum.toFixed(2),
        leadersOnly: input.leadersOnly ?? false,
        sortOrder: 0,
      })
      .returning();

    return { ok: true, rubricId: row.id };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to add scoring rubric.") };
  }
}

export async function removeRubricAsActor(rubricId: string, actor: CommitteeActor) {
  if (!canManageRubrics(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: cannot manage scoring rubrics." };
  }
  try {
    const [existing] = await db
      .select()
      .from(schema.scoringRubrics)
      .where(eq(schema.scoringRubrics.id, rubricId))
      .limit(1);
    if (!existing) {
      return { ok: false, error: "Rubric not found." };
    }

    const seasonRes = await resolveMutableSeason(existing.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    await db
      .delete(schema.scoringRubrics)
      .where(eq(schema.scoringRubrics.id, rubricId));
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to remove scoring rubric.") };
  }
}
