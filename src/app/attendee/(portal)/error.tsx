"use client";

import { ErrorState } from "@/components/states/error-state";

export default function AttendeePortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Unable to load your attendee portal"
      description="We ran into an issue loading your session attendance or assignment marks. Try again in a moment."
      onRetry={reset}
    />
  );
}
