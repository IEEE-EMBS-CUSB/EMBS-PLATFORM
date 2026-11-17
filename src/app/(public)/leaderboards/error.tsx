"use client";

import { ErrorState } from "@/components/states/error-state";

export default function LeaderboardsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <ErrorState
        title="Could not load monthly leaderboards"
        description="A problem occurred while retrieving published leaderboard data. Try loading this page again."
        onRetry={reset}
      />
    </div>
  );
}
