import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Crown } from "lucide-react";
import { LeaderboardNav } from "@/components/data-display/leaderboard-nav";
import { RankingTable } from "@/components/data-display/ranking-table";
import { EmptyState } from "@/components/states/empty-state";
import { LeaderboardLoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/format";
import { getServerSession } from "@/lib/session-cookie";
import { cn } from "@/lib/utils";
import {
  getCommittees,
  getHeadsLeaderboard,
  getPublishedMonths,
} from "@/services/leaderboard.service";
import type { MonthKey } from "@/types";

export const metadata: Metadata = {
  title: "Committee Heads Leaderboard",
  description:
    "Published monthly rankings for IEEE EMBS CUSB Committee Heads.",
};

interface HeadsLeaderboardPageProps {
  searchParams: Promise<{ month?: string }>;
}

async function HeadsLeaderboardContent({
  searchParams,
}: HeadsLeaderboardPageProps) {
  const { month: requestedMonth } = await searchParams;

  const [committees, months, session] = await Promise.all([
    getCommittees(),
    getPublishedMonths(),
    getServerSession(),
  ]);

  const activeMonth = (requestedMonth ?? months[0]?.month ?? "2026-10") as MonthKey;
  const leaderboard = await getHeadsLeaderboard(
    requestedMonth ? (requestedMonth as MonthKey) : undefined
  );

  const highlightMemberId =
    session?.participantType === "member" ? session.participantId : undefined;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#002855] sm:text-3xl">
            Committee Heads Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Published monthly standings derived from Committee Head deliverables,
            attendance, and chapter tasks.
          </p>
        </div>

        {leaderboard && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="gap-1.5 bg-[#ebf3f8] text-[#002855] font-medium"
            >
              <Calendar
                className="h-3.5 w-3.5 text-[#00629b]"
                aria-hidden="true"
              />
              Published {formatDisplayDate(leaderboard.publishedAt)}
            </Badge>
            <Badge variant="outline" className="gap-1.5 font-medium">
              <Crown
                className="h-3.5 w-3.5 text-[#772583]"
                aria-hidden="true"
              />
              Top {leaderboard.entries.length}
            </Badge>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4 xl:col-span-3">
          <LeaderboardNav
            committees={committees}
            months={months}
            activeMonth={leaderboard?.month ?? activeMonth}
            isHeadsPage
          />
        </div>

        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          {leaderboard ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  {leaderboard.monthLabel} · Committee Heads ({leaderboard.entries.length})
                </h2>
                <Link
                  href={`/leaderboards?month=${leaderboard.month}`}
                  className="text-sm font-medium text-[#00629b] hover:text-[#002855] hover:underline"
                >
                  View overall rankings
                </Link>
              </div>
              <RankingTable
                entries={leaderboard.entries}
                month={leaderboard.month}
                showCommittee={true}
                highlightMemberId={highlightMemberId}
              />
            </>
          ) : (
            <EmptyState
              title="Heads leaderboard not published for this month"
              description="Only published monthly leaderboards are publicly visible. Select a published month from the navigation panel to view Committee Head standings."
              action={
                <Link
                  href="/leaderboards/heads"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-[#772583] text-white hover:bg-[#5a1b63]"
                  )}
                >
                  View latest published month
                </Link>
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function HeadsLeaderboardPage({
  searchParams,
}: HeadsLeaderboardPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Suspense fallback={<LeaderboardLoadingState />}>
        <HeadsLeaderboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
