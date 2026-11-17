import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry, MonthKey } from "@/types";

interface RankingTableProps {
  entries: LeaderboardEntry[];
  month: MonthKey;
  showCommittee?: boolean;
  highlightMemberId?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#ffc627]/35 font-heading text-xs font-bold text-[#002855] ring-1 ring-[#ffc627]/80 tabular-nums">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#f5edf7] font-heading text-xs font-bold text-[#5a1b63] ring-1 ring-[#772583]/25 tabular-nums">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#ebf3f8] font-heading text-xs font-bold text-[#002855] ring-1 ring-[#00629b]/25 tabular-nums">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-semibold text-muted-foreground tabular-nums">
      {rank}
    </span>
  );
}

function RankDelta({
  rank,
  previousRank,
}: {
  rank: number;
  previousRank: number | null;
}) {
  if (previousRank === null) {
    return (
      <span className="text-xs font-medium text-muted-foreground">New</span>
    );
  }

  const delta = previousRank - rank;
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#3f7a12] tabular-nums">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#ba0c2f] tabular-nums">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      <Minus className="h-3.5 w-3.5" aria-hidden="true" />0
    </span>
  );
}

function YouPill() {
  return (
    <span className="inline-flex items-center rounded bg-[#772583] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
      You
    </span>
  );
}

export function RankingTable({
  entries,
  month,
  showCommittee = true,
  highlightMemberId,
}: RankingTableProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
        title="No published rankings available"
        description="Published monthly standings for this selection have not been released yet."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Mobile-first stacked rows (zero horizontal scroll) */}
      <ol className="divide-y divide-border md:hidden">
        {entries.map((entry) => {
          const isHighlighted = highlightMemberId === entry.memberId;
          const isFirst = entry.rank === 1 && !isHighlighted;
          return (
            <li
              key={entry.memberId}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3.5 transition-colors",
                isHighlighted && "bg-[#f5edf7]/70",
                isFirst && "bg-[#ffc627]/[0.06]"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <RankBadge rank={entry.rank} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="truncate">{entry.memberName}</span>
                    {isHighlighted && <YouPill />}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{entry.role}</span>
                    {showCommittee && (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link
                          href={`/leaderboards/committees/${entry.committeeSlug}?month=${month}`}
                          className="font-medium text-[#00629b] hover:underline"
                        >
                          {entry.committeeName}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-heading text-base font-bold text-[#002855] tabular-nums">
                  {entry.monthlyScore}
                </span>
                <RankDelta
                  rank={entry.rank}
                  previousRank={entry.previousRank}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/45 hover:bg-muted/45">
              <TableHead className="w-20 pl-4 font-semibold text-[#002855]">
                Rank
              </TableHead>
              <TableHead className="font-semibold text-[#002855]">
                Member
              </TableHead>
              {showCommittee && (
                <TableHead className="font-semibold text-[#002855]">
                  Committee
                </TableHead>
              )}
              <TableHead className="w-24 font-semibold text-[#002855]">
                Trend
              </TableHead>
              <TableHead className="w-28 pr-4 text-right font-semibold text-[#002855]">
                Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const isHighlighted = highlightMemberId === entry.memberId;
              const isFirst = entry.rank === 1 && !isHighlighted;
              return (
                <TableRow
                  key={entry.memberId}
                  className={cn(
                    "transition-colors",
                    isHighlighted && "bg-[#f5edf7]/65 hover:bg-[#f5edf7]/85",
                    isFirst && "bg-[#ffc627]/[0.06] hover:bg-[#ffc627]/[0.11]"
                  )}
                >
                  <TableCell className="py-3.5 pl-4">
                    <RankBadge rank={entry.rank} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex flex-col">
                      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                        {entry.memberName}
                        {isHighlighted && <YouPill />}
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {entry.role}
                      </span>
                    </div>
                  </TableCell>
                  {showCommittee && (
                    <TableCell className="py-3.5">
                      <Link
                        href={`/leaderboards/committees/${entry.committeeSlug}?month=${month}`}
                        className="text-sm font-medium text-[#00629b] hover:text-[#002855] hover:underline"
                      >
                        {entry.committeeName}
                      </Link>
                    </TableCell>
                  )}
                  <TableCell className="py-3.5">
                    <RankDelta
                      rank={entry.rank}
                      previousRank={entry.previousRank}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-right">
                    <span className="font-heading text-base font-bold text-[#002855] tabular-nums">
                      {entry.monthlyScore}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
