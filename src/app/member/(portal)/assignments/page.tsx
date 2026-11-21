import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { MemberDeliverablesView } from "@/components/member/deliverables-view";
import { MemberTasksLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberTasks } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Assignments",
  description:
    "Deliverables and roadmap assignments from Chapter Directors and Committee Heads.",
};

async function MemberAssignmentsContent() {
  const session = await requireMemberSession();
  const allWork = await getMemberTasks(session.participantId);
  const assignments = allWork.filter((item) => item.workType !== "task");

  return (
    <MemberDeliverablesView
      title="Assignments"
      subtitle="Deliverables assigned by your Committee Head or Chapter Directors."
      itemLabel="Assignment"
      pointsColumnLabel="Points"
      emptyIcon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
      emptyTitle="No assignments yet"
      emptyDescription="Assignments from your Committee Head or Chapter Directors will appear here."
      items={assignments}
      accent="blue"
    />
  );
}

export default function MemberAssignmentsPage() {
  return (
    <Suspense fallback={<MemberTasksLoadingState />}>
      <MemberAssignmentsContent />
    </Suspense>
  );
}
