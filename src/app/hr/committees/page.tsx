import {
  CommitteesRubricsView,
  type CommitteeTrackItem,
  type CommitteeViewItem,
  type RubricViewItem,
} from "@/components/hr/committees-rubrics-view";
import { requireHrModule } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ensureDefaultTracksForSeason } from "@/services/hr-ops/committees.service";
import {
  addCommitteeAction,
  addCommitteeTrackAction,
  addRubricAction,
  assignCommitteeTrackAction,
  deleteCommitteeTrackAction,
  removeCommitteeAction,
  removeRubricAction,
  renameCommitteeTrackAction,
} from "./actions";
import { and, eq } from "drizzle-orm";

export default async function HrCommitteesPage() {
  const { profile } = await requireHrModule("committees");
  let tracks: CommitteeTrackItem[] = [];
  let committees: CommitteeViewItem[] = [];
  let rubrics: RubricViewItem[] = [];

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      const dbTracks = await ensureDefaultTracksForSeason(seasonId);

      const [dbCommittees, dbMembers, dbRubrics] = await Promise.all([
        db
          .select()
          .from(schema.committees)
          .where(
            and(
              eq(schema.committees.seasonId, seasonId),
              eq(schema.committees.isActive, true)
            )
          ),
        db
          .select({
            committeeId: schema.rosterMemberships.committeeId,
            role: schema.rosterMemberships.role,
            fullName: schema.rosterMemberships.fullName,
            managedTrackId: schema.rosterMemberships.managedTrackId,
          })
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true)
            )
          ),
        db
          .select()
          .from(schema.scoringRubrics)
          .where(eq(schema.scoringRubrics.seasonId, seasonId)),
      ]);

      const counts = new Map<string, number>();
      const directorsByTrack = new Map<string, string[]>();
      for (const m of dbMembers) {
        if (m.committeeId) {
          counts.set(m.committeeId, (counts.get(m.committeeId) ?? 0) + 1);
        }
        if (m.role === "director" && m.managedTrackId) {
          const list = directorsByTrack.get(m.managedTrackId) ?? [];
          list.push(m.fullName);
          directorsByTrack.set(m.managedTrackId, list);
        }
      }

      const isTrackDirector =
        profile.role === "director" && Boolean(profile.managedTrackId);

      tracks = dbTracks
        .filter((t) => !isTrackDirector || t.id === profile.managedTrackId)
        .map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          directorNames: directorsByTrack.get(t.id) ?? [],
        }));

      committees = dbCommittees
        .filter((c) => !isTrackDirector || c.trackId === profile.managedTrackId)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          category: c.category,
          trackId: c.trackId,
          isActive: c.isActive,
          memberCount: counts.get(c.id) ?? 0,
        }));

      rubrics = dbRubrics.map((r) => ({
        id: r.id,
        name: r.name,
        maxPoints: r.maxPoints,
        weight: r.weight,
        leadersOnly: r.leadersOnly,
      }));
    }
  } catch {
    // If DB offline during build
  }

  return (
    <CommitteesRubricsView
      tracks={tracks.length > 0 ? tracks : undefined}
      committees={committees}
      rubrics={rubrics}
      currentUserRole={profile.role}
      scopedTrackName={
        profile.role === "director" ? profile.managedTrackName ?? null : null
      }
      onAddTrack={addCommitteeTrackAction}
      onRenameTrack={renameCommitteeTrackAction}
      onDeleteTrack={deleteCommitteeTrackAction}
      onAssignCommitteeTrack={assignCommitteeTrackAction}
      onAddCommittee={addCommitteeAction}
      onRemoveCommittee={removeCommitteeAction}
      onAddRubric={addRubricAction}
      onRemoveRubric={removeRubricAction}
    />
  );
}
