import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarCheck, CalendarClock, CheckCircle2 } from "lucide-react";
import { MetricCard } from "@/components/data-display/metric-card";
import { SessionResourceLinks } from "@/components/data-display/session-resource-links";
import { AttendanceStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { MemberAttendanceLoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
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
import {
  getMemberAttendance,
  getMemberUpcomingSessions,
} from "@/services/member.service";
import { LiveCheckinCard } from "@/components/member/live-checkin-card";
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

interface MemberAttendancePageProps {
  searchParams: Promise<{
    checkedIn?: string;
    points?: string;
    punctual?: string;
  }>;
}

async function MemberAttendanceContent({
  searchParams,
}: MemberAttendancePageProps) {
  const [{ checkedIn, points, punctual }, session] = await Promise.all([
    searchParams,
    requireMemberSession(),
  ]);
  const [records, upcomingSessions] = await Promise.all([
    getMemberAttendance(session.participantId),
    getMemberUpcomingSessions(session.participantId),
  ]);
  const awardedPoints = points ? Number(points) : 0;

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

      {checkedIn && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-[#78be20]/40 bg-[#eaf5dd] p-4 text-sm text-[#1e6b0a]"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Attendance recorded for {checkedIn}.
            </p>
            {awardedPoints > 0 && (
              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums">
                +{awardedPoints} pts awarded
                {punctual === "1" ? " (Punctual bonus included)" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      <LiveCheckinCard membershipId={session.participantId} />

      {upcomingSessions.length > 0 && (
        <section
          aria-label="Upcoming and live sessions"
          className="overflow-hidden rounded-lg border border-border bg-white"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/45 px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock
                className="h-4 w-4 text-[#772583]"
                aria-hidden="true"
              />
              <h2 className="font-heading text-sm font-bold text-[#002855]">
                Upcoming &amp; Live Sessions
              </h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {upcomingSessions.length} session
              {upcomingSessions.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {upcomingSessions.map((upcoming) => {
              const startDate = new Date(upcoming.startsAt);
              const formattedStart = Number.isNaN(startDate.getTime())
                ? formatDisplayDate(upcoming.startsAt)
                : startDate.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Africa/Cairo",
                  });

              return (
                <li
                  key={upcoming.id}
                  className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {upcoming.title}
                      </p>
                      <Badge
                        className={
                          upcoming.checkinState === "live"
                            ? "bg-[#78be20] text-[10px] font-semibold text-white"
                            : "bg-[#00629b] text-[10px] font-semibold text-white"
                        }
                      >
                        {upcoming.checkinState === "live"
                          ? "Check-in Open"
                          : "Scheduled"}
                      </Badge>
                      <Badge
                        className={
                          upcoming.sessionMode === "online"
                            ? "bg-[#ebf3f8] text-[10px] font-semibold text-[#00629b]"
                            : "bg-[#f1f5f9] text-[10px] font-semibold text-[#002855]"
                        }
                      >
                        {upcoming.sessionMode === "online" ? "Online" : "Offline"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {upcoming.committeeName} · {formattedStart}
                      {upcoming.instructors.length > 0
                        ? ` · Instructor${upcoming.instructors.length > 1 ? "s" : ""}: ${upcoming.instructors.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <SessionResourceLinks
                    sessionMode={upcoming.sessionMode}
                    slideDeckUrl={upcoming.slideDeckUrl}
                    webConferencingUrl={upcoming.webConferencingUrl}
                    locationUrl={upcoming.locationUrl}
                    locationAddress={upcoming.locationAddress}
                    className="shrink-0"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
                  {SESSION_TYPE_LABELS[record.sessionType]}
                  {record.sessionMode
                    ? ` · ${record.sessionMode === "online" ? "Online" : "Offline"}`
                    : ""}{" "}
                  · {formatDisplayDate(record.date)}
                  {record.instructors && record.instructors.length > 0
                    ? ` · ${record.instructors.join(", ")}`
                    : ""}
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
                <SessionResourceLinks
                  sessionMode={record.sessionMode}
                  slideDeckUrl={record.slideDeckUrl}
                  webConferencingUrl={record.webConferencingUrl}
                  locationUrl={record.locationUrl}
                  locationAddress={record.locationAddress}
                  className="pt-0.5"
                />
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {record.title}
                        </p>
                        {record.sessionMode && (
                          <Badge
                            className={
                              record.sessionMode === "online"
                                ? "bg-[#ebf3f8] text-[10px] font-semibold text-[#00629b]"
                                : "bg-[#f1f5f9] text-[10px] font-semibold text-[#002855]"
                            }
                          >
                            {record.sessionMode === "online"
                              ? "Online"
                              : "Offline"}
                          </Badge>
                        )}
                      </div>
                      {record.instructors && record.instructors.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Instructor{record.instructors.length > 1 ? "s" : ""}:{" "}
                          {record.instructors.join(", ")}
                        </p>
                      )}
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
                      <SessionResourceLinks
                        sessionMode={record.sessionMode}
                        slideDeckUrl={record.slideDeckUrl}
                        webConferencingUrl={record.webConferencingUrl}
                        locationUrl={record.locationUrl}
                        locationAddress={record.locationAddress}
                        className="mt-1.5"
                      />
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

export default function MemberAttendancePage({
  searchParams,
}: MemberAttendancePageProps) {
  return (
    <Suspense fallback={<MemberAttendanceLoadingState showCheckin />}>
      <MemberAttendanceContent searchParams={searchParams} />
    </Suspense>
  );
}
