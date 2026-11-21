import { HrShell } from "@/components/hr/hr-shell";
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
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function HrPublishingPage() {
  const { profile } = await requireHrModule("publishing");

  let activeSeasonName = "Active Season";
  try {
    const [activeSeason] = await db
      .select({ name: schema.seasons.name })
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (activeSeason) activeSeasonName = activeSeason.name;
  } catch {
    // DB offline
  }

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
    <HrShell
      activeTab="publishing"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <LeaderboardPublisherView
        snapshot={snapshot}
        availableMonths={availableMonths.length > 0 ? availableMonths : [month]}
        onPublish={publishMonthlySnapshotAction}
        onLoadMonth={loadPublishingSnapshotAction}
      />
    </HrShell>
  );
}
