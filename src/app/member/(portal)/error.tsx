"use client";

import { ErrorState } from "@/components/states/error-state";

export default function MemberPortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Unable to load your member portal"
      description="We ran into an issue loading your portal records. Try again or return to the dashboard."
      onRetry={reset}
    />
  );
}
