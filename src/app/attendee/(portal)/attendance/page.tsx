import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { AttendeeSessionTable } from "@/components/data-display/attendee-session-table";
import { MetricCard } from "@/components/data-display/metric-card";
import { MemberAttendanceLoadingState } from "@/components/states/loading-state";
import { requireAttendeeSession } from "@/lib/portal-guards";
import { getAttendeeAttendance } from "@/services/attendee.service";

export const metadata: Metadata = {
  title: "Session attendance",
  description: "Your recorded IEEE EMBS CUSB session attendance history.",
};

interface AttendeeAttendancePageProps {
  searchParams: Promise<{ checkedIn?: string }>;
}

async function AttendeeAttendanceContent({
  searchParams,
}: AttendeeAttendancePageProps) {
  const [{ checkedIn }, session] = await Promise.all([
    searchParams,
    requireAttendeeSession(),
  ]);
  const sessions = await getAttendeeAttendance(session.participantId);

  const attendedCount = sessions.filter((s) => s.status === "attended").length;
  const lateCount = sessions.filter(
    (s) => s.status === "attended" && s.arrival === "late"
  ).length;
  const excusedCount = sessions.filter((s) => s.status === "excused").length;
  const absentCount = sessions.filter((s) => s.status === "absent").length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Session attendance
        </h1>
      </div>

      {checkedIn && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-[#78be20]/40 bg-[#eaf5dd] p-4 text-sm font-semibold text-[#1e6b0a]"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Attendance recorded for {checkedIn}.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MetricCard label="Attended" value={attendedCount} accent="teal" />
        <MetricCard label="Late" value={lateCount} />
        <MetricCard label="Excused" value={excusedCount} accent="blue" />
        <MetricCard label="Absent" value={absentCount} />
      </div>

      <AttendeeSessionTable sessions={sessions} />
    </div>
  );
}

export default function AttendeeAttendancePage({
  searchParams,
}: AttendeeAttendancePageProps) {
  return (
    <Suspense fallback={<MemberAttendanceLoadingState showCheckin={false} />}>
      <AttendeeAttendanceContent searchParams={searchParams} />
    </Suspense>
  );
}
