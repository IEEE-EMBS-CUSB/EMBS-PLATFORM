"use client";

import { ErrorState } from "@/components/states/error-state";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-12 sm:px-6">
      <ErrorState
        title="Something went wrong"
        description="An unexpected error occurred while rendering this page. Please try again."
        onRetry={reset}
      />
    </div>
  );
}
