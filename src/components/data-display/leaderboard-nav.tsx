import Link from "next/link";
import { Calendar, ChevronDown, Crown, History } from "lucide-react";
import { groupCommitteesByTrack } from "@/lib/committee-catalog";
import { cn } from "@/lib/utils";
import type { Committee, MonthKey, PublishedMonthOption } from "@/types";

const TRACK_HEADER_COLORS = [
  "text-[#007377]",
  "text-[#772583]",
  "text-[#00629b]",
  "text-[#5a1b63]",
] as const;

interface LeaderboardNavProps {
  committees: Committee[];
  months: PublishedMonthOption[];
  activeMonth: MonthKey;
  activeCommitteeSlug?: string;
  isHistoryPage?: boolean;
}

export function LeaderboardNav({
  committees,
  months,
  activeMonth,
  activeCommitteeSlug,
  isHistoryPage = false,
}: LeaderboardNavProps) {
  const trackGroups = groupCommitteesByTrack(committees);
  const activeCommittee = committees.find((c) => c.slug === activeCommitteeSlug);

  const monthBaseHref = activeCommitteeSlug
    ? `/leaderboards/committees/${activeCommitteeSlug}`
    : "/leaderboards";

  const isLeadersActive = !activeCommitteeSlug && !isHistoryPage;

  return (
    <aside aria-label="Leaderboard navigation">
      {/* Mobile-first compact control strip so standings appear above the fold */}
      <div className="space-y-3 lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/leaderboards?month=${activeMonth}`}
            aria-current={isLeadersActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors sm:text-sm",
              isLeadersActive
                ? "border-[#772583] bg-[#772583] text-white"
                : "border-border bg-white text-foreground"
            )}
          >
            <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
            Committee leaders
          </Link>
          <Link
            href="/leaderboards/history"
            aria-current={isHistoryPage ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors sm:text-sm",
              isHistoryPage
                ? "border-[#772583] bg-[#772583] text-white"
                : "border-border bg-white text-foreground"
            )}
          >
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            History
          </Link>
        </div>

        {!isHistoryPage && months.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {months.map((option) => {
              const selected = option.month === activeMonth;
              return (
                <Link
                  key={option.month}
                  href={`${monthBaseHref}?month=${option.month}`}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-semibold transition-colors tabular-nums",
                    selected
                      ? "border-[#00629b] bg-[#ebf3f8] text-[#002855]"
                      : "border-border bg-white text-muted-foreground"
                  )}
                >
                  {option.monthLabel}
                </Link>
              );
            })}
          </div>
        )}

        <details className="group rounded-lg border border-border bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-semibold text-[#002855]">
            <span className="truncate">
              {activeCommittee
                ? `Committee: ${activeCommittee.name}`
                : `Filter by committee (${committees.length})`}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-4 border-t border-border p-3">
            {trackGroups.map((group, idx) => (
              <div
                key={group.slug}
                className={cn(
                  "space-y-1",
                  idx > 0 && "border-t border-border pt-3"
                )}
              >
                <p
                  className={cn(
                    "px-2 text-xs font-semibold",
                    TRACK_HEADER_COLORS[idx % TRACK_HEADER_COLORS.length]
                  )}
                >
                  {group.name}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.committees.map((committee) => {
                    const isActive = activeCommitteeSlug === committee.slug;
                    return (
                      <Link
                        key={committee.id}
                        href={`/leaderboards/committees/${committee.slug}?month=${activeMonth}`}
                        className={cn(
                          "flex min-h-10 items-center rounded-md px-2.5 text-sm",
                          isActive
                            ? "bg-[#f5edf7] font-semibold text-[#5a1b63]"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        {committee.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Desktop persistent sidebar */}
      <div className="hidden space-y-6 rounded-lg border border-border bg-white p-4 lg:block">
        <div className="space-y-1.5">
          <p className="px-2 text-xs font-semibold text-muted-foreground">
            Standings views
          </p>
          <nav className="space-y-1">
            <Link
              href={`/leaderboards?month=${activeMonth}`}
              aria-current={isLeadersActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isLeadersActive
                  ? "bg-[#772583] text-white"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
              Committee leaders
            </Link>
            <Link
              href="/leaderboards/history"
              aria-current={isHistoryPage ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isHistoryPage
                  ? "bg-[#772583] text-white"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <History className="h-4 w-4 shrink-0" aria-hidden="true" />
              Previous months
            </Link>
          </nav>
        </div>

        {!isHistoryPage && months.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Published month
            </p>
            <div className="flex flex-wrap gap-1.5 px-1">
              {months.map((option) => {
                const selected = option.month === activeMonth;
                return (
                  <Link
                    key={option.month}
                    href={`${monthBaseHref}?month=${option.month}`}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                      selected
                        ? "border-[#00629b] bg-[#ebf3f8] text-[#002855] font-semibold"
                        : "border-border bg-white text-muted-foreground hover:border-[#00629b]/40 hover:text-foreground"
                    )}
                  >
                    {option.monthLabel}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          {trackGroups.map((group, idx) => (
            <div
              key={group.slug}
              className={cn(
                "space-y-1",
                idx > 0 && "border-t border-border/70 pt-2"
              )}
            >
              <p
                className={cn(
                  "px-2 text-xs font-semibold",
                  TRACK_HEADER_COLORS[idx % TRACK_HEADER_COLORS.length]
                )}
              >
                {group.name}
              </p>
              <ul className="space-y-0.5">
                {group.committees.map((committee) => {
                  const isActive = activeCommitteeSlug === committee.slug;
                  return (
                    <li key={committee.id}>
                      <Link
                        href={`/leaderboards/committees/${committee.slug}?month=${activeMonth}`}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-[#f5edf7] font-semibold text-[#5a1b63]"
                            : "text-foreground/85 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {committee.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
