import {
  SeasonManagerView,
  type SeasonItem,
  type SeasonRubricSummary,
  type SeasonTrackSummary,
} from "@/components/hr/season-manager-view";
import { requireHrModule } from "@/lib/portal-guards";
import { normalizeSeasonSettings } from "@/lib/season-settings";
import {
  activateSeasonAction,
  archiveSeasonAction,
  cloneSeasonAction,
  createSeasonAction,
  updateSeasonSettingsAction,
} from "./actions";
import {
  addCommitteeTrackAction,
  addRubricAction,
  deleteCommitteeTrackAction,
  removeRubricAction,
  renameCommitteeTrackAction,
} from "@/app/hr/committees/actions";
import { ensureDefaultTracksForSeason } from "@/services/hr-ops/committees.service";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";

export default async function HrSeasonsPage() {
  const { profile } = await requireHrModule("seasons");

  let seasons: SeasonItem[] = [];

  try {
    const dbSeasons = await db
      .select()
      .from(schema.seasons)
      .orderBy(desc(schema.seasons.startDate));

    // Idempotently ensure every non-archived season has its default tracks seeded & committees backfilled
    await Promise.all(
      dbSeasons
        .filter((s) => s.status !== "archived")
        .map((s) => ensureDefaultTracksForSeason(s.id))
    );

    const [dbCommittees, dbMembers, dbTracks, dbRubrics] = await Promise.all([
      db
        .select({
          seasonId: schema.committees.seasonId,
          trackId: schema.committees.trackId,
        })
        .from(schema.committees)
        .where(eq(schema.committees.isActive, true)),
      db
        .select({
          seasonId: schema.rosterMemberships.seasonId,
          role: schema.rosterMemberships.role,
          fullName: schema.persons.fullName,
          managedTrackId: schema.rosterMemberships.managedTrackId,
        })
        .from(schema.rosterMemberships)
        .innerJoin(
          schema.persons,
          eq(schema.rosterMemberships.personId, schema.persons.id)
        )
        .where(eq(schema.rosterMemberships.isActive, true)),
      db
        .select()
        .from(schema.committeeTracks)
        .orderBy(
          asc(schema.committeeTracks.sortOrder),
          asc(schema.committeeTracks.createdAt)
        ),
      db.select().from(schema.scoringRubrics),
    ]);

    const committeeCounts = new Map<string, number>();
    const committeesPerTrack = new Map<string, number>();
    for (const c of dbCommittees) {
      committeeCounts.set(
        c.seasonId,
        (committeeCounts.get(c.seasonId) ?? 0) + 1
      );
      if (c.trackId) {
        committeesPerTrack.set(
          c.trackId,
          (committeesPerTrack.get(c.trackId) ?? 0) + 1
        );
      }
    }

    const memberCounts = new Map<string, number>();
    const directorsByTrack = new Map<string, string[]>();
    for (const m of dbMembers) {
      memberCounts.set(m.seasonId, (memberCounts.get(m.seasonId) ?? 0) + 1);
      if (m.role === "director" && m.managedTrackId) {
        const list = directorsByTrack.get(m.managedTrackId) ?? [];
        list.push(m.fullName);
        directorsByTrack.set(m.managedTrackId, list);
      }
    }

    const tracksBySeason = new Map<string, SeasonTrackSummary[]>();
    for (const t of dbTracks) {
      const list = tracksBySeason.get(t.seasonId) ?? [];
      list.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        committeeCount: committeesPerTrack.get(t.id) ?? 0,
        directorNames: directorsByTrack.get(t.id) ?? [],
      });
      tracksBySeason.set(t.seasonId, list);
    }

    const rubricsBySeason = new Map<string, SeasonRubricSummary[]>();
    for (const r of dbRubrics) {
      const list = rubricsBySeason.get(r.seasonId) ?? [];
      list.push({
        id: r.id,
        name: r.name,
        maxPoints: r.maxPoints,
        weight: r.weight,
        leadersOnly: r.leadersOnly,
      });
      rubricsBySeason.set(r.seasonId, list);
    }

    seasons = dbSeasons.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status as "draft" | "active" | "archived",
      startDate: s.startDate,
      endDate: s.endDate ?? undefined,
      committeeCount: committeeCounts.get(s.id) ?? 0,
      memberCount: memberCounts.get(s.id) ?? 0,
      settings: normalizeSeasonSettings(s.settingsJson),
      tracks: tracksBySeason.get(s.id) ?? [],
      rubrics: rubricsBySeason.get(s.id) ?? [],
    }));
  } catch {
    // DB offline
  }

  return (
    <SeasonManagerView
      seasons={seasons}
      currentUserRole={profile.role}
      onCreateSeason={createSeasonAction}
      onUpdateSettings={updateSeasonSettingsAction}
      onCloneSeason={cloneSeasonAction}
      onActivateSeason={activateSeasonAction}
      onArchiveSeason={archiveSeasonAction}
      onAddTrack={addCommitteeTrackAction}
      onRenameTrack={renameCommitteeTrackAction}
      onDeleteTrack={deleteCommitteeTrackAction}
      onAddRubric={addRubricAction}
      onRemoveRubric={removeRubricAction}
    />
  );
}
