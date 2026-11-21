"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

interface NavLinkPendingIndicatorProps {
  className?: string;
}

/**
 * Subtle, fixed-size pending dot powered by Next.js 16 `useLinkStatus`.
 * Appears only if a route transition takes longer than 100ms, avoiding flicker
 * on prefetched links while giving immediate visual confirmation on live fetches.
 */
export function NavLinkPendingIndicator({
  className,
}: NavLinkPendingIndicatorProps) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "embs-link-pending ml-auto h-2 w-2 shrink-0 rounded-full bg-current",
        pending && "is-pending",
        className
      )}
    />
  );
}
