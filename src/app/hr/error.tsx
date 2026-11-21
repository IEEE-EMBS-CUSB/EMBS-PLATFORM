"use client";

import { ErrorState } from "@/components/states/error-state";

export default function HrError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ErrorState
        title="Unable to load HR Operations Console"
        description="Something went wrong while loading this operational view. Try again or return to the HR overview."
        onRetry={reset}
      />
    </div>
  );
}
