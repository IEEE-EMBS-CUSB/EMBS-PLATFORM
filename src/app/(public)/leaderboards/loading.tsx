import { LeaderboardLoadingState } from "@/components/states/loading-state";

export default function LeaderboardsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <LeaderboardLoadingState />
    </div>
  );
}
