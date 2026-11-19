import { Flame, Award, CheckCircle, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface MemberEngagementProps {
  attendanceStreak: number;
  livePoints: number;
  currentRank: number;
  pointsToNextRank: number | null;
  targetRank: number | null;
  activityTier: "Diamond" | "Gold" | "Silver" | "Bronze" | "Member";
  committeeCompletionRate: number;
}

export function MemberEngagementCard({
  attendanceStreak,
  livePoints,
  currentRank,
  pointsToNextRank,
  targetRank,
  activityTier,
  committeeCompletionRate,
}: MemberEngagementProps) {
  const getTierColor = (tier: MemberEngagementProps["activityTier"]) => {
    switch (tier) {
      case "Diamond":
        return "border-[#00629b] bg-[#ebf3f8] text-[#00629b]";
      case "Gold":
        return "border-[#ffe199] bg-[#fff8e6] text-[#b25e00]";
      case "Silver":
        return "border-[#cbd5e1] bg-[#f8fafc] text-[#475569]";
      case "Bronze":
        return "border-[#fed7aa] bg-[#fffaf5] text-[#9a3412]";
      default:
        return "border-border bg-muted/40 text-foreground";
    }
  };

  return (
    <Card className="overflow-hidden border-border bg-white shadow-xs">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left Block: Tier & Live Score */}
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-xl font-bold shadow-xs ${getTierColor(
                activityTier
              )}`}
            >
              <Award className="h-7 w-7" aria-hidden="true" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${getTierColor(
                    activityTier
                  )}`}
                >
                  {activityTier} Member
                </span>
                <span className="text-xs text-muted-foreground">
                  Current Rank: #{currentRank}
                </span>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-extrabold text-[#002855]">
                  {livePoints} pts
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  (Real-time derived)
                </span>
              </div>
            </div>
          </div>

          {/* Right Block: Middle-80% Progress Widgets */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Attendance Streak */}
            <div className="flex items-center gap-3 rounded-xl border border-[#fed7aa] bg-[#fffaf5] p-3 text-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ffedd5] text-[#ea580c]">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-[#9a3412]">
                  {attendanceStreak} Session Streak
                </div>
                <div className="text-muted-foreground">Consistent presence</div>
              </div>
            </div>

            {/* Next Rank Delta */}
            <div className="flex items-center gap-3 rounded-xl border border-[#b2d5ea] bg-[#ebf3f8] p-3 text-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d9ecf6] text-[#00629b]">
                <Target className="h-5 w-5" />
              </div>
              <div>
                {currentRank === 1 || pointsToNextRank === null ? (
                  <div className="font-bold text-[#00629b]">
                    Rank #1 · Chapter Leader
                  </div>
                ) : (
                  <div className="font-bold text-[#00629b]">
                    {pointsToNextRank} pts needed to reach Rank #{targetRank}
                  </div>
                )}
                <div className="text-muted-foreground">Rank milestone</div>
              </div>
            </div>

            {/* Committee Completion */}
            <div className="flex items-center gap-3 rounded-xl border border-[#c4e8aa] bg-[#f0f9eb] p-3 text-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ddf3ce] text-[#408c10]">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-[#2a5e0b]">
                  {committeeCompletionRate}%
                </div>
                <div className="text-muted-foreground">Tasks completed</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
