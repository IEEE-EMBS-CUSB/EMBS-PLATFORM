import { HrShell } from "@/components/hr/hr-shell";
import { SeasonManagerView, type SeasonItem } from "@/components/hr/season-manager-view";
import { requireOperationalSession } from "@/lib/portal-guards";

export default async function HrSeasonsPage() {
  const { profile } = await requireOperationalSession();

  const sampleSeasons: SeasonItem[] = [
    {
      id: "season-active-2026",
      name: "Fall 2026",
      status: "active",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-01-31"),
      committeeCount: 12,
      memberCount: 84,
    },
    {
      id: "season-archived-2026",
      name: "Spring 2026",
      status: "archived",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-07-31"),
      committeeCount: 12,
      memberCount: 78,
    },
  ];

  return (
    <HrShell
      activeTab="seasons"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <SeasonManagerView
        seasons={sampleSeasons}
        currentUserRole={profile.role}
      />
    </HrShell>
  );
}
