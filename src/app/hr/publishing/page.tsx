import {
  LeaderboardPublisherView,
  type SnapshotDisplayData,
} from "@/components/hr/leaderboard-publisher-view";
import { requireHrModule } from "@/lib/portal-guards";
import {
  getAvailableMonthsForPublishingPage,
  getSnapshotForPublishingPage,
} from "@/services/hr-ops/publishing.service";
import {
  loadPublishingSnapshotAction,
  publishMonthlySnapshotAction,
} from "./actions";

export default async function HrPublishingPage() {
  await requireHrModule("publishing");

  const availableMonths = await getAvailableMonthsForPublishingPage();
  const month = availableMonths[0] ?? new Date().toISOString().slice(0, 7);
  const draft = await getSnapshotForPublishingPage(month);

  const snapshot: SnapshotDisplayData = draft
    ? {
        month: draft.month,
        status: draft.status,
        publishedAt: draft.publishedAt,
        overallEntries: draft.overallEntries,
        committeeEntries: draft.committeeEntries,
      }
    : {
        month,
        status: "draft",
        overallEntries: [],
        committeeEntries: {},
      };

  return (
    <LeaderboardPublisherView
      snapshot={snapshot}
      availableMonths={availableMonths.length > 0 ? availableMonths : [month]}
      onPublish={publishMonthlySnapshotAction}
      onLoadMonth={loadPublishingSnapshotAction}
    />
  );
}
