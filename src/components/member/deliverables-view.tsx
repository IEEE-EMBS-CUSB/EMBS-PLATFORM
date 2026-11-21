import type { ReactNode } from "react";
import { MetricCard } from "@/components/data-display/metric-card";
import { MemberTaskStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { TaskSubmitForm } from "@/components/member/task-submit-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/format";
import type { MemberTask } from "@/types";

interface MemberDeliverablesViewProps {
  title: string;
  subtitle: string;
  itemLabel: string;
  pointsColumnLabel: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  items: MemberTask[];
  accent?: "blue" | "purple";
}

export function MemberDeliverablesView({
  title,
  subtitle,
  itemLabel,
  pointsColumnLabel,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  items,
  accent = "purple",
}: MemberDeliverablesViewProps) {
  const completedCount = items.filter((t) => t.status === "completed").length;
  const inProgressCount = items.filter((t) => t.status === "in_progress").length;
  const notStartedCount = items.filter((t) => t.status === "not_started").length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          {title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Completed" value={completedCount} accent={accent} />
        <MetricCard label="In progress" value={inProgressCount} accent="blue" />
        <MetricCard label="Not started" value={notStartedCount} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {/* Mobile stacked cards */}
          <ul className="divide-y divide-border md:hidden">
            {items.map((item) => (
              <li key={item.id} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <span className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                    {item.taskPoints !== null ? `${item.taskPoints} pts` : "—"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <MemberTaskStatusBadge status={item.status} />
                  {item.onTime !== null && (
                    <span
                      className={
                        item.onTime
                          ? "text-xs font-semibold text-[#2f600b]"
                          : "text-xs font-semibold text-[#9b0b27]"
                      }
                    >
                      {item.onTime ? "On time" : "Late"}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span>Deadline {formatDisplayDate(item.dueDate)}</span>
                  <span>Effort {item.effort}/5</span>
                  {item.quality !== null && (
                    <span>Quality {item.quality}/5</span>
                  )}
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground">{item.notes}</p>
                )}
                {item.status !== "completed" && (
                  <TaskSubmitForm taskId={item.id} />
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
                    {itemLabel}
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Deadline
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Effort / Quality
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Status
                  </TableHead>
                  <TableHead className="pr-4 text-right font-semibold text-[#002855]">
                    {pointsColumnLabel}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-3.5 pl-4">
                      <p className="font-semibold text-foreground">
                        {item.title}
                      </p>
                      {(item.completedDate || item.notes) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.completedDate
                            ? `Completed ${formatDisplayDate(item.completedDate)}`
                            : ""}
                          {item.completedDate && item.notes ? " · " : ""}
                          {item.notes ?? ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                      {formatDisplayDate(item.dueDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                      Effort {item.effort}/5
                      {item.quality !== null
                        ? ` · Quality ${item.quality}/5`
                        : ""}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <MemberTaskStatusBadge status={item.status} />
                        {item.onTime === false && (
                          <span className="text-xs font-semibold text-[#9b0b27]">
                            Late
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 pr-4 text-right font-heading text-sm font-bold text-[#002855] tabular-nums">
                      {item.taskPoints !== null ? item.taskPoints : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {items.some((t) => t.status !== "completed") && (
        <section className="hidden space-y-3 md:block">
          <h2 className="font-heading text-lg font-bold text-[#002855]">
            Submit {title.toLowerCase()}
          </h2>
          {items
            .filter((t) => t.status !== "completed")
            .map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-white p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <TaskSubmitForm taskId={item.id} />
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
