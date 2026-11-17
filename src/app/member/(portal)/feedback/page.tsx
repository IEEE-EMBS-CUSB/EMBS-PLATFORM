import { Suspense } from "react";
import type { Metadata } from "next";
import { FeedbackList } from "@/components/data-display/feedback-list";
import { PageLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberFeedback } from "@/services/member.service";

export const metadata: Metadata = {
  title: "Published feedback",
  description:
    "Published feedback shared with you by committee heads and HR reviewers.",
};

async function MemberFeedbackContent() {
  const session = await requireMemberSession();
  const feedback = await getMemberFeedback(session.participantId);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold text-[#002855]">
          Feedback
        </h1>
      </div>

      <FeedbackList items={feedback} />
    </div>
  );
}

export default function MemberFeedbackPage() {
  return (
    <Suspense fallback={<PageLoadingState />}>
      <MemberFeedbackContent />
    </Suspense>
  );
}
