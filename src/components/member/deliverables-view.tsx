import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { MetricCard } from "@/components/data-display/metric-card";
import { MemberTaskStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { TaskCheckToggle } from "@/components/member/task-check-toggle";
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

function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
  const isCheckableTaskList =
    items.length > 0 && items.every((item) => item.workType === "task");
  const submittableAssignments = items.filter(
    (item) => item.workType !== "task" && item.status !== "completed"
  );

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
            {items.map((item) => {
              const isTask = item.workType === "task";
              const safeUrl = isSafeHttpUrl(item.submissionUrl)
                ? item.submissionUrl
                : null;
              return (
                <li key={item.id} className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <span className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                      {item.taskPoints !== null
                        ? `${item.taskPoints} pts`
                        : isTask && item.maxPoints
                          ? `0 / ${item.maxPoints} pts`
                          : "—"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MemberTaskStatusBadge status={item.status} />
                    {!isTask && item.onTime !== null && (
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
                    {!isTask && safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#00629b] underline-offset-2 hover:underline"
                      >
                        <span>Submitted link</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>Deadline {formatDisplayDate(item.dueDate)}</span>
                    {!isTask && (
                      item.effort !== null ? (
                        <>
                          <span>Effort {item.effort}/5</span>
                          {item.quality !== null && (
                            <span>Quality {item.quality}/5</span>
                          )}
                        </>
                      ) : (
                        <span>Pending grade</span>
                      )
                    )}
                    {!isTask && !item.completedDate && item.submittedDate && (
                      <span>
                        Submitted {formatDisplayDate(item.submittedDate)}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-muted-foreground">{item.notes}</p>
                  )}

                  {isTask ? (
                    item.completionMode === "hr_only" ? (
                      <span
                        className={
                          item.status === "completed"
                            ? "inline-flex items-center rounded-full bg-[#eef8e0] px-2.5 py-1 text-xs font-semibold text-[#2f600b]"
                            : "inline-flex items-center rounded-full bg-[#f5edf7] px-2.5 py-1 text-xs font-semibold text-[#5a1b63]"
                        }
                      >
                        {item.status === "completed"
                          ? "Verified by HR"
                          : "Pending HR verification"}
                      </span>
                    ) : (
                      <TaskCheckToggle
                        taskId={item.id}
                        title={item.title}
                        maxPoints={item.maxPoints}
                        initialCompleted={item.status === "completed"}
                      />
                    )
                  ) : (
                    item.status !== "completed" && (
                      <TaskSubmitForm
                        taskId={item.id}
                        requireUrl
                        initialUrl={item.submissionUrl}
                        initialText={item.submissionText}
                      />
                    )
                  )}
                </li>
              );
            })}
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
                    {isCheckableTaskList ? "Completion" : "Effort / Quality"}
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
                {items.map((item) => {
                  const isTask = item.workType === "task";
                  const safeUrl = isSafeHttpUrl(item.submissionUrl)
                    ? item.submissionUrl
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="py-3.5 pl-4">
                        <p className="font-semibold text-foreground">
                          {item.title}
                        </p>
                        {(item.completedDate ||
                          item.submittedDate ||
                          item.notes ||
                          (!isTask && safeUrl)) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {item.completedDate ? (
                              <span>
                                Completed {formatDisplayDate(item.completedDate)}
                              </span>
                            ) : item.submittedDate ? (
                              <span>
                                Submitted {formatDisplayDate(item.submittedDate)}
                              </span>
                            ) : null}
                            {item.notes && <span>{item.notes}</span>}
                            {!isTask && safeUrl && (
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#00629b] underline-offset-2 hover:underline"
                              >
                                <span>Submitted link</span>
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                        {formatDisplayDate(item.dueDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                        {isTask ? (
                          item.completionMode === "hr_only" ? (
                            <span
                              className={
                                item.status === "completed"
                                  ? "inline-flex items-center rounded-full bg-[#eef8e0] px-2.5 py-0.5 text-xs font-semibold text-[#2f600b]"
                                  : "inline-flex items-center rounded-full bg-[#f5edf7] px-2.5 py-0.5 text-xs font-semibold text-[#5a1b63]"
                              }
                            >
                              {item.status === "completed"
                                ? "Verified by HR"
                                : "Pending HR verification"}
                            </span>
                          ) : (
                            <TaskCheckToggle
                              taskId={item.id}
                              title={item.title}
                              maxPoints={item.maxPoints}
                              initialCompleted={item.status === "completed"}
                            />
                          )
                        ) : item.effort !== null ? (
                          <>
                            Effort {item.effort}/5
                            {item.quality !== null
                              ? ` · Quality ${item.quality}/5`
                              : ""}
                          </>
                        ) : (
                          <span>Pending grade</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <MemberTaskStatusBadge status={item.status} />
                          {!isTask && item.onTime === false && (
                            <span className="text-xs font-semibold text-[#9b0b27]">
                              Late
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3.5 pr-4 text-right font-heading text-sm font-bold text-[#002855] tabular-nums">
                        {item.taskPoints !== null
                          ? item.taskPoints
                          : isTask && item.maxPoints
                            ? `0 / ${item.maxPoints}`
                            : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {submittableAssignments.length > 0 && (
        <section className="hidden space-y-3 md:block">
          <h2 className="font-heading text-lg font-bold text-[#002855]">
            Submit {title.toLowerCase()}
          </h2>
          {submittableAssignments.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-white p-4"
            >
              <p className="text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <TaskSubmitForm
                taskId={item.id}
                requireUrl
                initialUrl={item.submissionUrl}
                initialText={item.submissionText}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
