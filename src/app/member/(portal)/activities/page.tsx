import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivityList } from "@/components/data-display/activity-list";
import { PageLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberActivities } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Projects and activities",
  description:
    "Projects, hackathons, delivered sessions, and bonuses recorded for your member profile.",
};

async function MemberActivitiesContent() {
  const session = await requireMemberSession();
  const activities = await getMemberActivities(session.participantId);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Activities
        </h1>
      </div>

      <ActivityList activities={activities} filterable={true} />
    </div>
  );
}

export default function MemberActivitiesPage() {
  return (
    <Suspense fallback={<PageLoadingState />}>
      <MemberActivitiesContent />
    </Suspense>
  );
}
