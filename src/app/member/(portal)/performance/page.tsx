import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { ScoreBreakdown } from "@/components/data-display/score-breakdown";
import { ScoreTrendChart } from "@/components/data-display/score-trend-chart";
import { EmptyState } from "@/components/states/empty-state";
import { MemberPerformanceLoadingState } from "@/components/states/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMemberSession } from "@/lib/portal-guards";
import { cn } from "@/lib/utils";
import { getMemberMonthlyScores } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Monthly performance",
  description:
    "Activity-based monthly score breakdown and historical standings.",
};

interface MemberPerformancePageProps {
  searchParams: Promise<{ month?: string }>;
}

async function MemberPerformanceContent({
  searchParams,
}: MemberPerformancePageProps) {
  const [{ month: requestedMonth }, session] = await Promise.all([
    searchParams,
    requireMemberSession(),
  ]);

  const scores = await getMemberMonthlyScores(session.participantId);

  if (scores.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5 border-b border-border pb-5">
          <h1 className="font-heading text-2xl font-bold text-[#002855] sm:text-3xl">
            Performance and monthly scores
          </h1>
          <p className="text-sm text-muted-foreground">
            Activity-based monthly scores across attendance, tasks, projects,
            hackathons, delivered sessions, and bonuses.
          </p>
        </div>
        <EmptyState
          title="No monthly scores recorded yet"
          description="Your monthly score breakdown will appear here after your first published cycle."
        />
      </div>
    );
  }

  const selectedRecord =
    (requestedMonth
      ? scores.find((record) => record.month === requestedMonth)
      : undefined) ?? scores[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Performance
        </h1>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#00629b]/25 bg-[#ebf3f8]/60 px-4 py-3 text-xs leading-relaxed text-[#002855]">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]"
          aria-hidden="true"
        />
        <p>
          Monthly activity scores track ongoing participation across attendance,
          tasks, assignments, and HR adjustments for monthly leaderboard standings.
        </p>
      </div>

      <ScoreTrendChart records={scores} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[#002855]">
            Inspect monthly breakdown
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {scores.map((record) => {
              const isSelected = record.month === selectedRecord.month;
              return (
                <Link
                  key={record.month}
                  href={`/member/performance?month=${record.month}`}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums",
                    isSelected
                      ? "border-[#772583] bg-[#772583] text-white"
                      : "border-border bg-white text-foreground/85 hover:bg-muted"
                  )}
                >
                  {record.monthLabel}
                </Link>
              );
            })}
          </div>
        </div>

        <ScoreBreakdown
          components={selectedRecord.components}
          totalScore={selectedRecord.totalScore}
          monthLabel={selectedRecord.monthLabel}
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-[#002855]">
          Historical monthly standings
        </h2>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/45 hover:bg-muted/45">
                  <TableHead className="pl-4 font-semibold text-[#002855]">
                    Month
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Overall rank
                  </TableHead>
                  <TableHead className="font-semibold text-[#002855]">
                    Committee rank
                  </TableHead>
                  <TableHead className="pr-4 text-right font-semibold text-[#002855]">
                    Monthly score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((record) => (
                  <TableRow key={record.month}>
                    <TableCell className="pl-4 py-3.5 font-semibold text-foreground">
                      {record.monthLabel}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums">
                      {record.overallRank !== null && record.overallTotal !== null
                        ? `#${record.overallRank} of ${record.overallTotal}`
                        : "Unranked"}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums">
                      {record.committeeRank !== null &&
                      record.committeeTotal !== null
                        ? `#${record.committeeRank} of ${record.committeeTotal}`
                        : "Unranked"}
                    </TableCell>
                    <TableCell className="pr-4 py-3.5 text-right font-heading text-base font-bold text-[#002855] tabular-nums">
                      {record.totalScore}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MemberPerformancePage({
  searchParams,
}: MemberPerformancePageProps) {
  return (
    <Suspense fallback={<MemberPerformanceLoadingState />}>
      <MemberPerformanceContent searchParams={searchParams} />
    </Suspense>
  );
}
