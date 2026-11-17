"use client";

import { useState } from "react";
import { Calendar, FolderKanban } from "lucide-react";
import { ActivityCategoryBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { formatDisplayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityCategory, MemberActivity } from "@/types";

interface ActivityListProps {
  activities: MemberActivity[];
  filterable?: boolean;
}

const FILTER_OPTIONS: readonly {
  key: "all" | ActivityCategory;
  label: string;
}[] = [
  { key: "all", label: "All activities" },
  { key: "project", label: "Projects" },
  { key: "hackathon", label: "Hackathons" },
  { key: "delivered_session", label: "Delivered sessions" },
  { key: "bonus", label: "Bonuses" },
];

export function ActivityList({
  activities,
  filterable = false,
}: ActivityListProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | ActivityCategory>(
    "all"
  );

  const visibleActivities =
    activeFilter === "all"
      ? activities
      : activities.filter((item) => item.category === activeFilter);

  return (
    <div className="space-y-4">
      {filterable && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter activities by category"
        >
          {FILTER_OPTIONS.map((option) => {
            const count =
              option.key === "all"
                ? activities.length
                : activities.filter((a) => a.category === option.key).length;
            const selected = activeFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                  selected
                    ? "border-[#772583] bg-[#772583] text-white"
                    : "border-border bg-white text-foreground/85 hover:bg-muted"
                )}
              >
                <span>{option.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    selected ? "text-white/85" : "text-muted-foreground"
                  )}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {visibleActivities.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" aria-hidden="true" />}
          title={
            activeFilter === "all"
              ? "No activities recorded yet"
              : "No activities recorded in this category"
          }
          description="Projects, hackathons, delivered sessions, and bonuses linked to your profile will appear here once recorded."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {visibleActivities.map((activity) => (
            <li key={activity.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActivityCategoryBadge category={activity.category} />
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDisplayDate(activity.date)}
                    </span>
                  </div>
                  <h4 className="font-heading text-sm font-bold text-[#002855] sm:text-base">
                    {activity.title}
                  </h4>
                  <p className="text-xs font-medium text-[#00629b]">
                    {activity.role}
                  </p>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {activity.summary}
                  </p>
                </div>

                {activity.pointsAwarded !== undefined && (
                  <span className="shrink-0 rounded-md bg-[#f5edf7] px-2.5 py-1 font-heading text-xs font-bold text-[#5a1b63] tabular-nums">
                    +{activity.pointsAwarded} pts
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
