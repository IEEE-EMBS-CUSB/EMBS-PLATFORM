import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { ActivityList } from "@/components/data-display/activity-list";
import { FeedbackList } from "@/components/data-display/feedback-list";
import { ScoreBreakdown } from "@/components/data-display/score-breakdown";
import { MemberEngagementCard } from "@/components/data-display/member-engagement-card";
import { EmptyState } from "@/components/states/empty-state";
import { PageLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberDashboard } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Member dashboard",
  description:
    "Personal IEEE EMBS CUSB member dashboard with monthly score, rankings, attendance, tasks, activities, and published feedback.",
};

async function MemberDashboardContent() {
  const session = await requireMemberSession();
  const dashboard = await getMemberDashboard(session.participantId);

  if (!dashboard) {
    return (
      <EmptyState
        title="Member profile not found"
        description="Your session is active, but no member record was found. Please contact HR."
      />
    );
  }

  const { profile, currentMonthScore } = dashboard;

  const overallRankText =
    currentMonthScore?.overallRank !== null &&
    currentMonthScore?.overallRank !== undefined
      ? `#${currentMonthScore.overallRank}`
      : "-";

  const committeeRankText =
    currentMonthScore?.committeeRank !== null &&
    currentMonthScore?.committeeRank !== undefined
      ? `#${currentMonthScore.committeeRank}`
      : "-";

  const firstName = profile.fullName.split(" ")[0];
  const rankClimb =
    currentMonthScore?.overallRank !== null &&
    currentMonthScore?.overallRank !== undefined &&
    currentMonthScore.previousOverallRank !== null
      ? currentMonthScore.previousOverallRank - currentMonthScore.overallRank
      : 0;

  return (
    <div className="space-y-8">
      {/* Quiet page header with earned momentum cue */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold text-[#002855]">
              Welcome back, {firstName}
            </h1>
            {rankClimb > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf5dd] px-2.5 py-0.5 text-xs font-semibold text-[#2f600b] tabular-nums">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Up {rankClimb} {rankClimb === 1 ? "spot" : "spots"} overall
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.committee.name} · {profile.role}
            {currentMonthScore ? ` · ${currentMonthScore.monthLabel}` : ""}
          </p>
        </div>

        <Link
          href={`/leaderboards/committees/${profile.committee.slug}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
        >
          Committee leaderboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Real-time Middle-80% Member Engagement Progress */}
      {dashboard.engagement && (
        <MemberEngagementCard {...dashboard.engagement} />
      )}

      {/* Single unified summary band instead of 7 separate metric boxes */}
      <section
        aria-label="Monthly standing"
        className="overflow-hidden rounded-lg border border-border bg-white"
      >
        <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-medium text-muted-foreground">
              Monthly score
            </p>
            <p className="mt-1.5 font-heading text-2xl font-bold text-[#772583] tabular-nums">
              {currentMonthScore ? currentMonthScore.totalScore : "-"}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-muted-foreground">
              Overall rank
            </p>
            <p className="mt-1.5 font-heading text-2xl font-bold text-[#002855] tabular-nums">
              {overallRankText}
              {currentMonthScore?.overallTotal && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {currentMonthScore.overallTotal}
                </span>
              )}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-muted-foreground">
              {profile.committee.shortName} rank
            </p>
            <p className="mt-1.5 font-heading text-2xl font-bold text-[#00629b] tabular-nums">
              {committeeRankText}
              {currentMonthScore?.committeeTotal && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {currentMonthScore.committeeTotal}
                </span>
              )}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Bonuses</p>
            <p className="mt-1.5 font-heading text-2xl font-bold text-[#007377] tabular-nums">
              {dashboard.bonusesPoints > 0
                ? `+${dashboard.bonusesPoints}`
                : "0"}
            </p>
          </div>
        </div>

        {/* Quiet inline operational links */}
        <div className="grid gap-3 border-t border-border bg-[#f8f9fb] px-5 py-3.5 text-sm sm:grid-cols-3">
          <Link
            href="/member/attendance"
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:text-[#772583]"
          >
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-semibold text-[#002855] tabular-nums">
              {dashboard.attendanceSummary.summaryLabel}
            </span>
          </Link>

          <Link
            href="/member/tasks"
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:text-[#772583]"
          >
            <span className="text-muted-foreground">Tasks</span>
            <span className="font-semibold text-[#002855] tabular-nums">
              {dashboard.taskSummary.summaryLabel}
            </span>
          </Link>

          <Link
            href="/member/activities"
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:text-[#772583]"
          >
            <span className="text-muted-foreground">Projects & hackathons</span>
            <span className="font-semibold text-[#002855] tabular-nums">
              {dashboard.projectAndHackathonCount}
            </span>
          </Link>
        </div>
      </section>

      {/* Compact performance breakdown */}
      {currentMonthScore && (
        <section aria-label="Performance breakdown" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-bold text-[#002855]">
              Performance breakdown
            </h2>
            <Link
              href="/member/performance"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
            >
              Monthly history
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ScoreBreakdown
            components={currentMonthScore.components}
            totalScore={currentMonthScore.totalScore}
            monthLabel={currentMonthScore.monthLabel}
            compact={true}
          />
        </section>
      )}

      {/* Activity + Feedback */}
      <div className="grid gap-8 xl:grid-cols-12">
        <section className="space-y-3 xl:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-bold text-[#002855]">
              Recent activity
            </h2>
            <Link
              href="/member/activities"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
            >
              All activities
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ActivityList activities={dashboard.recentActivities.slice(0, 3)} />
        </section>

        <section className="space-y-3 xl:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-bold text-[#002855]">
              Published feedback
            </h2>
            <Link
              href="/member/feedback"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
            >
              All feedback
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <FeedbackList items={dashboard.recentFeedback} />
        </section>
      </div>
    </div>
  );
}

export default function MemberDashboardPage() {
  return (
    <Suspense fallback={<PageLoadingState />}>
      <MemberDashboardContent />
    </Suspense>
  );
}
