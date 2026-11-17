import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  supportingText?: string;
  accent?: "purple" | "blue" | "teal" | "neutral";
  action?: ReactNode;
  className?: string;
}

const ACCENT_VALUE_CLASS: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  purple: "text-[#772583]",
  blue: "text-[#00629b]",
  teal: "text-[#007377]",
  neutral: "text-[#002855]",
};

export function MetricCard({
  label,
  value,
  supportingText,
  accent = "neutral",
  action,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-border bg-white p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {action}
      </div>
      <p
        className={cn(
          "mt-2 font-heading text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]",
          ACCENT_VALUE_CLASS[accent]
        )}
      >
        {value}
      </p>
      {supportingText && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {supportingText}
        </p>
      )}
    </div>
  );
}
