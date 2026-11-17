import { Calendar, MessageSquare } from "lucide-react";
import { ReviewTypeBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { formatDisplayDate } from "@/lib/format";
import type { PublishedFeedback } from "@/types";

interface FeedbackListProps {
  items: PublishedFeedback[];
}

export function FeedbackList({ items }: FeedbackListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
        title="No published feedback yet"
        description="HR review notes and committee feedback shared with you will appear here once published."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-sm font-bold text-[#002855]">
                {item.authorRole}
              </span>
              <ReviewTypeBadge reviewType={item.reviewType} />
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDisplayDate(item.publishedAt)}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/90">
            {item.message}
          </p>
          {item.decision && (
            <p className="text-xs font-semibold text-[#00629b]">
              Outcome: {item.decision}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
