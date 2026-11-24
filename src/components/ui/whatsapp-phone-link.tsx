"use client";

import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl, formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface WhatsAppPhoneLinkProps {
  phoneNumber: string | null | undefined;
  personName?: string;
  className?: string;
}

export function WhatsAppPhoneLink({
  phoneNumber,
  personName,
  className,
}: WhatsAppPhoneLinkProps) {
  const url = buildWhatsAppUrl(phoneNumber);
  if (!url) return null;

  const formatted = formatPhoneDisplay(phoneNumber);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={
        personName
          ? `Message ${personName} on WhatsApp (${formatted})`
          : `Message ${formatted} on WhatsApp`
      }
      title="Message on WhatsApp"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#1e6b0a] transition-colors hover:text-[#78be20] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e6b0a]",
        className
      )}
    >
      <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{formatted}</span>
    </a>
  );
}
