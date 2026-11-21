import { HrShell } from "@/components/hr/hr-shell";
import {
  SeasonManagerView,
  type SeasonItem,
} from "@/components/hr/season-manager-view";
import { requireHrModule } from "@/lib/portal-guards";
import {
  activateSeasonAction,
  archiveSeasonAction,
  cloneSeasonAction,
  createSeasonAction,
} from "./actions";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function HrSeasonsPage() {
  const { profile } = await requireHrModule("seasons");

  let seasons: SeasonItem[] = [];
  let activeSeasonName = "Seasons";

  try {
    const [dbSeasons, dbCommittees, dbMembers] = await Promise.all([
      db.select().from(schema.seasons).orderBy(desc(schema.seasons.startDate)),
      db
        .select({ seasonId: schema.committees.seasonId })
        .from(schema.committees)
        .where(eq(schema.committees.isActive, true)),
      db
        .select({ seasonId: schema.rosterMemberships.seasonId })
        .from(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.isActive, true)),
    ]);

    const committeeCounts = new Map<string, number>();
    const memberCounts = new Map<string, number>();
    for (const c of dbCommittees) {
      committeeCounts.set(
        c.seasonId,
        (committeeCounts.get(c.seasonId) ?? 0) + 1
      );
    }
    for (const m of dbMembers) {
      memberCounts.set(m.seasonId, (memberCounts.get(m.seasonId) ?? 0) + 1);
    }

    seasons = dbSeasons.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status as "draft" | "active" | "archived",
      startDate: s.startDate,
      endDate: s.endDate ?? undefined,
      committeeCount: committeeCounts.get(s.id) ?? 0,
      memberCount: memberCounts.get(s.id) ?? 0,
    }));

    const active = dbSeasons.find((s) => s.status === "active");
    if (active) activeSeasonName = active.name;
  } catch {
    // DB offline
  }

  return (
    <HrShell
      activeTab="seasons"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <SeasonManagerView
        seasons={seasons}
        currentUserRole={profile.role}
        onCreateSeason={createSeasonAction}
        onCloneSeason={cloneSeasonAction}
        onActivateSeason={activateSeasonAction}
        onArchiveSeason={archiveSeasonAction}
      />
    </HrShell>
  );
}
