import Image from "next/image";
import { cn } from "@/lib/utils";

interface EmbsMarkProps {
  compact?: boolean;
  inverted?: boolean;
  className?: string;
}

/**
 * Official IEEE EMBS Cairo University Student Branch logo mark.
 * Uses a single locked header size (h-9) across all pages so logo position never shifts.
 */
export function EmbsMark({
  compact = false,
  inverted = false,
  className,
}: EmbsMarkProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src="/ieee-embs-logo.png"
        alt="IEEE EMBS Cairo University Student Branch"
        width={compact ? 82 : 92}
        height={compact ? 32 : 36}
        priority
        className={cn(
          "w-auto object-contain",
          compact ? "h-8" : "h-9",
          inverted && "brightness-0 invert"
        )}
      />
    </span>
  );
}
