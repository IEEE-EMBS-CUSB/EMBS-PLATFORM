"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommitteeLeaderSpotlight, CommitteeTrack } from "@/types";

type TrackFilter = "all" | CommitteeTrack;

const AVATAR_BG_BY_SLUG: Record<string, string> = {
  "ai-and-machine-learning": "bg-[#002855]",
  "web-development": "bg-[#00629b]",
  "robotics-and-automation": "bg-[#007377]",
  "medical-equipment-and-planning": "bg-[#002855]",
  "r-and-d": "bg-[#007377]",
  "game-development": "bg-[#00629b]",
  "marketing-and-content-creation": "bg-[#772583]",
  "graphic-design": "bg-[#5a1b63]",
  "photography-videography-editing": "bg-[#772583]",
  "human-resources": "bg-[#5a1b63]",
  "public-relations-and-fund-raising": "bg-[#772583]",
  "organizing-and-logistics": "bg-[#5a1b63]",
};

interface CommitteeLeadersShowcaseProps {
  spotlights: CommitteeLeaderSpotlight[];
  monthLabel: string;
}

export function CommitteeLeadersShowcase({
  spotlights,
  monthLabel,
}: CommitteeLeadersShowcaseProps) {
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");

  const technicalCount = spotlights.filter(
    (item) => item.committee.track === "technical"
  ).length;
  const nonTechnicalCount = spotlights.filter(
    (item) => item.committee.track === "non_technical"
  ).length;

  const filtered =
    trackFilter === "all"
      ? spotlights
      : spotlights.filter((item) => item.committee.track === trackFilter);

  const highestScore = spotlights.reduce(
    (max, item) => Math.max(max, item.leader?.monthlyScore ?? 0),
    0
  );

  const filterOptions: {
    id: TrackFilter;
    label: string;
    count: number;
  }[] = [
    { id: "all", label: "All", count: spotlights.length },
    { id: "technical", label: "Technical", count: technicalCount },
    {
      id: "non_technical",
      label: "Non-technical",
      count: nonTechnicalCount,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#002855] sm:text-2xl">
            {monthLabel} Committee Leaders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Top-ranked member leading each committee this month.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div
            role="group"
            aria-label="Filter committees by track"
            className="inline-flex rounded-lg border border-border bg-white p-1"
          >
            {filterOptions.map((option) => {
              const isActive = trackFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTrackFilter(option.id)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b] sm:px-3",
                    isActive
                      ? "bg-[#002855] text-white"
                      : "text-foreground/80 hover:bg-[#f5edf7]/70 hover:text-[#002855]"
                  )}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                      isActive
                        ? "bg-white/18 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>

          <Link
            href="/leaderboards"
            className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
          >
            <span>All standings</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Open card-free roster of crowned honorees */}
      <ul className="grid grid-cols-2 items-start gap-x-4 gap-y-8 pt-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map(({ committee, leader }) => {
          const avatarBg =
            AVATAR_BG_BY_SLUG[committee.slug] ??
            (committee.track === "technical" ? "bg-[#00629b]" : "bg-[#772583]");
          const isTopOverall =
            leader !== null &&
            highestScore > 0 &&
            leader.monthlyScore === highestScore;

          return (
            <li key={committee.id} className="flex justify-center">
              <Link
                href={`/leaderboards/committees/${committee.slug}`}
                className="group flex w-full flex-col items-center rounded-xl px-1 py-1 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00629b]"
              >
                {/* Crowned user emblem with locked vertical rhythm */}
                <div className="relative flex flex-col items-center motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-1">
                  <div
                    data-slot="leader-crown-slot"
                    className="relative z-10 -mb-1.5 flex h-7 items-end justify-center"
                  >
                    <Crown
                      data-slot="leader-crown"
                      aria-hidden="true"
                      className={cn(
                        "fill-[#ffc627] text-[#a37000] drop-shadow-[0_1px_1px_rgba(0,40,85,0.2)]",
                        isTopOverall ? "h-7 w-7" : "h-6 w-6"
                      )}
                      strokeWidth={1.75}
                    />
                  </div>

                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm transition-shadow sm:h-[72px] sm:w-[72px]",
                      avatarBg,
                      isTopOverall
                        ? "ring-[3px] ring-[#ffc627] ring-offset-2 ring-offset-background"
                        : "ring-2 ring-white group-hover:ring-[#ffc627]"
                    )}
                  >
                    <UserRound
                      data-slot="leader-user-icon"
                      aria-hidden="true"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      strokeWidth={1.75}
                    />
                  </div>

                  <div className="relative z-10 -mt-3 flex h-5 items-center justify-center">
                    {leader && (
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 font-heading text-[11px] font-bold tabular-nums shadow-xs",
                          isTopOverall
                            ? "bg-[#ffc627] text-[#002855]"
                            : "bg-white text-[#002855] ring-1 ring-border"
                        )}
                      >
                        {leader.monthlyScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* Member name & committee with consistent height slots */}
                <p className="mt-2.5 w-full truncate font-heading text-sm font-bold leading-5 text-[#002855] transition-colors group-hover:text-[#772583]">
                  {leader ? leader.memberName : "Unranked"}
                </p>
                <p
                  data-slot="leader-committee"
                  className="mt-0.5 min-h-8 text-balance text-xs font-medium leading-4 text-muted-foreground"
                >
                  {committee.name}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
