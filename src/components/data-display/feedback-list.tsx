import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  MessageSquare,
} from "lucide-react";
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
        description="HR review notes, recognitions, and official notices shared with you will appear here once published."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const delta = item.pointsDelta ?? 0;
        const isWarning = item.reviewType === "warning";

        return (
          <li
            key={item.id}
            className={`space-y-2.5 rounded-lg border p-4 sm:p-5 ${
              isWarning
                ? "border-[#ba0c2f]/30 bg-[#ba0c2f]/[0.02]"
                : "border-border bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-sm font-bold text-[#002855]">
                  {item.authorRole}
                </span>
                <ReviewTypeBadge reviewType={item.reviewType} />
                {delta !== 0 && (
                  <span
                    className={
                      delta > 0
                        ? "inline-flex items-center gap-0.5 rounded-full border border-[#78be20]/40 bg-[#78be20]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#1e6b0a]"
                        : "inline-flex items-center gap-0.5 rounded-full border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#ba0c2f]"
                    }
                  >
                    {delta > 0 ? (
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                    )}
                    {delta > 0 ? `+${delta} pts` : `${delta} pts`}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
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
        );
      })}
    </ul>
  );
}
