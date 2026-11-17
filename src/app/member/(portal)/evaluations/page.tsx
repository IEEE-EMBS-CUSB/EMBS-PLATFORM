import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Award, Calendar, Info } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { PageLoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/lib/format";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberEvaluations } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Seasonal evaluation",
  description:
    "HR seasonal evaluation results separate from monthly activity scores.",
};

async function MemberEvaluationsContent() {
  const session = await requireMemberSession();
  const evaluations = await getMemberEvaluations(session.participantId);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Seasonal evaluation
        </h1>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#00629b]/25 bg-[#ebf3f8]/60 px-4 py-3 text-xs leading-relaxed text-[#002855]">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]"
          aria-hidden="true"
        />
        <p>
          Seasonal evaluations are separate from{" "}
          <Link
            href="/member/performance"
            className="font-semibold text-[#00629b] underline"
          >
            monthly activity scores
          </Link>{" "}
          and monthly leaderboard rankings.
        </p>
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon={<Award className="h-5 w-5" aria-hidden="true" />}
          title="No published evaluations yet"
          description="Seasonal evaluation results will appear here once finalized and published by HR."
        />
      ) : (
        <div className="space-y-6">
          {evaluations.map((evaluation) => (
            <article
              key={evaluation.id}
              className="overflow-hidden rounded-lg border border-border bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-[#f8f9fb] p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-bold text-[#002855]">
                      {evaluation.seasonLabel}
                    </h2>
                    {evaluation.grade && (
                      <Badge className="bg-[#772583] font-semibold text-white">
                        {evaluation.grade}
                      </Badge>
                    )}
                  </div>
                  <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      Published {formatDisplayDate(evaluation.publishedAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Evaluator: {evaluation.evaluatorRole}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    Final score
                  </p>
                  <p className="font-heading text-2xl font-bold text-[#772583] tabular-nums">
                    {evaluation.finalScore !== null
                      ? `${evaluation.finalScore}`
                      : "Pending"}
                    {evaluation.finalScore !== null && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / {evaluation.outOf}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border">
                {evaluation.criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                  >
                    <div className="min-w-0">
                      <dt className="text-sm font-medium text-foreground">
                        {criterion.label}
                      </dt>
                      {criterion.ratingOutOfFive !== undefined &&
                        criterion.ratingOutOfFive !== null && (
                          <dd className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            HR rating: {criterion.ratingOutOfFive} / 5
                          </dd>
                        )}
                    </div>
                    <dd className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                      {criterion.earned !== null
                        ? `${criterion.earned} / ${criterion.max}`
                        : `— / ${criterion.max}`}
                    </dd>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 bg-[#f8f9fb] px-4 py-3.5 sm:px-5">
                  <dt className="text-sm font-semibold text-[#002855]">
                    Bonus points included
                  </dt>
                  <dd className="font-heading text-sm font-bold text-[#2f600b] tabular-nums">
                    +{evaluation.bonusPoints}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemberEvaluationsPage() {
  return (
    <Suspense fallback={<PageLoadingState />}>
      <MemberEvaluationsContent />
    </Suspense>
  );
}
