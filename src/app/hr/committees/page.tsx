import {
  CommitteesRubricsView,
  type CommitteeViewItem,
  type RubricViewItem,
} from "@/components/hr/committees-rubrics-view";
import { HrShell } from "@/components/hr/hr-shell";
import { requireOperationalSession } from "@/lib/portal-guards";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { addCommitteeAction, removeCommitteeAction } from "./actions";

export default async function HrCommitteesPage() {
  const { profile } = await requireOperationalSession();
  let committees: CommitteeViewItem[] = [];
  let rubrics: RubricViewItem[] = [];

  try {
    const [dbCommittees, dbMembers, dbRubrics] = await Promise.all([
      db.select().from(schema.committees),
      db.select().from(schema.rosterMemberships),
      db.select().from(schema.scoringRubrics),
    ]);

    if (dbCommittees.length > 0) {
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
    }

    if (dbRubrics.length > 0) {
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

  if (committees.length === 0) {
    committees = [
      { id: "c-1", name: "AI and Machine Learning", slug: "ai-and-machine-learning", category: "technical" as const, isActive: true, memberCount: 14 },
      { id: "c-2", name: "Web Development", slug: "web-development", category: "technical" as const, isActive: true, memberCount: 12 },
      { id: "c-3", name: "Robotics and Automation", slug: "robotics-and-automation", category: "technical" as const, isActive: true, memberCount: 11 },
      { id: "c-4", name: "Medical Equipment and Planning", slug: "medical-equipment-and-planning", category: "technical" as const, isActive: true, memberCount: 8 },
      { id: "c-5", name: "R&D", slug: "r-and-d", category: "technical" as const, isActive: true, memberCount: 7 },
      { id: "c-6", name: "Game Development", slug: "game-development", category: "technical" as const, isActive: true, memberCount: 6 },
      { id: "c-7", name: "Marketing and Content Creation", slug: "marketing-and-content-creation", category: "non_technical" as const, isActive: true, memberCount: 9 },
      { id: "c-8", name: "Graphic Design", slug: "graphic-design", category: "non_technical" as const, isActive: true, memberCount: 10 },
      { id: "c-9", name: "Photography, Videography & Editing", slug: "photography-videography-editing", category: "non_technical" as const, isActive: true, memberCount: 8 },
      { id: "c-10", name: "Human Resources", slug: "human-resources", category: "non_technical" as const, isActive: true, memberCount: 7 },
      { id: "c-11", name: "Public Relations and Fund Raising", slug: "public-relations-and-fund-raising", category: "non_technical" as const, isActive: true, memberCount: 6 },
      { id: "c-12", name: "Organizing and Logistics", slug: "organizing-and-logistics", category: "non_technical" as const, isActive: true, memberCount: 9 },
    ];
  }

  if (rubrics.length === 0) {
    rubrics = [
      { id: "r-1", name: "Attendance & Punctuality", maxPoints: 20, weight: "1.0", leadersOnly: false },
      { id: "r-2", name: "Task Contribution", maxPoints: 25, weight: "1.0", leadersOnly: false },
      { id: "r-3", name: "Workshops", maxPoints: 5, weight: "1.0", leadersOnly: false },
      { id: "r-4", name: "Hands-on & Events", maxPoints: 20, weight: "1.0", leadersOnly: false },
      { id: "r-5", name: "Communication & Teamwork", maxPoints: 10, weight: "1.0", leadersOnly: false },
      { id: "r-6", name: "Initiative & Ownership", maxPoints: 10, weight: "1.0", leadersOnly: false },
      { id: "r-7", name: "Leadership", maxPoints: 10, weight: "1.0", leadersOnly: true },
    ];
  }

  return (
    <HrShell
      activeTab="committees"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <CommitteesRubricsView
        committees={committees}
        rubrics={rubrics}
        currentUserRole={profile.role}
        onAddCommittee={addCommitteeAction}
        onRemoveCommittee={removeCommitteeAction}
      />
    </HrShell>
  );
}
