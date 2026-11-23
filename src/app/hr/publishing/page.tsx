import {
  LeaderboardPublisherView,
  type SnapshotDisplayData,
} from "@/components/hr/leaderboard-publisher-view";
import { requireHrModule } from "@/lib/portal-guards";
import { pickDefaultPublishingMonth } from "@/lib/publishing-state";
import { formatMonthInCairo } from "@/services/hr-ops/helpers";
import {
  getPublishingMonthOptions,
  getSnapshotForPublishingPage,
} from "@/services/hr-ops/publishing.service";
import {
  loadPublishingSnapshotAction,
  publishMonthlySnapshotAction,
} from "./actions";

export default async function HrPublishingPage() {
  await requireHrModule("publishing");

  const currentMonth = formatMonthInCairo(new Date());
  const monthOptions = await getPublishingMonthOptions();
  const availableMonths =
    monthOptions.length > 0
      ? monthOptions.map((o) => o.month)
      : [currentMonth];
  const monthStatuses: Record<string, "draft" | "published"> =
    Object.fromEntries(monthOptions.map((o) => [o.month, o.status]));
  const defaultMonth = pickDefaultPublishingMonth(monthOptions, currentMonth);
  const draft = await getSnapshotForPublishingPage(defaultMonth);

  const snapshot: SnapshotDisplayData = draft
    ? {
        month: draft.month,
        status: draft.status,
        publishedAt: draft.publishedAt,
        publishedByName: draft.publishedByName,
        committeeEntries: draft.committeeEntries,
      }
    : {
        month: defaultMonth,
        status: "draft",
        committeeEntries: {},
      };

  return (
    <LeaderboardPublisherView
      snapshot={snapshot}
      availableMonths={availableMonths}
      monthStatuses={monthStatuses}
      currentMonth={currentMonth}
      onPublish={publishMonthlySnapshotAction}
      onLoadMonth={loadPublishingSnapshotAction}
    />
  );
}
