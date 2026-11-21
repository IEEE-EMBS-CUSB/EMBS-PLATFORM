import { Award, CheckCircle2, Flame, Target } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface MemberEngagementProps {
  attendanceStreak: number;
  livePoints: number;
  currentRank: number;
  pointsToNextRank: number | null;
  targetRank: number | null;
  activityTier: "Diamond" | "Gold" | "Silver" | "Bronze" | "Member";
  committeeCompletionRate: number;
}

const TIER_STYLES: Record<
  MemberEngagementProps["activityTier"],
  { badge: string; iconWrap: string }
> = {
  Diamond: {
    badge: "border-[#00629b]/30 bg-[#ebf3f8] text-[#00629b]",
    iconWrap: "bg-[#ebf3f8] text-[#00629b]",
  },
  Gold: {
    badge: "border-[#ffc627]/60 bg-[#fff8e1] text-[#002855]",
    iconWrap: "bg-[#fff8e1] text-[#8a5a00]",
  },
  Silver: {
    badge: "border-border bg-[#f0f3f7] text-[#002855]",
    iconWrap: "bg-[#f0f3f7] text-[#4c5a6d]",
  },
  Bronze: {
    badge: "border-[#772583]/25 bg-[#f5edf7] text-[#5a1b63]",
    iconWrap: "bg-[#f5edf7] text-[#772583]",
  },
  Member: {
    badge: "border-border bg-muted/60 text-foreground",
    iconWrap: "bg-muted text-[#002855]",
  },
};

export function MemberEngagementCard({
  attendanceStreak,
  livePoints,
  currentRank,
  pointsToNextRank,
  targetRank,
  activityTier,
  committeeCompletionRate,
}: MemberEngagementProps) {
  const tierStyle = TIER_STYLES[activityTier] ?? TIER_STYLES.Member;

  return (
    <Card className="overflow-hidden border-border bg-white shadow-xs">
      {/* Top summary row: tier emblem, live points, and rank */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tierStyle.iconWrap}`}
          >
            <Award className="h-6 w-6" aria-hidden="true" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${tierStyle.badge}`}
              >
                {activityTier} Member
              </span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                Current Rank: #{currentRank}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {livePoints} pts
              </span>
              <span className="text-xs text-muted-foreground">
                Live season ledger
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom progress strip: single unified surface with dividers (no nested boxes) */}
      <div className="grid divide-y divide-border border-t border-border bg-[#f8f9fb] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center gap-3 px-5 py-3.5 text-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
            <Flame className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#002855] tabular-nums">
              {attendanceStreak} Session Streak
            </p>
            <p className="text-muted-foreground">Consistent presence</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 text-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
            <Target className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {currentRank === 1 || pointsToNextRank === null ? (
              <p className="font-semibold text-[#00629b]">
                Rank #1 · Chapter Leader
              </p>
            ) : (
              <p className="font-semibold text-[#00629b] tabular-nums">
                {pointsToNextRank} pts needed to reach Rank #{targetRank}
              </p>
            )}
            <p className="text-muted-foreground">Rank milestone</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 text-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf5dd] text-[#1e6b0a]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1e6b0a] tabular-nums">
              {committeeCompletionRate}%
            </p>
            <p className="text-muted-foreground">Tasks completed</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
