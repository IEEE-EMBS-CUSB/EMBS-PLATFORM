import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Trophy, Users } from "lucide-react";
import { LeaderboardNav } from "@/components/data-display/leaderboard-nav";
import { EmptyState } from "@/components/states/empty-state";
import { formatDisplayDate } from "@/lib/format";
import {
  getCommittees,
  getLeaderboardHistory,
  getPublishedMonths,
} from "@/services/leaderboard.service";
import type { MonthKey } from "@/types";

export const metadata: Metadata = {
  title: "Previous months leaderboards",
  description:
    "Archive of published monthly leaderboards for IEEE EMBS CUSB.",
};

export default async function LeaderboardHistoryPage() {
  const [committees, months, history] = await Promise.all([
    getCommittees(),
    getPublishedMonths(),
    getLeaderboardHistory(),
  ]);

  const latestMonth = (months[0]?.month ?? "2026-10") as MonthKey;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="font-heading text-2xl font-bold text-[#002855] sm:text-3xl">
          Previous months
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4 xl:col-span-3">
          <LeaderboardNav
            committees={committees}
            months={months}
            activeMonth={latestMonth}
            isHistoryPage={true}
          />
        </div>

        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          {history.length === 0 ? (
            <EmptyState
              title="No archived months yet"
              description="Published monthly leaderboards will appear here once released."
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
              {history.map((item, index) => (
                <div
                  key={item.month}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-heading text-lg font-bold text-[#002855]">
                        {item.monthLabel}
                      </h2>
                      {index === 0 && (
                        <span className="rounded-md bg-[#f5edf7] px-2 py-0.5 text-xs font-semibold text-[#5a1b63]">
                          Latest published
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        Published {formatDisplayDate(item.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {item.committeeCount} committees represented
                      </span>
                    </div>

                    {item.topOverall && (
                      <p className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
                        <Trophy
                          className="h-4 w-4 text-[#772583]"
                          aria-hidden="true"
                        />
                        <span>Top overall:</span>
                        <span className="font-semibold">
                          {item.topOverall.memberName}
                        </span>
                        <span className="text-muted-foreground">
                          ({item.topOverall.committeeName} ·{" "}
                          <span className="font-semibold text-[#002855] tabular-nums">
                            {item.topOverall.monthlyScore}
                          </span>
                          )
                        </span>
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/leaderboards?month=${item.month}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#00629b]/30 bg-[#ebf3f8]/50 px-3.5 py-2 text-sm font-semibold text-[#002855] transition-colors hover:bg-[#ebf3f8]"
                  >
                    Open top 10
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
