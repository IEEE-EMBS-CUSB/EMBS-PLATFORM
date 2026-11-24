import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Trophy } from "lucide-react";
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
  getCommitteeLeaderboard,
  getCommittees,
  getPublishedMonths,
} from "@/services/leaderboard.service";
import type { MonthKey } from "@/types";

interface CommitteeLeaderboardPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}

export async function generateMetadata({
  params,
}: CommitteeLeaderboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const committees = await getCommittees();
  const committee = committees.find((c) => c.slug === slug);

  if (!committee) {
    return { title: "Committee not found" };
  }

  return {
    title: `${committee.name} leaderboard`,
    description: `Published top 10 monthly standings for the ${committee.name} committee at IEEE EMBS CUSB.`,
  };
}

async function CommitteeLeaderboardContent({
  params,
  searchParams,
}: CommitteeLeaderboardPageProps) {
  const [{ slug }, { month: requestedMonth }] = await Promise.all([
    params,
    searchParams,
  ]);

  const [committees, months, session] = await Promise.all([
    getCommittees(),
    getPublishedMonths(),
    getServerSession(),
  ]);

  const committee = committees.find((c) => c.slug === slug);
  if (!committee) {
    notFound();
  }

  const activeMonth = (requestedMonth ?? months[0]?.month ?? "2026-10") as MonthKey;
  const leaderboard = await getCommitteeLeaderboard(
    slug,
    requestedMonth ? (requestedMonth as MonthKey) : undefined
  );

  const highlightMemberId =
    session?.participantType === "member" ? session.participantId : undefined;

  return (
    <>
      <div className="mb-8 space-y-4 border-b border-border pb-6">
        <Link
          href={`/leaderboards?month=${leaderboard?.month ?? activeMonth}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00629b] hover:text-[#002855] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to committee leaders
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-bold text-[#002855] sm:text-3xl">
                {committee.name}
              </h1>
              <Badge
                variant="secondary"
                className={cn(
                  "font-medium",
                  committee.track === "technical"
                    ? "bg-[#e3f5f6] text-[#007377]"
                    : "bg-[#ebf3f8] text-[#00629b]"
                )}
              >
                {committee.track === "technical"
                  ? "Technical committee"
                  : "Non-technical committee"}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {committee.description}
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
                <Trophy
                  className="h-3.5 w-3.5 text-[#772583]"
                  aria-hidden="true"
                />
                Top {leaderboard.entries.length}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4 xl:col-span-3">
          <LeaderboardNav
            committees={committees}
            months={months}
            activeMonth={leaderboard?.month ?? activeMonth}
            activeCommitteeSlug={committee.slug}
          />
        </div>

        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          {leaderboard ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  {leaderboard.monthLabel} · Top {leaderboard.entries.length}{" "}
                  committee standings
                </h2>
                <Link
                  href={`/leaderboards?month=${leaderboard.month}`}
                  className="text-sm font-medium text-[#00629b] hover:text-[#002855] hover:underline"
                >
                  View all committee leaders
                </Link>
              </div>
              <RankingTable
                entries={leaderboard.entries}
                month={leaderboard.month}
                showCommittee={false}
                highlightMemberId={highlightMemberId}
              />
            </>
          ) : (
            <EmptyState
              title="Committee standings not published for this month"
              description="Only published monthly leaderboards are publicly visible. Return to the latest published month for this committee."
              action={
                <Link
                  href={`/leaderboards/committees/${committee.slug}`}
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

export default function CommitteeLeaderboardPage({
  params,
  searchParams,
}: CommitteeLeaderboardPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Suspense fallback={<LeaderboardLoadingState />}>
        <CommitteeLeaderboardContent
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
