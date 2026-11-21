import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { AttendeeAssignmentTable } from "@/components/data-display/attendee-assignment-table";
import { AttendeeSessionTable } from "@/components/data-display/attendee-session-table";
import { MetricCard } from "@/components/data-display/metric-card";
import { EmptyState } from "@/components/states/empty-state";
import { AttendeeDashboardLoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { requireAttendeeSession } from "@/lib/portal-guards";
import { getAttendeeDashboard } from "@/services/attendee.service";

export const metadata: Metadata = {
  title: "Attendee dashboard",
  description:
    "View your IEEE EMBS CUSB session attendance, assignment marks, and participation standing.",
};

async function AttendeeDashboardContent() {
  const session = await requireAttendeeSession();
  const dashboard = await getAttendeeDashboard(session.participantId);

  if (!dashboard) {
    return (
      <EmptyState
        title="Attendee profile not found"
        description="Your session is active, but no attendee record was found. Please contact HR."
      />
    );
  }

  const { profile, participation, recentSessions, recentAssignments } =
    dashboard;

  const totalMilestones =
    participation.totalSessions + participation.totalAssignments;
  const completedMilestones =
    participation.sessionsAttended + participation.assignmentsCompleted;
  const trackProgressPct =
    totalMilestones > 0
      ? Math.min(100, Math.round((completedMilestones / totalMilestones) * 100))
      : 0;
  const firstName = profile.fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold text-[#002855] sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <Badge
              variant="secondary"
              className="bg-[#ebf3f8] font-semibold text-[#002855]"
            >
              {participation.participationStanding}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.programTrack} · {profile.cohortLabel}
          </p>
        </div>
      </div>

      {/* Track completion bar */}
      <section
        aria-label="Track progress"
        className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-[#002855]">Track progress</p>
          <p className="font-heading text-sm font-bold text-[#007377] tabular-nums">
            {completedMilestones} / {totalMilestones} completed
          </p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={trackProgressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Track completion progress"
        >
          <div
            className="embs-bar-fill h-full rounded-full bg-[#00629b]"
            style={{ width: `${trackProgressPct}%` }}
          />
        </div>
        {participation.nextMilestoneNote && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00629b]"
              aria-hidden="true"
            />
            <span>{participation.nextMilestoneNote}</span>
          </p>
        )}
      </section>

      {/* Focused attendee summary metrics (no member-only metrics) */}
      <section
        aria-label="Participation summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <MetricCard
          label="Sessions attended"
          value={`${participation.sessionsAttended} / ${participation.totalSessions}`}
          supportingText="Published session attendance across your track"
          accent="blue"
          action={
            <Link
              href="/attendee/attendance"
              className="text-xs font-semibold text-[#00629b] hover:underline"
            >
              Full log
            </Link>
          }
        />

        <MetricCard
          label="Assignments completed"
          value={`${participation.assignmentsCompleted} / ${participation.totalAssignments}`}
          supportingText="Submitted and graded session assignments"
          accent="teal"
          action={
            <Link
              href="/attendee/assignments"
              className="text-xs font-semibold text-[#00629b] hover:underline"
            >
              View all
            </Link>
          }
        />

        <MetricCard
          label="Assignment marks"
          value={participation.marksSummaryLabel}
          supportingText="Total graded marks recorded for your track"
          accent="purple"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-bold text-[#002855]">
            Recent session attendance
          </h2>
          <Link
            href="/attendee/attendance"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
          >
            All sessions
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <AttendeeSessionTable sessions={recentSessions} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-bold text-[#002855]">
            Recent assignments and marks
          </h2>
          <Link
            href="/attendee/assignments"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
          >
            All assignments
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <AttendeeAssignmentTable assignments={recentAssignments} />
      </section>
    </div>
  );
}

export default function AttendeeDashboardPage() {
  return (
    <Suspense fallback={<AttendeeDashboardLoadingState />}>
      <AttendeeDashboardContent />
    </Suspense>
  );
}
