import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { MetricCard } from "@/components/data-display/metric-card";
import { MemberTaskStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { MemberTasksLoadingState } from "@/components/states/loading-state";
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
import { getMemberTasks } from "@/services/member.service";
import { TaskSubmitForm } from "@/components/member/task-submit-form";

export const metadata: Metadata = {
  title: "Tasks & Assignments",
  description:
    "Committee assignments from leadership and tasks from HR with ratings and points.",
};

async function MemberTasksContent() {
  const session = await requireMemberSession();
  const tasks = await getMemberTasks(session.participantId);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress"
  ).length;
  const notStartedCount = tasks.filter(
    (t) => t.status === "not_started"
  ).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Tasks & Assignments
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Assignments come from Directors and Committee Heads; Tasks come from HR.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Completed" value={completedCount} accent="purple" />
        <MetricCard label="In progress" value={inProgressCount} accent="blue" />
        <MetricCard label="Not started" value={notStartedCount} />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-5 w-5" aria-hidden="true" />}
          title="No tasks assigned yet"
          description="Deliverables assigned in your committee will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {/* Mobile stacked cards */}
          <ul className="divide-y divide-border md:hidden">
            {tasks.map((task) => (
              <li key={task.id} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {task.title}
                  </p>
                  <span className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                    {task.taskPoints !== null ? `${task.taskPoints} pts` : "—"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      task.workType === "task"
                        ? "inline-flex rounded-full bg-[#f5edf7] px-2 py-0.5 text-[11px] font-semibold text-[#5a1b63]"
                        : "inline-flex rounded-full bg-[#ebf3f8] px-2 py-0.5 text-[11px] font-semibold text-[#00629b]"
                    }
                  >
                    {task.workType === "task" ? "Task" : "Assignment"}
                  </span>
                  <MemberTaskStatusBadge status={task.status} />
                  {task.onTime !== null && (
                    <span
                      className={
                        task.onTime
                          ? "text-xs font-semibold text-[#2f600b]"
                          : "text-xs font-semibold text-[#9b0b27]"
                      }
                    >
                      {task.onTime ? "On time" : "Late"}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span>Deadline {formatDisplayDate(task.dueDate)}</span>
                  <span>Effort {task.effort}/5</span>
                  {task.quality !== null && (
                    <span>Quality {task.quality}/5</span>
                  )}
                </div>

                {task.notes && (
                  <p className="text-xs text-muted-foreground">{task.notes}</p>
                )}
                {task.status !== "completed" && (
                  <TaskSubmitForm taskId={task.id} />
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
                    Deliverable
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
                    Task points
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="py-3.5 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {task.title}
                        </p>
                        <span
                          className={
                            task.workType === "task"
                              ? "inline-flex rounded-full bg-[#f5edf7] px-2 py-0.5 text-[10px] font-semibold text-[#5a1b63]"
                              : "inline-flex rounded-full bg-[#ebf3f8] px-2 py-0.5 text-[10px] font-semibold text-[#00629b]"
                          }
                        >
                          {task.workType === "task" ? "Task" : "Assignment"}
                        </span>
                      </div>
                      {(task.completedDate || task.notes) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.completedDate
                            ? `Completed ${formatDisplayDate(task.completedDate)}`
                            : ""}
                          {task.completedDate && task.notes ? " · " : ""}
                          {task.notes ?? ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                      {formatDisplayDate(task.dueDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 text-sm text-muted-foreground tabular-nums">
                      Effort {task.effort}/5
                      {task.quality !== null
                        ? ` · Quality ${task.quality}/5`
                        : ""}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <MemberTaskStatusBadge status={task.status} />
                        {task.onTime === false && (
                          <span className="text-xs font-semibold text-[#9b0b27]">
                            Late
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3.5 pr-4 text-right font-heading text-sm font-bold text-[#002855] tabular-nums">
                      {task.taskPoints !== null ? task.taskPoints : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tasks.some((t) => t.status !== "completed") && (
        <section className="hidden space-y-3 md:block">
          <h2 className="font-heading text-lg font-bold text-[#002855]">Submit deliverables</h2>
          {tasks.filter((t) => t.status !== "completed").map((task) => (
            <div key={task.id} className="rounded-lg border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{task.title}</p>
              <TaskSubmitForm taskId={task.id} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function MemberTasksPage() {
  return (
    <Suspense fallback={<MemberTasksLoadingState />}>
      <MemberTasksContent />
    </Suspense>
  );
}
