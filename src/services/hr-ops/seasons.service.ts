import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { canManageSeasons } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/auth-helpers";
import { isValidDateString, sanitizeDbError } from "./helpers";

interface SeasonActor {
  profile: { role: MembershipRole };
}

export async function createSeasonAsActor(
  input: { name: string; startDate: string; endDate?: string },
  actor: SeasonActor
) {
  if (!canManageSeasons(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can manage seasons." };
  }

  const trimmedName = input.name?.trim() ?? "";
  if (!trimmedName) {
    return { ok: false, error: "Season name is required." };
  }
  if (!isValidDateString(input.startDate)) {
    return { ok: false, error: "A valid start date is required." };
  }
  const startDate = new Date(input.startDate);
  let endDate: Date | null = null;
  if (input.endDate && input.endDate.trim()) {
    if (!isValidDateString(input.endDate)) {
      return { ok: false, error: "End date is invalid." };
    }
    endDate = new Date(input.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      return { ok: false, error: "End date must be on or after the start date." };
    }
  }

  try {
    const [season] = await db
      .insert(schema.seasons)
      .values({
        name: trimmedName,
        status: "draft",
        startDate,
        endDate,
      })
      .returning();
    return { ok: true, seasonId: season.id };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to create season.") };
  }
}

export async function cloneSeasonAsActor(
  sourceSeasonId: string,
  newName: string,
  actor: SeasonActor,
  options?: { includeRoster?: boolean }
) {
  if (!canManageSeasons(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can clone seasons." };
  }

  const trimmedName = newName?.trim() ?? "";
  if (!trimmedName) {
    return { ok: false, error: "New season name is required." };
  }

  try {
    const [source] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, sourceSeasonId));
    if (!source) {
      return { ok: false, error: "Source season not found." };
    }

    const [newSeason] = await db
      .insert(schema.seasons)
      .values({
        name: trimmedName,
        status: "draft",
        startDate: source.startDate,
        endDate: source.endDate,
      })
      .returning();

    const committees = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, sourceSeasonId));

    const committeeMap = new Map<string, string>();
    for (const c of committees) {
      const [nc] = await db
        .insert(schema.committees)
        .values({
          seasonId: newSeason.id,
          name: c.name,
          slug: c.slug,
          category: c.category,
          isActive: c.isActive,
        })
        .returning();
      committeeMap.set(c.id, nc.id);
    }

    const rubrics = await db
      .select()
      .from(schema.scoringRubrics)
      .where(eq(schema.scoringRubrics.seasonId, sourceSeasonId));

    if (rubrics.length > 0) {
      await db.insert(schema.scoringRubrics).values(
        rubrics.map((r) => ({
          seasonId: newSeason.id,
          name: r.name,
          maxPoints: r.maxPoints,
          weight: r.weight,
          leadersOnly: r.leadersOnly,
          sortOrder: r.sortOrder,
        }))
      );
    }

    // By default, clone only active operational leadership or full roster when requested
    if (options?.includeRoster) {
      const members = await db
        .select()
        .from(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.seasonId, sourceSeasonId));

      const activeMembers = members.filter((m) => m.isActive);
      if (activeMembers.length > 0) {
        await db.insert(schema.rosterMemberships).values(
          activeMembers.map((m) => ({
            seasonId: newSeason.id,
            email: m.email,
            fullName: m.fullName,
            committeeId: m.committeeId ? committeeMap.get(m.committeeId) ?? null : null,
            role: m.role,
            passwordHash: m.passwordHash,
            mustChangePassword: m.mustChangePassword,
            isActive: m.isActive,
          }))
        );
      }
    }

    return { ok: true, seasonId: newSeason.id };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to clone season.") };
  }
}

export async function activateSeasonAsActor(seasonId: string, actor: SeasonActor) {
  if (!canManageSeasons(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can activate seasons." };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1);

    if (!target) {
      return { ok: false, error: "Season not found." };
    }
    if (target.status === "archived") {
      return {
        ok: false,
        error: "Archived seasons are permanently frozen and cannot be re-activated.",
      };
    }
    if (target.status === "active") {
      return { ok: true };
    }

    await db
      .update(schema.seasons)
      .set({ status: "archived" })
      .where(eq(schema.seasons.status, "active"));
    await db
      .update(schema.seasons)
      .set({ status: "active" })
      .where(eq(schema.seasons.id, seasonId));

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to activate season.") };
  }
}

export async function archiveSeasonAsActor(seasonId: string, actor: SeasonActor) {
  if (!canManageSeasons(actor.profile.role)) {
    return { ok: false, error: "Unauthorized: only Master Admin can archive seasons." };
  }
  try {
    const [target] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1);

    if (!target) {
      return { ok: false, error: "Season not found." };
    }
    if (target.status === "archived") {
      return { ok: true };
    }

    await db
      .update(schema.seasons)
      .set({ status: "archived" })
      .where(eq(schema.seasons.id, seasonId));

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to archive season.") };
  }
}
