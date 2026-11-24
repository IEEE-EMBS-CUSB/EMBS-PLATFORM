"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Crown,
  Lock,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeSeasonLeaderboard,
  DEFAULT_SEASON_LEADERBOARD_FILTERS,
  type AdminStatisticsDataset,
  type SeasonLeaderboardFilters,
} from "@/lib/statistics-engine";

interface SeasonLeaderboardPanelProps {
  dataset: AdminStatisticsDataset;
}

const FILTER_SELECT_CLASS =
  "h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583] sm:w-auto";

const TIER_BADGE_CLASSES: Record<string, string> = {
  Diamond: "bg-[#772583] text-white",
  Gold: "bg-[#ffc627] text-[#002855]",
  Silver: "bg-[#00629b] text-white",
  Bronze: "bg-[#007377] text-white",
  Member: "bg-[#ebf3f8] text-[#002855]",
};

const PODIUM_STYLES = [
  {
    bg: "border-[#ffc627] bg-[#fffbeb]",
    badge: "bg-[#ffc627] text-[#002855]",
    label: "#1 Leader",
  },
  {
    bg: "border-[#00629b]/40 bg-[#ebf3f8]",
    badge: "bg-[#00629b] text-white",
    label: "#2 Runner-up",
  },
  {
    bg: "border-[#007377]/40 bg-[#e3f5f6]",
    badge: "bg-[#007377] text-white",
    label: "#3 Third",
  },
] as const;

export function SeasonLeaderboardPanel({
  dataset,
}: SeasonLeaderboardPanelProps) {
  const [lbFilters, setLbFilters] = useState<SeasonLeaderboardFilters>(
    DEFAULT_SEASON_LEADERBOARD_FILTERS
  );

  const showCommitteeSelect =
    dataset.scopeKind !== "committee" && dataset.committees.length > 0;
  const showTrackSelect =
    dataset.scopeKind === "chapter" && dataset.tracks.length > 0;

  const selectableCommittees = useMemo(() => {
    if (lbFilters.trackId === "all") return dataset.committees;
    return dataset.committees.filter((c) => c.trackId === lbFilters.trackId);
  }, [dataset.committees, lbFilters.trackId]);

  const entries = useMemo(
    () => computeSeasonLeaderboard(dataset, lbFilters),
    [dataset, lbFilters]
  );

  const hasActiveFilters =
    lbFilters.search.trim().length > 0 ||
    lbFilters.trackId !== "all" ||
    lbFilters.committeeId !== "all" ||
    lbFilters.role !== "all" ||
    lbFilters.tier !== "all" ||
    lbFilters.warnings !== "all" ||
    lbFilters.status !== "active";

  const topScore = entries[0]?.seasonPoints ?? 0;
  const podium = entries.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Hidden / Internal Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#772583]/30 bg-[#f5edf7] px-4 py-3 text-xs text-[#5a1b63]">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Internal Season-Wide Leaderboard</strong> — Hidden from
            members and public leaderboards. Ranks cumulative full-season points
            across all months in{" "}
            <strong>{dataset.selectedSeason?.name ?? "this season"}</strong>.
          </span>
        </div>
        <Badge className="bg-[#772583] text-white text-[10px] font-semibold">
          Admin Only
        </Badge>
      </div>

      {/* Leaderboard Filter Bar */}
      <Card className="border-border bg-white shadow-xs">
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              aria-label="Search season leaderboard"
              placeholder="Search ranked member by name or email..."
              value={lbFilters.search}
              onChange={(e) =>
                setLbFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="h-10 pr-9 pl-10 text-sm"
            />
            {lbFilters.search && (
              <button
                type="button"
                aria-label="Clear leaderboard search"
                onClick={() =>
                  setLbFilters((prev) => ({ ...prev, search: "" }))
                }
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
            {showTrackSelect && (
              <select
                aria-label="Filter leaderboard by track"
                value={lbFilters.trackId}
                onChange={(e) => {
                  const nextTrackId = e.target.value;
                  setLbFilters((prev) => {
                    const keepCommittee =
                      nextTrackId === "all" ||
                      prev.committeeId === "all" ||
                      dataset.committees.some(
                        (c) =>
                          c.id === prev.committeeId && c.trackId === nextTrackId
                      );
                    return {
                      ...prev,
                      trackId: nextTrackId,
                      committeeId: keepCommittee ? prev.committeeId : "all",
                    };
                  });
                }}
                className={FILTER_SELECT_CLASS}
              >
                <option value="all">All Categories</option>
                {dataset.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {showCommitteeSelect && (
              <select
                aria-label="Filter leaderboard by committee"
                value={lbFilters.committeeId}
                onChange={(e) =>
                  setLbFilters((prev) => ({
                    ...prev,
                    committeeId: e.target.value,
                  }))
                }
                className={FILTER_SELECT_CLASS}
              >
                <option value="all">All Committees</option>
                {selectableCommittees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter leaderboard by role"
              value={lbFilters.role}
              onChange={(e) =>
                setLbFilters((prev) => ({
                  ...prev,
                  role: e.target.value as SeasonLeaderboardFilters["role"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Ranked Roles</option>
              <option value="member">Members Only</option>
              <option value="hr_member">HR Members Only</option>
            </select>

            <select
              aria-label="Filter leaderboard by tier"
              value={lbFilters.tier}
              onChange={(e) =>
                setLbFilters((prev) => ({
                  ...prev,
                  tier: e.target.value as SeasonLeaderboardFilters["tier"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Tiers</option>
              <option value="Diamond">Diamond</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
              <option value="Member">Member</option>
            </select>

            <select
              aria-label="Filter leaderboard by warnings"
              value={lbFilters.warnings}
              onChange={(e) =>
                setLbFilters((prev) => ({
                  ...prev,
                  warnings: e.target
                    .value as SeasonLeaderboardFilters["warnings"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">Any Warnings</option>
              <option value="with_warnings">With Warnings</option>
              <option value="no_warnings">Zero Warnings</option>
            </select>

            <select
              aria-label="Filter leaderboard by status"
              value={lbFilters.status}
              onChange={(e) =>
                setLbFilters((prev) => ({
                  ...prev,
                  status: e.target.value as SeasonLeaderboardFilters["status"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="active">Active Only</option>
              <option value="all">Active &amp; Deactivated</option>
            </select>

            <div className="col-span-2 flex items-center justify-between gap-2 pt-1 sm:ml-auto sm:pt-0">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLbFilters(DEFAULT_SEASON_LEADERBOARD_FILTERS)}
                  className="h-9 px-2.5 text-xs font-semibold text-[#772583] hover:bg-[#f5edf7]"
                >
                  Reset filters
                </Button>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                <strong className="text-[#002855]">{entries.length}</strong>{" "}
                ranked member{entries.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Podium Cards */}
      {podium.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {podium.map((entry, idx) => {
            const style = PODIUM_STYLES[idx] ?? PODIUM_STYLES[2];
            return (
              <div
                key={`podium-${entry.personId}`}
                className={`rounded-xl border p-4 ${style.bg}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge className={`gap-1 text-xs font-bold ${style.badge}`}>
                    {idx === 0 ? (
                      <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {style.label}
                  </Badge>
                  <Badge
                    className={`text-[10px] font-semibold ${TIER_BADGE_CLASSES[entry.tier]}`}
                  >
                    {entry.tier}
                  </Badge>
                </div>
                <p className="mt-2.5 truncate font-heading text-base font-bold text-[#002855]">
                  {entry.fullName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {entry.committeeNames.join(", ")}
                </p>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="font-heading text-2xl font-bold text-[#772583] tabular-nums">
                    {entry.seasonPoints}
                    <span className="ml-1 text-xs font-semibold text-muted-foreground">
                      pts
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    Attend {entry.attendanceRate}% · Work{" "}
                    {entry.workCompletionRate}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Season-Wide Leaderboard Table (Desktop) + Cards (Mobile) */}
      <Card className="border-border bg-white shadow-xs">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base font-bold text-[#002855]">
            <Trophy className="h-4 w-4 text-[#772583]" aria-hidden="true" />
            Season-Wide Standings ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              No ranked members match the current leaderboard filters.
            </p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader className="bg-[#f8f9fb]">
                    <TableRow>
                      <TableHead className="w-16 font-heading text-xs font-bold text-[#002855]">
                        Rank
                      </TableHead>
                      <TableHead className="font-heading text-xs font-bold text-[#002855]">
                        Member
                      </TableHead>
                      <TableHead className="font-heading text-xs font-bold text-[#002855]">
                        Season Points
                      </TableHead>
                      <TableHead className="font-heading text-xs font-bold text-[#002855]">
                        Score Breakdown
                      </TableHead>
                      <TableHead className="font-heading text-xs font-bold text-[#002855]">
                        Attend / Work
                      </TableHead>
                      <TableHead className="font-heading text-xs font-bold text-[#002855]">
                        Warnings &amp; Recog
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => {
                      const pctOfTop =
                        topScore > 0
                          ? Math.max(0, Math.round((e.seasonPoints / topScore) * 100))
                          : 0;
                      return (
                        <TableRow key={e.personId}>
                          <TableCell className="font-mono text-xs font-bold text-[#002855] tabular-nums">
                            <span>#{e.rank}</span>
                            {hasActiveFilters && e.overallRank !== e.rank && (
                              <span className="block text-[10px] font-normal text-muted-foreground">
                                (#{e.overallRank} all)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-heading text-xs font-bold text-[#002855]">
                                {e.fullName}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {e.committeeNames.join(", ")}
                                {e.trackNames.length > 0
                                  ? ` · ${e.trackNames.join(", ")}`
                                  : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="w-44">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#772583] tabular-nums">
                                  {e.seasonPoints} pts
                                </span>
                                <Badge
                                  className={`text-[10px] font-semibold ${TIER_BADGE_CLASSES[e.tier]}`}
                                >
                                  {e.tier}
                                </Badge>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e6ebf2]">
                                <div
                                  className="h-full rounded-full bg-[#772583]"
                                  style={{ width: `${pctOfTop}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            <div>
                              Att {e.attendancePoints} · Asgn{" "}
                              {e.assignmentPoints} · Tsk {e.taskPoints}
                            </div>
                            <div className="text-[10px]">
                              Adj{" "}
                              {e.manualNetPoints >= 0
                                ? `+${e.manualNetPoints}`
                                : e.manualNetPoints}{" "}
                              · {e.activeMonthsCount} active mo
                            </div>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            <span className="font-semibold text-[#00629b]">
                              {e.attendanceRate}%
                            </span>
                            <span className="mx-1 text-muted-foreground">/</span>
                            <span className="font-semibold text-[#007377]">
                              {e.workCompletionRate}%
                            </span>
                            {e.overdueCount > 0 && (
                              <span className="block text-[10px] font-semibold text-[#ba0c2f]">
                                {e.overdueCount} overdue
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                              <Badge
                                className={
                                  e.warningsCount > 0
                                    ? "gap-1 bg-[#ba0c2f] text-white text-[10px]"
                                    : "bg-[#f8f9fb] text-muted-foreground border border-border text-[10px]"
                                }
                              >
                                {e.warningsCount > 0 && (
                                  <AlertTriangle
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                )}
                                {e.warningsCount} warn
                              </Badge>
                              {e.recognitionsCount > 0 && (
                                <Badge className="gap-1 bg-[#f0f9e8] text-[#1e6b0a] text-[10px]">
                                  <Sparkles
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                  {e.recognitionsCount}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Touch-Friendly Cards */}
              <div className="divide-y divide-border md:hidden">
                {entries.map((e) => (
                  <div key={e.personId} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#002855] font-mono text-xs font-bold text-white tabular-nums">
                          {e.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-heading text-sm font-bold text-[#002855]">
                            {e.fullName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {e.committeeNames.join(", ")}
                            {hasActiveFilters && e.overallRank !== e.rank
                              ? ` · Overall #${e.overallRank}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-sm font-bold text-[#772583] tabular-nums">
                          {e.seasonPoints} pts
                        </span>
                        <Badge
                          className={`text-[10px] font-semibold ${TIER_BADGE_CLASSES[e.tier]}`}
                        >
                          {e.tier}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                      <span>Attend: {e.attendanceRate}%</span>
                      <span>Work: {e.workCompletionRate}%</span>
                      <span
                        className={
                          e.warningsCount > 0
                            ? "font-semibold text-[#ba0c2f]"
                            : undefined
                        }
                      >
                        Warnings: {e.warningsCount}
                      </span>
                      {e.recognitionsCount > 0 && (
                        <span className="font-semibold text-[#1e6b0a]">
                          Recog: {e.recognitionsCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
