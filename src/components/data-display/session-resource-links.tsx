import { ExternalLink, MapPin, Presentation, Video } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/url";
import type { SessionMode } from "@/lib/season-settings";

interface SessionResourceLinksProps {
  sessionMode?: SessionMode;
  slideDeckUrl?: string | null;
  webConferencingUrl?: string | null;
  locationUrl?: string | null;
  locationAddress?: string | null;
  className?: string;
}

export function SessionResourceLinks({
  sessionMode,
  slideDeckUrl,
  webConferencingUrl,
  locationUrl,
  locationAddress,
  className = "",
}: SessionResourceLinksProps) {
  const safeSlideDeck = isSafeHttpUrl(slideDeckUrl) ? slideDeckUrl.trim() : null;
  const safeMeeting =
    sessionMode !== "offline" && isSafeHttpUrl(webConferencingUrl)
      ? webConferencingUrl.trim()
      : null;
  const safeLocationUrl =
    sessionMode !== "online" && isSafeHttpUrl(locationUrl)
      ? locationUrl.trim()
      : null;
  const trimmedAddress =
    sessionMode !== "online" && typeof locationAddress === "string"
      ? locationAddress.trim() || null
      : null;

  if (!safeSlideDeck && !safeMeeting && !safeLocationUrl && !trimmedAddress) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {safeSlideDeck && (
        <a
          href={safeSlideDeck}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#772583]/25 bg-[#f5edf7] px-2.5 py-1 text-xs font-semibold text-[#772583] transition-colors hover:bg-[#772583] hover:text-white"
        >
          <Presentation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Slide Deck</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
        </a>
      )}
      {safeMeeting && (
        <a
          href={safeMeeting}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#00629b]/25 bg-[#ebf3f8] px-2.5 py-1 text-xs font-semibold text-[#00629b] transition-colors hover:bg-[#00629b] hover:text-white"
        >
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Join Meeting</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
        </a>
      )}
      {safeLocationUrl ? (
        <a
          href={safeLocationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#1e6b0a]/25 bg-[#eaf5dd] px-2.5 py-1 text-xs font-semibold text-[#1e6b0a] transition-colors hover:bg-[#1e6b0a] hover:text-white"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{trimmedAddress ?? "Location Map"}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
        </a>
      ) : trimmedAddress ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-[#f8f9fb] px-2.5 py-1 text-xs font-medium text-[#002855]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1e6b0a]" aria-hidden="true" />
          <span className="truncate">{trimmedAddress}</span>
        </span>
      ) : null}
    </div>
  );
}
