import { CalendarCheck } from "lucide-react";
import { SessionResourceLinks } from "@/components/data-display/session-resource-links";
import { AttendanceStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/format";
import type { AttendeeSessionRecord } from "@/types";

interface AttendeeSessionTableProps {
  sessions: AttendeeSessionRecord[];
}

export function AttendeeSessionTable({ sessions }: AttendeeSessionTableProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />}
        title="No sessions recorded yet"
        description="Your attended sessions will appear here once attendance is published for your track."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Mobile stacked rows */}
      <ul className="divide-y divide-border md:hidden">
        {sessions.map((session) => (
          <li key={session.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {session.sessionTitle}
              </p>
              <AttendanceStatusBadge
                status={session.status}
                arrival={session.arrival}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {session.committeeName} · {session.deliveredBy}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDisplayDate(session.date)}
            </p>
            <SessionResourceLinks
              sessionMode={session.sessionMode}
              slideDeckUrl={session.slideDeckUrl}
              webConferencingUrl={session.webConferencingUrl}
              locationUrl={session.locationUrl}
              locationAddress={session.locationAddress}
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
                Delivered by
              </TableHead>
              <TableHead className="pr-4 text-right font-semibold text-[#002855]">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="whitespace-nowrap py-3.5 pl-4 text-sm text-muted-foreground tabular-nums">
                  {formatDisplayDate(session.date)}
                </TableCell>
                <TableCell className="py-3.5">
                  <p className="font-semibold text-foreground">
                    {session.sessionTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {session.committeeName}
                  </p>
                  <SessionResourceLinks
                    sessionMode={session.sessionMode}
                    slideDeckUrl={session.slideDeckUrl}
                    webConferencingUrl={session.webConferencingUrl}
                    locationUrl={session.locationUrl}
                    locationAddress={session.locationAddress}
                    className="mt-1.5"
                  />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {session.deliveredBy}
                </TableCell>
                <TableCell className="py-3.5 pr-4 text-right">
                  <AttendanceStatusBadge
                    status={session.status}
                    arrival={session.arrival}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
