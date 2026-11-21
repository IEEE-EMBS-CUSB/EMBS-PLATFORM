import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { canManageCommittees, canManageRubrics } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  DEFAULT_COMMITTEE_TRACKS,
  inferDefaultTrackSlug,
} from "@/lib/season-settings";
import { resolveMutableSeason, sanitizeDbError } from "./helpers";

interface CommitteeActor {
  profile: { role: MembershipRole };
}

export interface AddCommitteeTrackInput {
  name: string;
  description?: string;
  seasonId?: string;
}

export interface RenameCommitteeTrackInput {
  trackId: string;
  name: string;
  description?: string;
}

export interface AddCommitteeInput {
  name: string;
  trackId?: string | null;
  category?: "technical" | "non_technical";
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

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Ensures a season has the 3 default committee tracks (Technical, Creative, Operations)
 * when no tracks exist yet, and backfills any unlinked committees into their matching track.
 */
export async function ensureDefaultTracksForSeason(seasonId: string) {
  let tracks = await db
    .select()
    .from(schema.committeeTracks)
    .where(eq(schema.committeeTracks.seasonId, seasonId))
    .orderBy(asc(schema.committeeTracks.sortOrder), asc(schema.committeeTracks.createdAt));

  if (tracks.length === 0) {
    await db
      .insert(schema.committeeTracks)
      .values(
        DEFAULT_COMMITTEE_TRACKS.map((t) => ({
          seasonId,
          name: t.name,
          slug: t.slug,
          description: t.description,
          sortOrder: t.sortOrder,
        }))
      )
      .onConflictDoNothing();

    tracks = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, seasonId))
      .orderBy(asc(schema.committeeTracks.sortOrder), asc(schema.committeeTracks.createdAt));
  }

  // Backfill any committees in this season that don't yet have a trackId
  const unlinked = await db
    .select()
    .from(schema.committees)
    .where(
      and(
        eq(schema.committees.seasonId, seasonId),
        isNull(schema.committees.trackId)
      )
    );

  if (unlinked.length > 0 && tracks.length > 0) {
    const bySlug = new Map(tracks.map((t) => [t.slug, t.id]));
    const fallbackId = tracks[0].id;
    for (const comm of unlinked) {
      const targetSlug = inferDefaultTrackSlug(comm);
      const trackId = bySlug.get(targetSlug) ?? fallbackId;
      await db
        .update(schema.committees)
        .set({ trackId })
        .where(eq(schema.committees.id, comm.id));
    }
  }

  return tracks;
}

export async function addCommitteeTrackAsActor(
  input: AddCommitteeTrackInput,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can manage committee tracks.",
    };
  }
  const trimmedName = input.name?.trim() ?? "";
  if (!trimmedName) {
    return { ok: false, error: "Track title is required." };
  }
  const slug = slugifyName(trimmedName);
  if (!slug) {
    return { ok: false, error: "Track title must include letters or numbers." };
  }

  try {
    const seasonRes = await resolveMutableSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const existing = await db
      .select({ sortOrder: schema.committeeTracks.sortOrder })
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.seasonId, seasonRes.season.id));
    const maxSort = existing.reduce((max, r) => Math.max(max, r.sortOrder), 0);

    const [inserted] = await db
      .insert(schema.committeeTracks)
      .values({
        seasonId: seasonRes.season.id,
        name: trimmedName,
        slug,
        description: input.description?.trim() || null,
        sortOrder: maxSort + 1,
      })
      .returning();

    return { ok: true, trackId: inserted.id, slug: inserted.slug };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to create committee track."),
    };
  }
}

export async function renameCommitteeTrackAsActor(
  input: RenameCommitteeTrackInput,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can rename committee tracks.",
    };
  }
  const trimmedName = input.name?.trim() ?? "";
  if (!trimmedName) {
    return { ok: false, error: "Track title is required." };
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.id, input.trackId))
      .limit(1);

    if (!existing) {
      return { ok: false, error: "Committee track not found." };
    }

    const seasonRes = await resolveMutableSeason(existing.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    await db
      .update(schema.committeeTracks)
      .set({
        name: trimmedName,
        description:
          input.description !== undefined
            ? input.description.trim() || null
            : existing.description,
      })
      .where(eq(schema.committeeTracks.id, existing.id));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update committee track."),
    };
  }
}

export async function deleteCommitteeTrackAsActor(
  trackId: string,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can delete committee tracks.",
    };
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.committeeTracks)
      .where(eq(schema.committeeTracks.id, trackId))
      .limit(1);

    if (!existing) {
      return { ok: false, error: "Committee track not found." };
    }

    const seasonRes = await resolveMutableSeason(existing.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const activeCommittees = await db
      .select({ id: schema.committees.id })
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.trackId, existing.id),
          eq(schema.committees.isActive, true)
        )
      )
      .limit(1);

    if (activeCommittees.length > 0) {
      return {
        ok: false,
        error:
          "Cannot delete this track while active committees are still assigned to it. Reassign or remove those committees first.",
      };
    }

    await db
      .delete(schema.committeeTracks)
      .where(eq(schema.committeeTracks.id, existing.id));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to delete committee track."),
    };
  }
}

export async function assignCommitteeTrackAsActor(
  committeeId: string,
  trackId: string,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can reassign committee tracks.",
    };
  }

  try {
    const [comm] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.id, committeeId))
      .limit(1);
    if (!comm) {
      return { ok: false, error: "Committee not found." };
    }

    const seasonRes = await resolveMutableSeason(comm.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const [track] = await db
      .select()
      .from(schema.committeeTracks)
      .where(
        and(
          eq(schema.committeeTracks.id, trackId),
          eq(schema.committeeTracks.seasonId, comm.seasonId)
        )
      )
      .limit(1);
    if (!track) {
      return {
        ok: false,
        error: "Selected track does not belong to this season.",
      };
    }

    const derivedCategory =
      track.slug === "technical" ? "technical" : "non_technical";

    await db
      .update(schema.committees)
      .set({ trackId: track.id, category: derivedCategory })
      .where(eq(schema.committees.id, comm.id));

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to reassign committee track."),
    };
  }
}

export async function addCommitteeAsActor(
  input: AddCommitteeInput,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can add committees.",
    };
  }
  try {
    const trimmedName = input.name?.trim() ?? "";
    if (!trimmedName) {
      return { ok: false, error: "Committee name is required." };
    }

    const slug = input.slug?.trim().toLowerCase() || slugifyName(trimmedName);
    if (!slug) {
      return {
        ok: false,
        error: "Committee slug could not be derived from name.",
      };
    }

    const seasonRes = await resolveMutableSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const seasonId = seasonRes.season.id;
    let resolvedTrackId: string | null = null;
    let derivedCategory: "technical" | "non_technical" =
      input.category ?? "non_technical";

    if (input.trackId) {
      const [track] = await db
        .select()
        .from(schema.committeeTracks)
        .where(
          and(
            eq(schema.committeeTracks.id, input.trackId),
            eq(schema.committeeTracks.seasonId, seasonId)
          )
        )
        .limit(1);
      if (!track) {
        return {
          ok: false,
          error: "Selected committee track does not belong to this season.",
        };
      }
      resolvedTrackId = track.id;
      derivedCategory =
        track.slug === "technical" ? "technical" : "non_technical";
    } else {
      if (
        input.category &&
        input.category !== "technical" &&
        input.category !== "non_technical"
      ) {
        return {
          ok: false,
          error: "Committee category must be technical or non_technical.",
        };
      }
      const tracks = await ensureDefaultTracksForSeason(seasonId);
      const targetSlug = inferDefaultTrackSlug({
        name: trimmedName,
        slug,
        category: derivedCategory,
      });
      resolvedTrackId =
        tracks.find((t) => t.slug === targetSlug)?.id ?? tracks[0]?.id ?? null;
    }

    const [inserted] = await db
      .insert(schema.committees)
      .values({
        seasonId,
        trackId: resolvedTrackId,
        name: trimmedName,
        slug,
        category: derivedCategory,
        isActive: true,
      })
      .returning();

    return {
      ok: true,
      committeeId: inserted.id,
      slug: inserted.slug,
      trackId: inserted.trackId,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to add committee."),
    };
  }
}

export async function removeCommitteeAsActor(
  committeeId: string,
  actor: CommitteeActor
) {
  if (!canManageCommittees(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can remove committees.",
    };
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
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to remove committee."),
    };
  }
}

export async function addRubricAsActor(
  input: AddRubricInput,
  actor: CommitteeActor
) {
  if (!canManageRubrics(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: cannot manage scoring rubrics." };
  }
  try {
    const trimmedName = input.name?.trim() ?? "";
    if (!trimmedName) {
      return { ok: false, error: "Rubric name is required." };
    }
    if (
      !Number.isInteger(input.maxPoints) ||
      input.maxPoints <= 0 ||
      input.maxPoints > 1000
    ) {
      return {
        ok: false,
        error: "Max points must be an integer between 1 and 1000.",
      };
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
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to add scoring rubric."),
    };
  }
}

export async function removeRubricAsActor(
  rubricId: string,
  actor: CommitteeActor
) {
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
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to remove scoring rubric."),
    };
  }
}
