import { requireHrModule } from "@/lib/portal-guards";
import { getAdminStatisticsDatasetForActor } from "@/services/hr-ops/statistics.service";
import { StatisticsView } from "@/components/hr/statistics-view";

export default async function HrStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ seasonId?: string | string[] }>;
}) {
  const { profile } = await requireHrModule("statistics");
  const resolvedParams = await searchParams;
  const rawSeasonId = Array.isArray(resolvedParams.seasonId)
    ? resolvedParams.seasonId[0]
    : resolvedParams.seasonId;

  const dataset = await getAdminStatisticsDatasetForActor({
    actor: {
      id: profile.id,
      personId: profile.personId,
      role: profile.role,
      committeeId: profile.committeeId,
      committeeName: profile.committeeName,
      trackedCommitteeId: profile.trackedCommitteeId,
      trackedCommitteeName: profile.trackedCommitteeName,
      managedTrackId: profile.managedTrackId,
      managedTrackName: profile.managedTrackName,
    },
    seasonId: rawSeasonId ?? null,
  });

  return <StatisticsView dataset={dataset} />;
}
