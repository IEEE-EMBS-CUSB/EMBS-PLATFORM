import {
  CommitteesRubricsView,
  type CommitteeViewItem,
  type RubricViewItem,
} from "@/components/hr/committees-rubrics-view";
import { HrShell } from "@/components/hr/hr-shell";
import { requireHrModule } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  addCommitteeAction,
  removeCommitteeAction,
  addRubricAction,
  removeRubricAction,
} from "./actions";
import { and, eq } from "drizzle-orm";

export default async function HrCommitteesPage() {
  const { profile } = await requireHrModule("committees");
  let committees: CommitteeViewItem[] = [];
  let rubrics: RubricViewItem[] = [];
  let activeSeasonName = "Active Season";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
      const seasonId = activeSeason.id;

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
          .select({ committeeId: schema.rosterMemberships.committeeId })
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
      for (const m of dbMembers) {
        if (m.committeeId) {
          counts.set(m.committeeId, (counts.get(m.committeeId) ?? 0) + 1);
        }
      }

      committees = dbCommittees.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
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
    <HrShell
      activeTab="committees"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <CommitteesRubricsView
        committees={committees}
        rubrics={rubrics}
        currentUserRole={profile.role}
        onAddCommittee={addCommitteeAction}
        onRemoveCommittee={removeCommitteeAction}
        onAddRubric={addRubricAction}
        onRemoveRubric={removeRubricAction}
      />
    </HrShell>
  );
}
