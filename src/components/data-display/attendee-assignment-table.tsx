import { ClipboardCheck } from "lucide-react";
import { TaskStatusBadge } from "@/components/data-display/status-badge";
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
import type { AttendeeAssignment } from "@/types";

interface AttendeeAssignmentTableProps {
  assignments: AttendeeAssignment[];
}

function formatMark(assignment: AttendeeAssignment): string {
  if (assignment.mark !== null && assignment.maxMark !== null) {
    return `${assignment.mark} / ${assignment.maxMark}`;
  }
  return assignment.status === "submitted" ? "Under review" : "Pending";
}

export function AttendeeAssignmentTable({
  assignments,
}: AttendeeAssignmentTableProps) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
        title="No assignments posted yet"
        description="Session assignments and published marks for your enrolled track will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Mobile stacked rows */}
      <ul className="divide-y divide-border md:hidden">
        {assignments.map((assignment) => (
          <li key={assignment.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {assignment.title}
              </p>
              <span className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                {formatMark(assignment)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {assignment.sessionTitle}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <TaskStatusBadge status={assignment.status} />
              <span className="text-xs text-muted-foreground tabular-nums">
                Due {formatDisplayDate(assignment.dueDate)}
              </span>
            </div>
            {assignment.instructorNote && (
              <p className="pt-1 text-xs leading-relaxed text-[#002855]/85">
                {assignment.instructorNote}
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
                Assignment
              </TableHead>
              <TableHead className="font-semibold text-[#002855]">
                Due date
              </TableHead>
              <TableHead className="font-semibold text-[#002855]">
                Status
              </TableHead>
              <TableHead className="pr-4 text-right font-semibold text-[#002855]">
                Mark
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="py-3.5 pl-4">
                  <p className="font-semibold text-foreground">
                    {assignment.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {assignment.sessionTitle}
                    {assignment.submittedAt
                      ? ` · Submitted ${formatDisplayDate(assignment.submittedAt)}`
                      : ""}
                  </p>
                  {assignment.instructorNote && (
                    <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-[#002855]/85">
                      {assignment.instructorNote}
                    </p>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                  {formatDisplayDate(assignment.dueDate)}
                </TableCell>
                <TableCell className="py-3.5">
                  <TaskStatusBadge status={assignment.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap py-3.5 pr-4 text-right font-heading text-sm font-bold text-[#002855] tabular-nums">
                  {formatMark(assignment)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
