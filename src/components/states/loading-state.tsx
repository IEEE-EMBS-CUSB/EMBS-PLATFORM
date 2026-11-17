import { Skeleton } from "@/components/ui/skeleton";

export function TableLoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="rounded-lg border border-border bg-white p-4 space-y-3"
      aria-busy="true"
      aria-label="Loading table data"
    >
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 py-2"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function PageLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-white p-5 space-y-2"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <TableLoadingState rows={6} />
    </div>
  );
}
