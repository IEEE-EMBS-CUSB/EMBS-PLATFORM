import { Suspense } from "react";
import type { Metadata } from "next";
import { AttendeeAssignmentTable } from "@/components/data-display/attendee-assignment-table";
import { MetricCard } from "@/components/data-display/metric-card";
import { MemberTasksLoadingState } from "@/components/states/loading-state";
import { requireAttendeeSession } from "@/lib/portal-guards";
import { getAttendeeAssignments } from "@/services/attendee.service";

export const metadata: Metadata = {
  title: "Assignments and marks",
  description: "Session assignments, submission status, and published marks.",
};

async function AttendeeAssignmentsContent() {
  const session = await requireAttendeeSession();
  const assignments = await getAttendeeAssignments(session.participantId);

  const gradedCount = assignments.filter((a) => a.status === "graded").length;
  const submittedCount = assignments.filter(
    (a) => a.status === "submitted"
  ).length;
  const pendingCount = assignments.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Assignments
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Graded" value={gradedCount} accent="purple" />
        <MetricCard label="Under review" value={submittedCount} accent="blue" />
        <MetricCard label="Pending" value={pendingCount} />
      </div>

      <AttendeeAssignmentTable assignments={assignments} />
    </div>
  );
}

export default function AttendeeAssignmentsPage() {
  return (
    <Suspense fallback={<MemberTasksLoadingState />}>
      <AttendeeAssignmentsContent />
    </Suspense>
  );
}
