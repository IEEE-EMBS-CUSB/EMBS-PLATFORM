import { ExternalLink, Presentation, Video } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/url";

interface SessionResourceLinksProps {
  slideDeckUrl?: string | null;
  webConferencingUrl?: string | null;
  className?: string;
}

export function SessionResourceLinks({
  slideDeckUrl,
  webConferencingUrl,
  className = "",
}: SessionResourceLinksProps) {
  const safeSlideDeck = isSafeHttpUrl(slideDeckUrl) ? slideDeckUrl.trim() : null;
  const safeMeeting = isSafeHttpUrl(webConferencingUrl)
    ? webConferencingUrl.trim()
    : null;

  if (!safeSlideDeck && !safeMeeting) {
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
    </div>
  );
}
