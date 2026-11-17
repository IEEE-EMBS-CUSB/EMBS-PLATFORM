"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to load this view",
  description = "Something interrupted loading the requested portal data. Try refreshing this section.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/25 bg-white px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="font-heading text-base font-semibold text-[#002855]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-5 gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
