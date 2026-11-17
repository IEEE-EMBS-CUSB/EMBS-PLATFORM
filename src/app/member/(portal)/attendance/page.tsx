import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { MetricCard } from "@/components/data-display/metric-card";
import { AttendanceStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { PageLoadingState } from "@/components/states/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/format";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberAttendance } from "@/services/member.service";
import type { SessionType } from "@/types";

export const metadata: Metadata = {
  title: "Attendance history",
  description: "Session, workshop, and meeting attendance log.",
};

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  opening: "Opening",
  closing: "Closing",
  all_community_meeting: "All-Community Meeting",
  officers_meeting: "Officers Meeting",
  committee_meeting: "Committee Meeting",
  workshop: "Workshop",
  event: "Event",
};

async function MemberAttendanceContent() {
  const session = await requireMemberSession();
  const records = await getMemberAttendance(session.participantId);

  const attendedCount = records.filter((r) => r.status === "attended").length;
  const lateCount = records.filter(
    (r) => r.status === "attended" && r.arrival === "late"
  ).length;
  const excusedCount = records.filter((r) => r.status === "excused").length;
  const absentCount = records.filter((r) => r.status === "absent").length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Attendance
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MetricCard label="Attended" value={attendedCount} accent="teal" />
        <MetricCard label="Late arrivals" value={lateCount} />
        <MetricCard label="Excused" value={excusedCount} accent="blue" />
        <MetricCard label="Absent" value={absentCount} />
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />}
          title="No attendance records yet"
          description="Your session and meeting attendance entries will appear here once logged by HR."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {/* Mobile stacked rows */}
          <ul className="divide-y divide-border md:hidden">
            {records.map((record) => (
              <li key={record.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {record.title}
                  </p>
                  <AttendanceStatusBadge
                    status={record.status}
                    arrival={record.arrival}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {SESSION_TYPE_LABELS[record.sessionType]} ·{" "}
                  {formatDisplayDate(record.date)}
                </p>
                {record.excuseReason && (
                  <p className="text-xs text-muted-foreground">
                    Reason: {record.excuseReason}
                  </p>
                )}
                {record.bonusPoints !== undefined && record.bonusPoints > 0 && (
                  <p className="text-xs font-semibold text-[#2f600b]">
                    +{record.bonusPoints} bonus
                    {record.bonusReason ? ` · ${record.bonusReason}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/45 hover:bg-muted/45">
                  <TableHead className="pl-4 font-semibold text-[#002855]">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Session
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Type
                  </TableHead>
                  <TableHead className="pr-4 text-right font-semibold text-[#002855]">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap py-3.5 pl-4 text-sm text-muted-foreground tabular-nums">
                      {formatDisplayDate(record.date)}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <p className="font-semibold text-foreground">
                        {record.title}
                      </p>
                      {record.excuseReason && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Reason: {record.excuseReason}
                        </p>
                      )}
                      {record.bonusPoints !== undefined &&
                        record.bonusPoints > 0 && (
                          <p className="mt-0.5 text-xs font-semibold text-[#2f600b]">
                            +{record.bonusPoints} bonus
                            {record.bonusReason
                              ? ` · ${record.bonusReason}`
                              : ""}
                          </p>
                        )}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground">
                      {SESSION_TYPE_LABELS[record.sessionType]}
                    </TableCell>
                    <TableCell className="py-3.5 pr-4 text-right">
                      <AttendanceStatusBadge
                        status={record.status}
                        arrival={record.arrival}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MemberAttendancePage() {
  return (
    <Suspense fallback={<PageLoadingState />}>
      <MemberAttendanceContent />
    </Suspense>
  );
}
