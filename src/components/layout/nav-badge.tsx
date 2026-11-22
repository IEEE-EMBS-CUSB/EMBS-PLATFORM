"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  formatBadgeCount,
  getSeenStorageKey,
  resolveNavBadge,
  type NavBadgeMap,
  type NavBadgeTone,
  type ResolvedNavBadge,
} from "@/lib/nav-notifications";
import { cn } from "@/lib/utils";

const SEEN_EVENT = "embs:nav-seen-updated";

function subscribeToSeenStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(SEEN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SEEN_EVENT, callback);
  };
}

function readSeenSnapshot(seenKeys: readonly string[]): string {
  if (typeof window === "undefined" || seenKeys.length === 0) return "";
  try {
    return seenKeys
      .map(
        (key) => `${key}=${window.localStorage.getItem(getSeenStorageKey(key)) ?? ""}`
      )
      .join("|");
  } catch {
    return "";
  }
}

export function markNavSectionSeen(seenKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getSeenStorageKey(seenKey),
      new Date().toISOString()
    );
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

/**
 * Resolves server-provided `NavBadgeMap` against client `localStorage` seen
 * watermarks (for date-based items like Feedback) and automatically marks the
 * currently visited route as seen.
 */
export function useResolvedNavBadges(
  navBadges: NavBadgeMap | undefined,
  pathname: string | null
): Record<string, ResolvedNavBadge> {
  const seenKeys = useMemo(() => {
    if (!navBadges) return [] as string[];
    return Object.values(navBadges)
      .map((b) => b.seenKey)
      .filter((k): k is string => Boolean(k))
      .sort();
  }, [navBadges]);

  const seenSnapshot = useSyncExternalStore(
    subscribeToSeenStore,
    () => readSeenSnapshot(seenKeys),
    () => "__ssr__"
  );

  // When the user visits a route that tracks `seenKey`, mark it seen in localStorage
  useEffect(() => {
    if (!navBadges || !pathname) return;
    for (const [href, badge] of Object.entries(navBadges)) {
      if (
        badge.seenKey &&
        (pathname === href || pathname.startsWith(`${href}/`))
      ) {
        markNavSectionSeen(badge.seenKey);
      }
    }
  }, [navBadges, pathname]);

  return useMemo(() => {
    if (!navBadges) return {};

    const seenMap = new Map<string, string | null>();
    if (seenSnapshot && seenSnapshot !== "__ssr__") {
      for (const pair of seenSnapshot.split("|")) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx > 0) {
          const k = pair.slice(0, eqIdx);
          const v = pair.slice(eqIdx + 1);
          seenMap.set(k, v || null);
        }
      }
    }

    const now = new Date();
    const resolved: Record<string, ResolvedNavBadge> = {};
    for (const [href, badge] of Object.entries(navBadges)) {
      // Avoid flashing stale seen badges before client storage is read on SSR
      if (badge.seenKey && seenSnapshot === "__ssr__") {
        continue;
      }
      const seenAt = badge.seenKey ? (seenMap.get(badge.seenKey) ?? null) : null;
      const res = resolveNavBadge(badge, seenAt, now);
      if (res) {
        resolved[href] = res;
      }
    }
    return resolved;
  }, [navBadges, seenSnapshot]);
}

const PILL_STYLES: Record<
  NavBadgeTone,
  { normal: string; active: string }
> = {
  purple: {
    normal: "bg-[#772583] text-white",
    active: "bg-white text-[#772583]",
  },
  red: {
    normal: "bg-[#ba0c2f] text-white",
    active: "bg-white text-[#ba0c2f]",
  },
  amber: {
    normal: "bg-[#ffc627] text-[#002855]",
    active: "bg-[#ffc627] text-[#002855]",
  },
  green: {
    normal: "bg-[#1e6b0a] text-white",
    active: "bg-white text-[#1e6b0a]",
  },
};

export function NavBadgePill({
  badge,
  active = false,
  compact = false,
  className,
}: {
  badge?: ResolvedNavBadge | null;
  active?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!badge || badge.count <= 0) return null;

  const toneStyle = active
    ? PILL_STYLES[badge.tone].active
    : PILL_STYLES[badge.tone].normal;
  const text = formatBadgeCount(badge.count);

  if (compact) {
    return (
      <span
        aria-label={badge.label ?? `${badge.count} pending`}
        className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] leading-none font-bold tabular-nums shadow-2xs",
          PILL_STYLES[badge.tone].normal,
          className
        )}
      >
        {text}
      </span>
    );
  }

  return (
    <span
      title={badge.label}
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-[10px] leading-none font-bold tabular-nums",
        toneStyle,
        className
      )}
    >
      {text}
    </span>
  );
}
