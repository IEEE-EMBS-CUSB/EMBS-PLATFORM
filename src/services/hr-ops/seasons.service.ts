import { db, withTransaction } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { canManageRubrics, canManageSeasons } from "@/lib/permissions";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  DEFAULT_COMMITTEE_TRACKS,
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  validateSeasonSettings,
  type SeasonSettings,
} from "@/lib/season-settings";
import {
  ensureDefaultTracksForSeason,
  ensureHrCommitteeForSeason,
} from "./committees.service";
import { isValidDateString, sanitizeDbError } from "./helpers";

interface SeasonActor {
  profile: { role: MembershipRole };
}

export async function createSeasonAsActor(
  input: {
    name: string;
    startDate: string;
    endDate?: string;
    settings?: SeasonSettings;
  },
  actor: SeasonActor
) {
  if (!canManageSeasons(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can manage seasons.",
    };
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
      return {
        ok: false,
        error: "End date must be on or after the start date.",
      };
    }
  }

  const settings = input.settings
    ? normalizeSeasonSettings(input.settings)
    : DEFAULT_SEASON_SETTINGS;
  const validation = validateSeasonSettings(settings);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  try {
    const seasonId = await withTransaction(async (tx) => {
      const [season] = await tx
        .insert(schema.seasons)
        .values({
          name: trimmedName,
          status: "draft",
          startDate,
          endDate,
          settingsJson: settings,
        })
        .returning();

      // Seed the 3 default editable committee tracks and guarantee core Human Resources committee exists
      await tx
        .insert(schema.committeeTracks)
        .values(
          DEFAULT_COMMITTEE_TRACKS.map((t) => ({
            seasonId: season.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            sortOrder: t.sortOrder,
          }))
        )
        .onConflictDoNothing();

      await ensureHrCommitteeForSeason(season.id, tx);
      return season.id;
    });

    return { ok: true, seasonId };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to create season."),
    };
  }
}

export async function updateSeasonSettingsAsActor(
  seasonId: string,
  settingsInput: SeasonSettings,
  actor: SeasonActor
) {
  // Master Admin and HR Admin can configure season grading/attendance rules
  if (!canManageRubrics(actor.profile.role)) {
    return {
      ok: false,
      error:
        "Unauthorized: only Master Admin and HR Admin can adjust season settings.",
    };
  }

  const normalized = normalizeSeasonSettings(settingsInput);
  const validation = validateSeasonSettings(normalized);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
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
        error:
          "Archived seasons are permanently frozen and their settings cannot be modified.",
      };
    }

    await db
      .update(schema.seasons)
      .set({
        settingsJson: normalized,
        updatedAt: new Date(),
      })
      .where(eq(schema.seasons.id, seasonId));

    return { ok: true, settings: normalized };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to save season settings."),
    };
  }
}

export async function cloneSeasonAsActor(
  sourceSeasonId: string,
  newName: string,
  actor: SeasonActor,
  options?: { includeRoster?: boolean }
) {
  if (!canManageSeasons(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can clone seasons.",
    };
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

    const sourceTracks = await ensureDefaultTracksForSeason(sourceSeasonId);
    const clonedSettings = normalizeSeasonSettings(source.settingsJson);

    const newSeasonId = await withTransaction(async (tx) => {
      const [newSeason] = await tx
        .insert(schema.seasons)
        .values({
          name: trimmedName,
          status: "draft",
          startDate: source.startDate,
          endDate: source.endDate,
          settingsJson: clonedSettings,
        })
        .returning();

      // Clone committee tracks (preserving custom titles and sort order)
      const trackMap = new Map<string, string>();
      for (const t of sourceTracks) {
        const [nt] = await tx
          .insert(schema.committeeTracks)
          .values({
            seasonId: newSeason.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            sortOrder: t.sortOrder,
          })
          .returning();
        trackMap.set(t.id, nt.id);
      }

      const committees = await tx
        .select()
        .from(schema.committees)
        .where(eq(schema.committees.seasonId, sourceSeasonId));

      const committeeMap = new Map<string, string>();
      for (const c of committees) {
        const [nc] = await tx
          .insert(schema.committees)
          .values({
            seasonId: newSeason.id,
            trackId: c.trackId ? trackMap.get(c.trackId) ?? null : null,
            name: c.name,
            slug: c.slug,
            category: c.category,
            isActive: c.isActive,
          })
          .returning();
        committeeMap.set(c.id, nc.id);
      }

      const rubrics = await tx
        .select()
        .from(schema.scoringRubrics)
        .where(eq(schema.scoringRubrics.seasonId, sourceSeasonId));

      if (rubrics.length > 0) {
        await tx.insert(schema.scoringRubrics).values(
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

      if (options?.includeRoster) {
        const members = await tx
          .select()
          .from(schema.rosterMemberships)
          .where(eq(schema.rosterMemberships.seasonId, sourceSeasonId));

        const activeMembers = members.filter((m) => m.isActive);
        if (activeMembers.length > 0) {
          await tx.insert(schema.rosterMemberships).values(
            activeMembers.map((m) => ({
              seasonId: newSeason.id,
              personId: m.personId,
              committeeId: m.committeeId
                ? committeeMap.get(m.committeeId) ?? null
                : null,
              trackedCommitteeId: m.trackedCommitteeId
                ? committeeMap.get(m.trackedCommitteeId) ?? null
                : null,
              managedTrackId: m.managedTrackId
                ? trackMap.get(m.managedTrackId) ?? null
                : null,
              role: m.role,
              isActive: m.isActive,
            }))
          );
        }
      }

      return newSeason.id;
    });

    return { ok: true, seasonId: newSeasonId };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to clone season."),
    };
  }
}

export async function activateSeasonAsActor(
  seasonId: string,
  actor: SeasonActor
) {
  if (!canManageSeasons(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can activate seasons.",
    };
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
    if (target.status === "active") {
      return { ok: true };
    }

    await withTransaction(async (tx) => {
      await tx
        .update(schema.seasons)
        .set({ status: "archived" })
        .where(eq(schema.seasons.status, "active"));
      await tx
        .update(schema.seasons)
        .set({ status: "active" })
        .where(eq(schema.seasons.id, seasonId));
    });

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to activate season."),
    };
  }
}

export async function archiveSeasonAsActor(
  seasonId: string,
  actor: SeasonActor
) {
  if (!canManageSeasons(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin can archive seasons.",
    };
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
    if (target.status === "active") {
      return {
        ok: false,
        error:
          "Cannot archive the active season directly. Activate another season to archive this one.",
      };
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
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to archive season."),
    };
  }
}
