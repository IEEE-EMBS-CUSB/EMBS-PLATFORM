import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { MemberDeliverablesView } from "@/components/member/deliverables-view";
import { MemberTasksLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberTasks } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Operational tasks assigned by HR and HR Administration.",
};

async function MemberTasksContent() {
  const session = await requireMemberSession();
  const allWork = await getMemberTasks(session.participantId);
  const hrTasks = allWork.filter((item) => item.workType === "task");

  return (
    <MemberDeliverablesView
      title="Tasks"
      subtitle="Operational tasks assigned by HR."
      itemLabel="Task"
      pointsColumnLabel="Task points"
      emptyIcon={<CheckSquare className="h-5 w-5" aria-hidden="true" />}
      emptyTitle="No HR tasks assigned yet"
      emptyDescription="Operational tasks from HR will appear here once assigned."
      items={hrTasks}
      accent="purple"
    />
  );
}

export default function MemberTasksPage() {
  return (
    <Suspense fallback={<MemberTasksLoadingState />}>
      <MemberTasksContent />
    </Suspense>
  );
}
