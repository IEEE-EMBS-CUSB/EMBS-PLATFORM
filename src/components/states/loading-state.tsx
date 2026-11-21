import { Skeleton } from "@/components/ui/skeleton";

function HeaderBarSkeleton({
  actions = 0,
  subtitle = true,
}: {
  actions?: number;
  subtitle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        {subtitle && <Skeleton className="h-4 w-80 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actions }).map((_, idx) => (
            <Skeleton key={idx} className="h-10 w-32 rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableLoadingState({
  rows = 6,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-white"
      aria-busy="true"
      aria-label="Loading table data"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border bg-[#f8f9fb] px-4 py-3">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton
            key={colIdx}
            className={colIdx === 0 ? "h-3.5 w-32" : "hidden h-3.5 w-20 sm:block"}
          />
        ))}
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 px-4 py-3.5"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-3 w-28 max-w-full" />
            </div>
            {Array.from({ length: Math.max(1, columns - 2) }).map((_, idx) => (
              <Skeleton
                key={idx}
                className="hidden h-4 w-24 shrink-0 md:block"
              />
            ))}
            <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <HeaderBarSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-border bg-white p-4 sm:p-5"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <TableLoadingState rows={6} />
    </div>
  );
}

/** HR Overview: Header + 4 KPI tiles + 3 operational action cards */
export function HrOverviewLoadingState() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Loading HR overview"
    >
      <HeaderBarSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-border bg-white p-4 sm:p-5"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border bg-white p-5"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="mt-2 h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** HR Seasons & Attendance: Header + CTA + responsive 3-column card grid */
export function HrCardGridLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading items">
      <HeaderBarSkeleton actions={1} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-lg border border-border bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 border-y border-border/70 py-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** HR Committees & Rubrics: Header + 2 actions + committee grid + rubrics table */
export function HrCommitteesLoadingState() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Loading committees and rubrics"
    >
      <HeaderBarSkeleton actions={2} />
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="space-y-2.5 rounded-lg border border-border bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <TableLoadingState rows={4} columns={4} />
      </div>
    </div>
  );
}

/** HR Roster: Header + Add/CSV buttons + search bar + roster table */
export function HrRosterLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading roster">
      <HeaderBarSkeleton actions={2} />
      <Skeleton className="h-11 w-full rounded-md" />
      <TableLoadingState rows={7} columns={5} />
    </div>
  );
}

/** HR Tasks: Task delegation card + divider + bulk grading table */
export function HrTasksLoadingState() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading tasks">
      <HeaderBarSkeleton />
      <div className="space-y-4 rounded-lg border border-border bg-white p-5">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-md" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
      <div className="space-y-4 border-t border-border pt-6">
        <HeaderBarSkeleton actions={1} subtitle={false} />
        <TableLoadingState rows={5} columns={5} />
      </div>
    </div>
  );
}

/** HR Points Ledger: Header + button + search/filter bar + ledger table */
export function HrLedgerLoadingState() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading points ledger"
    >
      <HeaderBarSkeleton actions={1} />
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-full rounded-md sm:w-44" />
        </div>
      </div>
      <TableLoadingState rows={6} columns={5} />
    </div>
  );
}

/** HR Feedback: Header + button + privacy banner + filter bar + stacked cards */
export function HrFeedbackLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading feedback">
      <HeaderBarSkeleton actions={1} />
      <div className="rounded-lg border border-border bg-white p-4">
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-lg border border-border bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** HR Publishing: Header + month picker/publish CTA + status banner + standings */
export function HrPublishingLoadingState() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading leaderboard publishing"
    >
      <HeaderBarSkeleton actions={2} />
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <TableLoadingState rows={5} columns={4} />
      <div className="grid gap-6 md:grid-cols-2">
        <TableLoadingState rows={3} columns={3} />
        <TableLoadingState rows={3} columns={3} />
      </div>
    </div>
  );
}

/** Member Dashboard: Header + engagement strip + unified 4-stat summary + breakdown + 2-col bottom */
export function MemberDashboardLoadingState() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Loading member dashboard"
    >
      <HeaderBarSkeleton actions={1} />
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-1.5 p-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-2 p-5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 border-t border-border bg-[#f8f9fb] px-5 py-3.5 sm:grid-cols-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-7">
          <Skeleton className="h-5 w-32" />
          <TableLoadingState rows={3} columns={3} />
        </div>
        <div className="space-y-3 xl:col-span-5">
          <Skeleton className="h-5 w-36" />
          <TableLoadingState rows={3} columns={2} />
        </div>
      </div>
    </div>
  );
}

/** Member Performance: Header + info note + chart card + breakdown + history table */
export function MemberPerformanceLoadingState() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading performance"
    >
      <HeaderBarSkeleton actions={1} subtitle={false} />
      <div className="rounded-lg border border-border bg-white p-5 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-44 w-full rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <TableLoadingState rows={4} columns={4} />
    </div>
  );
}

/** Member & Attendee Attendance: Header + optional check-in card + 4 stat tiles + log */
export function MemberAttendanceLoadingState({
  showCheckin = true,
}: {
  showCheckin?: boolean;
}) {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading attendance"
    >
      <HeaderBarSkeleton subtitle={false} />
      {showCheckin && (
        <div className="space-y-3 rounded-lg border border-border bg-white p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-md" />
            <Skeleton className="h-11 w-full rounded-md sm:w-32" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-lg border border-border bg-white p-4 sm:p-5"
          >
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <TableLoadingState rows={5} columns={4} />
    </div>
  );
}

/** Member Tasks & Attendee Assignments: Header + 3 stat tiles + table */
export function MemberTasksLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tasks">
      <HeaderBarSkeleton subtitle={false} />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-lg border border-border bg-white p-4 sm:p-5"
          >
            <Skeleton className="h-3.5 w-20 max-w-full" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <TableLoadingState rows={5} columns={4} />
    </div>
  );
}

/** Member Activities, Evaluations, Feedback: Header + clean stacked record cards */
export function MemberListLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading records">
      <HeaderBarSkeleton />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-lg border border-border bg-white p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Attendee Dashboard: Header + 3 metric cards + 2-column summary */
export function AttendeeDashboardLoadingState() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading attendee dashboard"
    >
      <HeaderBarSkeleton />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-lg border border-border bg-white p-5"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TableLoadingState rows={4} columns={3} />
        <TableLoadingState rows={4} columns={3} />
      </div>
    </div>
  );
}

/** Public Leaderboards: Header + badges + 12-col sidebar filter & ranking table */
export function LeaderboardLoadingState() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading leaderboard"
    >
      <HeaderBarSkeleton actions={2} subtitle={false} />
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-3 rounded-lg border border-border bg-white p-4 lg:col-span-4 xl:col-span-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="space-y-2 border-t border-border pt-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-32" />
          </div>
          <TableLoadingState rows={8} columns={4} />
        </div>
      </div>
    </div>
  );
}
