"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { EmptyState } from "@/components/states/empty-state";
import { SeasonLeaderboardPanel } from "@/components/hr/season-leaderboard-panel";
import { WhatsAppPhoneLink } from "@/components/ui/whatsapp-phone-link";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  computeAdminStatistics,
  DEFAULT_STATISTICS_FILTERS,
  type AdminStatisticsDataset,
  type AdminStatisticsFilters,
  type PersonStatusFlag,
} from "@/lib/statistics-engine";

interface StatisticsViewProps {
  dataset: AdminStatisticsDataset;
}

const FILTER_SELECT_CLASS =
  "h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583] sm:w-auto";

const ROLE_LABELS: Record<MembershipRole, string> = {
  master_admin: "Master",
  director: "Director",
  hr_admin: "HR Admin",
  hr_member: "HR Member",
  committee_head: "Head",
  member: "Member",
  attendee: "Attendee",
};

const TIER_BADGE_CLASSES: Record<string, string> = {
  Diamond: "bg-[#772583] text-white",
  Gold: "bg-[#ffc627] text-[#002855]",
  Silver: "bg-[#00629b] text-white",
  Bronze: "bg-[#007377] text-white",
  Member: "bg-[#ebf3f8] text-[#002855]",
};

function formatTurnaround(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function MeterBar({
  value,
  max = 100,
  color = "#772583",
  bgColor = "#e6ebf2",
}: {
  value: number;
  max?: number;
  color?: string;
  bgColor?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: bgColor }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StackedSegmentBar({
  segments,
  total,
}: {
  segments: Array<{ key: string; label: string; count: number; color: string }>;
  total: number;
}) {
  if (total <= 0) {
    return <div className="h-3 w-full rounded-full bg-[#e6ebf2]" />;
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e6ebf2]">
      {segments.map((seg) => {
        if (seg.count <= 0) return null;
        const pct = (seg.count / total) * 100;
        return (
          <div
            key={seg.key}
            title={`${seg.label}: ${seg.count}`}
            style={{ width: `${pct}%`, backgroundColor: seg.color }}
            className="h-full transition-all duration-300"
          />
        );
      })}
    </div>
  );
}

export function StatisticsView({ dataset }: StatisticsViewProps) {
  const router = useRouter();
  const [activeViewTab, setActiveViewTab] = useState<
    "overview" | "leaderboard"
  >("overview");
  const [filters, setFilters] = useState<AdminStatisticsFilters>(
    DEFAULT_STATISTICS_FILTERS
  );
  const [trendMetric, setTrendMetric] = useState<
    "avgMemberPoints" | "totalPoints" | "attendanceRate"
  >("avgMemberPoints");
  const [committeeMetric, setCommitteeMetric] = useState<
    "avgPoints" | "attendanceRate" | "workCompletionRate"
  >("avgPoints");
  const [peopleFlagFilter, setPeopleFlagFilter] = useState<
    "all" | PersonStatusFlag
  >("all");
  const [peopleSort, setPeopleSort] = useState<
    | "points"
    | "warnings"
    | "attendance"
    | "punctuality"
    | "work"
    | "overdue"
    | "name"
  >("points");

  const stats = useMemo(
    () => computeAdminStatistics(dataset, filters),
    [dataset, filters]
  );

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.role !== "all" ||
    filters.committeeId !== "all" ||
    filters.trackId !== "all" ||
    filters.status !== "active" ||
    filters.month !== "all";

  const showCommitteeSelect =
    dataset.scopeKind !== "committee" && dataset.committees.length > 0;
  const showTrackSelect =
    dataset.scopeKind === "chapter" && dataset.tracks.length > 0;

  const selectableCommittees = useMemo(() => {
    if (filters.trackId === "all") return dataset.committees;
    return dataset.committees.filter((c) => c.trackId === filters.trackId);
  }, [dataset.committees, filters.trackId]);

  const displayedPeople = useMemo(() => {
    const base =
      peopleFlagFilter === "all"
        ? stats.people
        : stats.people.filter((p) => p.statusFlag === peopleFlagFilter);

    return [...base].sort((a, b) => {
      if (peopleSort === "name") return a.fullName.localeCompare(b.fullName);
      if (peopleSort === "warnings") {
        if (b.warningsCount !== a.warningsCount) {
          return b.warningsCount - a.warningsCount;
        }
        return b.overdueCount - a.overdueCount;
      }
      if (peopleSort === "attendance") {
        if (b.attendanceRate !== a.attendanceRate) {
          return b.attendanceRate - a.attendanceRate;
        }
        return b.points - a.points;
      }
      if (peopleSort === "punctuality") {
        if (b.punctualityRate !== a.punctualityRate) {
          return b.punctualityRate - a.punctualityRate;
        }
        return b.attendanceRate - a.attendanceRate;
      }
      if (peopleSort === "work") {
        if (b.workCompletionRate !== a.workCompletionRate) {
          return b.workCompletionRate - a.workCompletionRate;
        }
        return b.points - a.points;
      }
      if (peopleSort === "overdue") {
        if (b.overdueCount !== a.overdueCount) {
          return b.overdueCount - a.overdueCount;
        }
        return b.warningsCount - a.warningsCount;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [stats.people, peopleFlagFilter, peopleSort]);

  const peopleFlagCounts = useMemo(() => {
    let needsAttention = 0;
    let inactive = 0;
    let onTrack = 0;
    for (const p of stats.people) {
      if (p.statusFlag === "needs_attention") needsAttention += 1;
      else if (p.statusFlag === "inactive") inactive += 1;
      else onTrack += 1;
    }
    return { needsAttention, inactive, onTrack };
  }, [stats.people]);

  const totalAttendanceRecords = stats.attendanceBreakdown.reduce(
    (sum, s) => sum + s.count,
    0
  );

  const combinedWorkTotal =
    stats.assignments.totalSubmissions + stats.tasks.totalSubmissions;
  const combinedWorkCompleted =
    stats.assignments.gradedCount + stats.tasks.completedCount;
  const combinedWorkRate =
    combinedWorkTotal > 0
      ? Math.round((combinedWorkCompleted / combinedWorkTotal) * 100)
      : 0;
  const combinedOverdue =
    stats.assignments.overdueCount + stats.tasks.overdueCount;

  const handleSeasonChange = (seasonId: string) => {
    if (!seasonId) return;
    router.push(`/hr/statistics?seasonId=${encodeURIComponent(seasonId)}`);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_STATISTICS_FILTERS);
    setPeopleFlagFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header + Scope Badge + Season Switcher */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
              Statistics
            </h1>
            <Badge className="bg-[#f5edf7] text-[#5a1b63] text-xs font-semibold">
              {dataset.scopeLabel}
            </Badge>
            {dataset.selectedSeason && (
              <Badge
                className={
                  dataset.selectedSeason.status === "archived"
                    ? "bg-[#002855] text-white text-xs font-semibold"
                    : "bg-[#ebf3f8] text-[#00629b] text-xs font-semibold"
                }
              >
                {dataset.selectedSeason.name}
                {dataset.selectedSeason.status === "archived"
                  ? " (Archived)"
                  : ""}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Graphical performance, attendance, work pipeline, and engagement
            analytics for the people you manage.
          </p>
        </div>

        {dataset.canSwitchSeason && dataset.availableSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <Calendar
              className="h-4 w-4 shrink-0 text-[#772583]"
              aria-hidden="true"
            />
            <select
              aria-label="Select season"
              value={dataset.selectedSeason?.id ?? ""}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583] sm:w-52"
            >
              {dataset.availableSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status === "active"
                    ? " (Active)"
                    : s.status === "archived"
                      ? " (Archived)"
                      : " (Draft)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Archived season read-only notice */}
      {dataset.selectedSeason?.status === "archived" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#002855]/20 bg-[#ebf3f8] p-3 text-xs text-[#002855]">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Viewing archived season{" "}
            <strong>{dataset.selectedSeason.name}</strong> in read-only mode.
          </span>
        </div>
      )}

      {/* Primary View Switcher: Analytics Overview vs Hidden Season-Wide Leaderboard */}
      <div
        role="tablist"
        aria-label="Statistics views"
        className="inline-flex w-full rounded-lg border border-border bg-white p-1 sm:w-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "overview"}
          onClick={() => setActiveViewTab("overview")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-initial ${
            activeViewTab === "overview"
              ? "bg-[#772583] text-white"
              : "text-[#002855] hover:bg-[#f5edf7]"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Overview &amp; Member List</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "leaderboard"}
          onClick={() => setActiveViewTab("leaderboard")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-initial ${
            activeViewTab === "leaderboard"
              ? "bg-[#002855] text-white"
              : "text-[#002855] hover:bg-[#ebf3f8]"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Season Leaderboard</span>
          <Lock className="h-3 w-3 opacity-80" aria-hidden="true" />
        </button>
      </div>

      {activeViewTab === "leaderboard" ? (
        <SeasonLeaderboardPanel dataset={dataset} />
      ) : (
        <>
          {/* Roster-matching Multi-Facet Filter Bar */}
      <Card className="border-border bg-white shadow-xs">
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              aria-label="Search managed people"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="h-10 pr-9 pl-10 text-sm"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, search: "" }))
                }
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
            <select
              aria-label="Filter by role"
              value={filters.role}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  role: e.target.value as AdminStatisticsFilters["role"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Roles</option>
              <option value="master_admin">Master</option>
              <option value="director">Director</option>
              <option value="hr_admin">HR Admin</option>
              <option value="hr_member">HR Member</option>
              <option value="committee_head">Head</option>
              <option value="member">Member</option>
              <option value="attendee">Attendee</option>
            </select>

            {showCommitteeSelect && (
              <select
                aria-label="Filter by committee"
                value={filters.committeeId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    committeeId: e.target.value,
                  }))
                }
                className={FILTER_SELECT_CLASS}
              >
                <option value="all">All Committees</option>
                <option value="unassigned">Unassigned</option>
                {selectableCommittees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {showTrackSelect && (
              <select
                aria-label="Filter by track"
                value={filters.trackId}
                onChange={(e) => {
                  const nextTrackId = e.target.value;
                  setFilters((prev) => {
                    const keepCommittee =
                      nextTrackId === "all" ||
                      prev.committeeId === "all" ||
                      prev.committeeId === "unassigned" ||
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
                <option value="all">All Tracks</option>
                {dataset.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} Track
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as AdminStatisticsFilters["status"],
                }))
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="active">Active Only</option>
              <option value="all">All Statuses</option>
              <option value="inactive">Deactivated</option>
            </select>

            <select
              aria-label="Filter by month"
              value={filters.month}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, month: e.target.value }))
              }
              className={`${FILTER_SELECT_CLASS} col-span-2 sm:col-span-1`}
            >
              <option value="all">Full Season</option>
              {stats.availableMonths.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label} {m.isPublished ? "(Published)" : "(Live)"}
                </option>
              ))}
            </select>

            <div className="col-span-2 flex items-center justify-between gap-2 pt-1 sm:ml-auto sm:pt-0">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 px-2.5 text-xs font-semibold text-[#772583] hover:bg-[#f5edf7]"
                >
                  Reset filters
                </Button>
              ) : (
                <span />
              )}

              <span className="text-xs text-muted-foreground tabular-nums">
                Showing{" "}
                <strong className="text-[#002855]">
                  {stats.summary.managedPeopleCount}
                </strong>{" "}
                of {stats.summary.totalScopedPeopleCount} people
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned scope empty state */}
      {dataset.members.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
          title="No managed people in this scope yet"
          description="Once members are assigned to your committee, track, or season, their live statistics and charts will appear here."
        />
      ) : (
        <>
          {/* Top KPI Strip (2 cols mobile, 4 cols desktop) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="space-y-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Managed People
                  </p>
                  <Users
                    className="h-4 w-4 text-[#00629b]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {stats.summary.managedPeopleCount}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Participating</span>
                    <span className="font-semibold text-[#1e6b0a] tabular-nums">
                      {stats.summary.activeParticipationRate}%
                    </span>
                  </div>
                  <MeterBar
                    value={stats.summary.activeParticipationRate}
                    color="#78be20"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {stats.summary.inactiveMembersCount} inactive
                  {stats.summary.portalActivationRate !== null
                    ? ` · ${stats.summary.portalActivationRate}% activated`
                    : ""}
                  {stats.summary.attendeeCount > 0
                    ? ` · ${stats.summary.attendeeCount} attendees`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="space-y-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Avg / Median Points
                  </p>
                  <Award
                    className="h-4 w-4 text-[#772583]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-heading text-2xl font-bold text-[#772583] tabular-nums">
                  {stats.summary.avgMemberPoints}
                  <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
                    / {stats.summary.medianMemberPoints}
                  </span>
                </p>
                <p className="text-[11px] text-[#002855] tabular-nums">
                  <strong>{stats.summary.netPoints}</strong> net pts across{" "}
                  {stats.summary.eligibleMemberCount} ranked members
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="space-y-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Attendance Rate
                  </p>
                  <CheckCircle2
                    className="h-4 w-4 text-[#1e6b0a]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {stats.summary.attendanceRate}%
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Punctuality</span>
                    <span className="font-semibold text-[#00629b] tabular-nums">
                      {stats.summary.punctualityRate}%
                    </span>
                  </div>
                  <MeterBar
                    value={stats.summary.punctualityRate}
                    color="#00629b"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {stats.summary.sessionsHeldCount} past session
                  {stats.summary.sessionsHeldCount === 1 ? "" : "s"}
                  {stats.summary.manualOverrideRate !== null
                    ? ` · ${stats.summary.manualOverrideRate}% overrides`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="space-y-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Work Completion
                  </p>
                  <Clock
                    className="h-4 w-4 text-[#007377]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {combinedWorkRate}%
                </p>
                <MeterBar value={combinedWorkRate} color="#007377" />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                  <span className="font-semibold text-[#772583]">
                    {stats.assignments.pendingGradingCount} to grade
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span
                    className={
                      combinedOverdue > 0
                        ? "font-semibold text-[#ba0c2f]"
                        : "text-muted-foreground"
                    }
                  >
                    {combinedOverdue} overdue
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* HR Operations Health Strip (Master Admin & HR Admin only) */}
          {stats.hrHealth && (
            <Card className="border-[#007377]/30 bg-white shadow-xs">
              <CardHeader className="border-b border-border/70 bg-[#e3f5f6]/50 px-5 py-3">
                <CardTitle className="flex items-center gap-2 font-heading text-sm font-bold text-[#002855]">
                  <Layers
                    className="h-4 w-4 text-[#007377]"
                    aria-hidden="true"
                  />
                  HR Operations Health
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#002855]">
                      Committee HR Officer Coverage
                    </span>
                    <span className="font-mono font-bold text-[#007377] tabular-nums">
                      {stats.hrHealth.coveredCommittees} /{" "}
                      {stats.hrHealth.totalCommittees}
                    </span>
                  </div>
                  <MeterBar
                    value={stats.hrHealth.coveredCommittees}
                    max={Math.max(1, stats.hrHealth.totalCommittees)}
                    color="#007377"
                  />
                  {stats.hrHealth.uncoveredCommittees.length > 0 ? (
                    <p className="text-[11px] text-[#92400e]">
                      Uncovered:{" "}
                      {stats.hrHealth.uncoveredCommittees.join(", ")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#1e6b0a]">
                      Every committee has an assigned HR officer.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#002855]">
                      Published Leaderboard Months
                    </span>
                    <span className="font-mono font-bold text-[#772583] tabular-nums">
                      {stats.hrHealth.publishedMonthsCount} /{" "}
                      {stats.hrHealth.activeMonthsCount}
                    </span>
                  </div>
                  <MeterBar
                    value={stats.hrHealth.publishedMonthsCount}
                    max={Math.max(1, stats.hrHealth.activeMonthsCount)}
                    color="#772583"
                  />
                  {stats.hrHealth.unpublishedMonths.length > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Unpublished months:{" "}
                      {stats.hrHealth.unpublishedMonths.join(", ")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#1e6b0a]">
                      All active scoring months are published and frozen.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Graphical Charts Grid (Row 1: Trend + Attendance Donut) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Monthly Activity Trend */}
            <Card className="min-w-0 border-border bg-white shadow-xs">
              <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 font-heading text-base font-bold text-[#002855]">
                  <TrendingUp
                    className="h-4 w-4 text-[#772583]"
                    aria-hidden="true"
                  />
                  Monthly Trend
                </CardTitle>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { key: "avgMemberPoints", label: "Avg Pts" },
                      { key: "totalPoints", label: "Total Pts" },
                      { key: "attendanceRate", label: "Attend %" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTrendMetric(opt.key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        trendMetric === opt.key
                          ? "bg-[#772583] text-white"
                          : "bg-[#f5edf7] text-[#5a1b63] hover:bg-[#e9d8ee]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {stats.monthlyTrend.length === 0 ? (
                  <p className="py-16 text-center text-xs text-muted-foreground">
                    No monthly activity recorded yet for this selection.
                  </p>
                ) : (
                  <div className="h-56 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stats.monthlyTrend}
                        margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e6ebf2"
                        />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 11, fill: "#4c5a6d" }}
                          axisLine={{ stroke: "#dde3ec" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#4c5a6d" }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          domain={
                            trendMetric === "attendanceRate"
                              ? [0, 100]
                              : [0, "auto"]
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#dde3ec",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(val) => [
                            trendMetric === "attendanceRate"
                              ? `${val}%`
                              : `${val} pts`,
                            trendMetric === "avgMemberPoints"
                              ? "Avg Member Score"
                              : trendMetric === "totalPoints"
                                ? "Total Points"
                                : "Attendance Rate",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey={trendMetric}
                          stroke={
                            trendMetric === "attendanceRate"
                              ? "#00629b"
                              : "#772583"
                          }
                          strokeWidth={2.5}
                          fill={
                            trendMetric === "attendanceRate"
                              ? "#ebf3f8"
                              : "#f5edf7"
                          }
                          fillOpacity={0.75}
                          dot={{
                            r: 4,
                            fill:
                              trendMetric === "attendanceRate"
                                ? "#00629b"
                                : "#772583",
                            strokeWidth: 2,
                            stroke: "#ffffff",
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Status Breakdown Donut */}
            <Card className="min-w-0 border-border bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold text-[#002855]">
                  Attendance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {totalAttendanceRecords === 0 ? (
                  <p className="py-16 text-center text-xs text-muted-foreground">
                    No past session attendance data in this period yet.
                  </p>
                ) : (
                  <div className="grid items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="relative mx-auto h-48 w-48 sm:h-52 sm:w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.attendanceBreakdown.filter(
                              (s) => s.count > 0
                            )}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={2}
                          >
                            {stats.attendanceBreakdown
                              .filter((s) => s.count > 0)
                              .map((entry) => (
                                <Cell key={entry.key} fill={entry.color} />
                              ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              borderColor: "#dde3ec",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-heading text-xl font-bold text-[#002855] tabular-nums">
                          {stats.summary.attendanceRate}%
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Turnout
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {stats.attendanceBreakdown.map((slice) => {
                        const pct =
                          totalAttendanceRecords > 0
                            ? Math.round(
                                (slice.count / totalAttendanceRecords) * 100
                              )
                            : 0;
                        return (
                          <div
                            key={slice.key}
                            className="rounded-lg border border-border/80 bg-[#f8f9fb] p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="text-xs font-semibold text-[#002855]">
                                {slice.label}
                              </span>
                            </div>
                            <p className="mt-1 font-heading text-lg font-bold text-[#002855] tabular-nums">
                              {slice.count}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                ({pct}%)
                              </span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Graphical Charts Grid (Row 2: Points by Source + Tiers & Roles) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Points by Source */}
            <Card className="min-w-0 border-border bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold text-[#002855]">
                  Points by Source
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-56 w-full sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.pointsBySource}
                      margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e6ebf2"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#4c5a6d" }}
                        axisLine={{ stroke: "#dde3ec" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#4c5a6d" }}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#dde3ec",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [`${val} pts`, "Points"]}
                      />
                      <Bar dataKey="points" radius={[5, 5, 0, 0]} maxBarSize={42}>
                        {stats.pointsBySource.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Activity Tier Distribution + Role Mix */}
            <Card className="min-w-0 border-border bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base font-bold text-[#002855]">
                  Activity Tiers &amp; Role Mix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.tierDistribution}
                      margin={{ top: 6, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e6ebf2"
                      />
                      <XAxis
                        dataKey="tier"
                        tick={{ fontSize: 11, fill: "#4c5a6d" }}
                        axisLine={{ stroke: "#dde3ec" }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#4c5a6d" }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#dde3ec",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [`${val} members`, "Count"]}
                      />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                        {stats.tierDistribution.map((entry) => (
                          <Cell key={entry.tier} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {stats.roleDistribution.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      Role Distribution
                    </p>
                    <StackedSegmentBar
                      segments={stats.roleDistribution.map((r) => ({
                        key: r.role,
                        label: r.label,
                        count: r.count,
                        color: r.color,
                      }))}
                      total={stats.roleDistribution.reduce(
                        (s, r) => s + r.count,
                        0
                      )}
                    />
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      {stats.roleDistribution.map((r) => (
                        <span
                          key={r.role}
                          className="inline-flex items-center gap-1.5 text-[#002855] tabular-nums"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: r.color }}
                          />
                          {r.label}: <strong>{r.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Assignments & HR Tasks Pipelines (Side by side — both visible to Committee Heads & HR Members) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Assignments Pipeline */}
            <Card className="border-border bg-white shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-heading text-base font-bold text-[#002855]">
                    Assignments Pipeline
                  </CardTitle>
                  <Badge className="bg-[#f5edf7] text-[#5a1b63] text-xs font-semibold tabular-nums">
                    {stats.assignments.totalItems} assignments
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <StackedSegmentBar
                  total={stats.assignments.totalSubmissions}
                  segments={[
                    {
                      key: "graded",
                      label: "Graded",
                      count: stats.assignments.gradedCount,
                      color: "#78be20",
                    },
                    {
                      key: "pending",
                      label: "Pending Grading",
                      count: stats.assignments.pendingGradingCount,
                      color: "#ffc627",
                    },
                    {
                      key: "overdue",
                      label: "Overdue",
                      count: stats.assignments.overdueCount,
                      color: "#ba0c2f",
                    },
                    {
                      key: "upcoming",
                      label: "Upcoming",
                      count: stats.assignments.upcomingCount,
                      color: "#cbd5e1",
                    },
                  ]}
                />

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Submitted
                    </p>
                    <p className="font-heading text-base font-bold text-[#002855] tabular-nums">
                      {stats.assignments.submissionRate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                    <p className="text-[11px] text-muted-foreground">On Time</p>
                    <p className="font-heading text-base font-bold text-[#1e6b0a] tabular-nums">
                      {stats.assignments.onTimeRate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      To Grade
                    </p>
                    <p className="font-heading text-base font-bold text-[#772583] tabular-nums">
                      {stats.assignments.pendingGradingCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Turnaround
                    </p>
                    <p className="font-heading text-base font-bold text-[#00629b] tabular-nums">
                      {formatTurnaround(stats.assignments.medianTurnaroundHours)}
                    </p>
                  </div>
                </div>

                {/* Visual Rubric Meters (1-5) */}
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#002855]">
                      Rubric Averages (out of 5)
                    </span>
                    {stats.assignments.avgScorePercent !== null && (
                      <span className="font-mono text-xs font-bold text-[#772583]">
                        Avg score: {stats.assignments.avgScorePercent}%
                      </span>
                    )}
                  </div>
                  {(
                    [
                      {
                        label: "Effort",
                        val: stats.assignments.avgEffort,
                        color: "#772583",
                      },
                      {
                        label: "Quality",
                        val: stats.assignments.avgQuality,
                        color: "#00629b",
                      },
                      {
                        label: "Timeliness",
                        val: stats.assignments.avgTimeliness,
                        color: "#78be20",
                      },
                    ] as const
                  ).map((metric) => (
                    <div key={metric.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {metric.label}
                        </span>
                        <span className="font-mono font-semibold text-[#002855] tabular-nums">
                          {metric.val !== null ? `${metric.val} / 5` : "—"}
                        </span>
                      </div>
                      <MeterBar
                        value={metric.val ?? 0}
                        max={5}
                        color={metric.color}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* HR Tasks Pipeline + Feedback & Risk Summary */}
            <div className="space-y-4">
              <Card className="border-border bg-white shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-heading text-base font-bold text-[#002855]">
                      HR Tasks Pipeline
                    </CardTitle>
                    <Badge className="bg-[#e3f5f6] text-[#007377] text-xs font-semibold tabular-nums">
                      {stats.tasks.totalItems} tasks
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StackedSegmentBar
                    total={stats.tasks.totalSubmissions}
                    segments={[
                      {
                        key: "completed",
                        label: "Completed / Verified",
                        count: stats.tasks.completedCount,
                        color: "#007377",
                      },
                      {
                        key: "pending",
                        label: "Self-Reported Pending",
                        count: stats.tasks.selfReportedPendingCount,
                        color: "#ffc627",
                      },
                      {
                        key: "overdue",
                        label: "Overdue",
                        count: stats.tasks.overdueCount,
                        color: "#ba0c2f",
                      },
                      {
                        key: "upcoming",
                        label: "Upcoming",
                        count: stats.tasks.upcomingCount,
                        color: "#cbd5e1",
                      },
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        Completed
                      </p>
                      <p className="font-heading text-base font-bold text-[#007377] tabular-nums">
                        {stats.tasks.completionRate}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        On Time
                      </p>
                      <p className="font-heading text-base font-bold text-[#1e6b0a] tabular-nums">
                        {stats.tasks.onTimeRate}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        Pending Verify
                      </p>
                      <p className="font-heading text-base font-bold text-[#002855] tabular-nums">
                        {stats.tasks.selfReportedPendingCount}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        Overdue
                      </p>
                      <p className="font-heading text-base font-bold text-[#ba0c2f] tabular-nums">
                        {stats.tasks.overdueCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feedback & Risk Overview */}
              <Card className="border-border bg-white shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 font-heading text-base font-bold text-[#002855]">
                      <ShieldAlert
                        className="h-4 w-4 text-[#772583]"
                        aria-hidden="true"
                      />
                      Feedback &amp; Risk Signals
                    </CardTitle>
                    {stats.summary.needsAttentionCount > 0 && (
                      <Badge className="bg-[#ba0c2f] text-white text-xs font-semibold tabular-nums">
                        {stats.summary.needsAttentionCount} need attention
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-[#f0f9e8] p-2.5">
                      <p className="text-[11px] font-medium text-[#1e6b0a]">
                        Recognitions
                      </p>
                      <p className="font-heading text-lg font-bold text-[#1e6b0a] tabular-nums">
                        {stats.feedback.recognition}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#ebf3f8] p-2.5">
                      <p className="text-[11px] font-medium text-[#00629b]">
                        Excused Notes
                      </p>
                      <p className="font-heading text-lg font-bold text-[#00629b] tabular-nums">
                        {stats.feedback.excusedAbsence}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#fdecec] p-2.5">
                      <p className="text-[11px] font-medium text-[#ba0c2f]">
                        Official Warnings
                      </p>
                      <p className="font-heading text-lg font-bold text-[#ba0c2f] tabular-nums">
                        {stats.feedback.warning}
                      </p>
                    </div>
                    {stats.feedback.internalNote !== null ? (
                      <div className="rounded-lg bg-[#f5edf7] p-2.5">
                        <p className="text-[11px] font-medium text-[#5a1b63]">
                          Internal Notes
                        </p>
                        <p className="font-heading text-lg font-bold text-[#5a1b63] tabular-nums">
                          {stats.feedback.internalNote}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#f8f9fb] p-2.5">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          General Notes
                        </p>
                        <p className="font-heading text-lg font-bold text-[#002855] tabular-nums">
                          {stats.feedback.other}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>
                      Feedback bonuses:{" "}
                      <strong className="text-[#1e6b0a]">
                        +{stats.feedback.bonusPoints} pts
                      </strong>
                    </span>
                    <span>
                      Deductions:{" "}
                      <strong className="text-[#ba0c2f]">
                        {stats.feedback.deductionPoints} pts
                      </strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Track Rollup + Committee Comparison (Multi-committee roles only) */}
          {stats.committeeComparison.length > 0 && (
            <div className="space-y-4">
              {stats.trackRollup.length > 1 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {stats.trackRollup.map((track) => (
                    <button
                      key={track.trackId}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          trackId:
                            prev.trackId === track.trackId
                              ? "all"
                              : track.trackId,
                          committeeId: "all",
                        }))
                      }
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        filters.trackId === track.trackId
                          ? "border-[#772583] bg-[#f5edf7]"
                          : "border-border bg-white hover:border-[#772583]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-sm font-bold text-[#002855]">
                          {track.trackName} Track
                        </span>
                        <Badge className="bg-[#ebf3f8] text-[#00629b] text-[10px]">
                          {track.committeesCount} committees
                        </Badge>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs tabular-nums">
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            Avg Pts
                          </p>
                          <p className="font-bold text-[#772583]">
                            {track.avgPoints}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            Attend
                          </p>
                          <p className="font-bold text-[#00629b]">
                            {track.attendanceRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            Work
                          </p>
                          <p className="font-bold text-[#1e6b0a]">
                            {track.workCompletionRate}%
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Card className="min-w-0 border-border bg-white shadow-xs">
                <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="font-heading text-base font-bold text-[#002855]">
                      Committee Comparison
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Tap any committee row to drill down into that committee.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { key: "avgPoints", label: "Avg Pts" },
                        { key: "attendanceRate", label: "Attendance %" },
                        { key: "workCompletionRate", label: "Work %" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCommitteeMetric(opt.key)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          committeeMetric === opt.key
                            ? "bg-[#002855] text-white"
                            : "bg-[#ebf3f8] text-[#002855] hover:bg-[#dce8f2]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Graphical Horizontal Bar Chart */}
                  <div
                    className="w-full"
                    style={{
                      height: `${Math.max(200, stats.committeeComparison.length * 36)}px`,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.committeeComparison}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#e6ebf2"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: "#4c5a6d" }}
                          axisLine={{ stroke: "#dde3ec" }}
                          tickLine={false}
                          domain={
                            committeeMetric === "avgPoints"
                              ? [0, "auto"]
                              : [0, 100]
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="committeeName"
                          width={118}
                          tick={{ fontSize: 11, fill: "#002855" }}
                          tickFormatter={(value: string) =>
                            value.length > 18
                              ? `${value.slice(0, 17)}…`
                              : value
                          }
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#dde3ec",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(val) => [
                            committeeMetric === "avgPoints"
                              ? `${val} pts`
                              : `${val}%`,
                            committeeMetric === "avgPoints"
                              ? "Avg Points"
                              : committeeMetric === "attendanceRate"
                                ? "Attendance"
                                : "Work Completion",
                          ]}
                        />
                        <Bar
                          dataKey={committeeMetric}
                          fill={
                            committeeMetric === "avgPoints"
                              ? "#772583"
                              : committeeMetric === "attendanceRate"
                                ? "#00629b"
                                : "#78be20"
                          }
                          radius={[0, 5, 5, 0]}
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                    <Table>
                      <TableHeader className="bg-[#f8f9fb]">
                        <TableRow>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Committee
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            People
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            Avg / Med Pts
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            Attendance
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            Work %
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            To Grade
                          </TableHead>
                          <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                            Warnings
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.committeeComparison.map((c) => (
                          <TableRow
                            key={c.committeeId}
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                committeeId:
                                  prev.committeeId === c.committeeId
                                    ? "all"
                                    : c.committeeId,
                              }))
                            }
                            className="cursor-pointer hover:bg-[#f5edf7]/60"
                          >
                            <TableCell className="font-heading text-xs font-bold text-[#002855]">
                              {c.committeeName}
                              {c.trackName && (
                                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                                  {c.trackName}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {c.managedPeopleCount}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-[#772583] tabular-nums">
                              {c.avgPoints} / {c.medianPoints}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {c.attendanceRate}%
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {c.workCompletionRate}%
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {c.pendingGradingCount}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {c.warningsCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-2.5 md:hidden">
                    {stats.committeeComparison.map((c) => (
                      <button
                        key={c.committeeId}
                        type="button"
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            committeeId:
                              prev.committeeId === c.committeeId
                                ? "all"
                                : c.committeeId,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-[#f8f9fb] p-3 text-left active:bg-[#f5edf7]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-heading text-xs font-bold text-[#002855]">
                            {c.committeeName}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#772583] tabular-nums">
                            {c.avgPoints} avg pts
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground tabular-nums">
                          <span>People: {c.managedPeopleCount}</span>
                          <span>Attend: {c.attendanceRate}%</span>
                          <span>Work: {c.workCompletionRate}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Managed People Drill-Down (Desktop Table + Mobile Cards) */}
          <Card className="border-border bg-white shadow-xs">
            <CardHeader className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-heading text-base font-bold text-[#002855]">
                  Managed People Breakdown
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Per-person scores, attendance, work completion, and risk flags.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { key: "all", label: `All (${stats.people.length})` },
                      {
                        key: "needs_attention",
                        label: `Attention (${peopleFlagCounts.needsAttention})`,
                      },
                      {
                        key: "inactive",
                        label: `Inactive (${peopleFlagCounts.inactive})`,
                      },
                      {
                        key: "on_track",
                        label: `On Track (${peopleFlagCounts.onTrack})`,
                      },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setPeopleFlagFilter(pill.key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        peopleFlagFilter === pill.key
                          ? "bg-[#772583] text-white"
                          : "bg-[#f5edf7] text-[#5a1b63] hover:bg-[#e9d8ee]"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Sort managed people"
                  value={peopleSort}
                  onChange={(e) =>
                    setPeopleSort(
                      e.target.value as
                        | "points"
                        | "warnings"
                        | "attendance"
                        | "punctuality"
                        | "work"
                        | "overdue"
                        | "name"
                    )
                  }
                  className="h-8 rounded-md border border-border bg-white px-2 text-xs font-semibold text-[#002855]"
                >
                  <option value="points">Sort: Points</option>
                  <option value="warnings">Sort: Warnings</option>
                  <option value="attendance">Sort: Attendance</option>
                  <option value="punctuality">Sort: Punctuality</option>
                  <option value="work">Sort: Work %</option>
                  <option value="overdue">Sort: Overdue</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {displayedPeople.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No people match the current filter selection.
                </p>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader className="bg-[#f8f9fb]">
                        <TableRow>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Person
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Points &amp; Breakdown
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Attendance &amp; Punctuality
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Work &amp; Overdue
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Rubric (E/Q/T)
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Warnings &amp; Feedback
                          </TableHead>
                          <TableHead className="font-heading text-xs font-bold text-[#002855]">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedPeople.map((p) => {
                          const netAdj = p.bonusPoints + p.deductionPoints;
                          return (
                            <TableRow key={p.personId}>
                              <TableCell>
                                <div className="min-w-0">
                                  <p className="font-heading text-xs font-bold text-[#002855]">
                                    {p.fullName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {p.roles
                                      .map((r) => ROLE_LABELS[r])
                                      .join(" · ")}{" "}
                                    · {p.committeeNames.join(", ")}
                                  </p>
                                  {p.phoneNumber && (
                                    <div className="mt-0.5">
                                      <WhatsAppPhoneLink
                                        phoneNumber={p.phoneNumber}
                                        personName={p.fullName}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#002855] tabular-nums">
                                      {p.points} pts
                                    </span>
                                    {p.isLeaderboardEligible && (
                                      <Badge
                                        className={`text-[10px] font-semibold ${TIER_BADGE_CLASSES[p.tier]}`}
                                      >
                                        {p.tier}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                    Att {p.attendancePoints} · Work{" "}
                                    {p.assignmentPoints + p.taskPoints} · Adj{" "}
                                    {netAdj >= 0 ? `+${netAdj}` : netAdj}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="w-40">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] tabular-nums">
                                    <span className="font-semibold text-[#002855]">
                                      {p.attendanceRate}%
                                    </span>
                                    <span className="text-muted-foreground">
                                      {p.attendedCount}/{p.expectedSessionsCount}
                                    </span>
                                  </div>
                                  <MeterBar
                                    value={p.attendanceRate}
                                    color="#00629b"
                                  />
                                  <p className="text-[10px] text-muted-foreground tabular-nums">
                                    Punct {p.punctualityRate}%
                                    {p.lateCount > 0 ? ` · ${p.lateCount} late` : ""}
                                    {p.excusedCount > 0
                                      ? ` · ${p.excusedCount} exc`
                                      : ""}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="w-40">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] tabular-nums">
                                    <span className="font-semibold text-[#002855]">
                                      {p.workCompletionRate}%
                                    </span>
                                    <span className="text-muted-foreground">
                                      {p.completedWorkCount}/{p.assignedWorkCount}
                                    </span>
                                  </div>
                                  <MeterBar
                                    value={p.workCompletionRate}
                                    color="#007377"
                                  />
                                  <p className="text-[10px] text-muted-foreground tabular-nums">
                                    Asgn {p.assignmentsCompletedCount}/
                                    {p.assignmentsAssignedCount} · Tsk{" "}
                                    {p.tasksCompletedCount}/{p.tasksAssignedCount}
                                    {p.overdueCount > 0 && (
                                      <span className="ml-1 font-semibold text-[#ba0c2f]">
                                        · {p.overdueCount} overdue
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                                {p.avgEffort !== null
                                  ? `${p.avgEffort} / ${p.avgQuality ?? "—"} / ${p.avgTimeliness ?? "—"}`
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1 text-[10px] tabular-nums">
                                  <Badge
                                    className={
                                      p.warningsCount > 0
                                        ? "gap-1 bg-[#ba0c2f] text-white text-[10px]"
                                        : "border border-border bg-[#f8f9fb] text-muted-foreground text-[10px]"
                                    }
                                  >
                                    {p.warningsCount > 0 && (
                                      <AlertTriangle
                                        className="h-2.5 w-2.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                    {p.warningsCount} warn
                                  </Badge>
                                  {p.recognitionsCount > 0 && (
                                    <Badge className="gap-1 bg-[#f0f9e8] text-[#1e6b0a] text-[10px]">
                                      <Sparkles
                                        className="h-2.5 w-2.5"
                                        aria-hidden="true"
                                      />
                                      {p.recognitionsCount}
                                    </Badge>
                                  )}
                                  {p.internalNotesCount !== null &&
                                    p.internalNotesCount > 0 && (
                                      <Badge className="bg-[#f5edf7] text-[#5a1b63] text-[10px]">
                                        {p.internalNotesCount} note
                                        {p.internalNotesCount === 1 ? "" : "s"}
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {p.statusFlag === "needs_attention" ? (
                                  <div className="space-y-1">
                                    <Badge className="gap-1 bg-[#ba0c2f] text-white text-[10px]">
                                      <AlertTriangle
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      Attention
                                    </Badge>
                                    <p className="text-[10px] text-[#ba0c2f]">
                                      {p.attentionReasons.join(" · ")}
                                    </p>
                                  </div>
                                ) : p.statusFlag === "inactive" ? (
                                  <Badge className="border border-border bg-[#f8f9fb] text-muted-foreground text-[10px]">
                                    Inactive
                                  </Badge>
                                ) : (
                                  <Badge className="bg-[#f0f9e8] text-[#1e6b0a] text-[10px]">
                                    On Track
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Touch-Friendly Cards */}
                  <div className="divide-y divide-border md:hidden">
                    {displayedPeople.map((p) => {
                      const netAdj = p.bonusPoints + p.deductionPoints;
                      return (
                        <div key={p.personId} className="space-y-2.5 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-heading text-sm font-bold text-[#002855]">
                                {p.fullName}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {p.roles.map((r) => ROLE_LABELS[r]).join(" · ")}{" "}
                                · {p.committeeNames.join(", ")}
                              </p>
                              {p.phoneNumber && (
                                <div className="mt-0.5">
                                  <WhatsAppPhoneLink
                                    phoneNumber={p.phoneNumber}
                                    personName={p.fullName}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-[#772583] tabular-nums">
                                {p.points} pts
                              </span>
                              {p.isLeaderboardEligible && (
                                <Badge
                                  className={`text-[10px] font-semibold ${TIER_BADGE_CLASSES[p.tier]}`}
                                >
                                  {p.tier}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] tabular-nums">
                                <span className="text-muted-foreground">
                                  Attend
                                </span>
                                <span className="font-semibold text-[#002855]">
                                  {p.attendanceRate}% ({p.attendedCount}/
                                  {p.expectedSessionsCount})
                                </span>
                              </div>
                              <MeterBar
                                value={p.attendanceRate}
                                color="#00629b"
                              />
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                Punct {p.punctualityRate}%
                                {p.excusedCount > 0
                                  ? ` · ${p.excusedCount} exc`
                                  : ""}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] tabular-nums">
                                <span className="text-muted-foreground">
                                  Work
                                </span>
                                <span className="font-semibold text-[#002855]">
                                  {p.workCompletionRate}% (
                                  {p.completedWorkCount}/{p.assignedWorkCount})
                                </span>
                              </div>
                              <MeterBar
                                value={p.workCompletionRate}
                                color="#007377"
                              />
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                Asgn {p.assignmentsCompletedCount}/
                                {p.assignmentsAssignedCount} · Tsk{" "}
                                {p.tasksCompletedCount}/{p.tasksAssignedCount}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
                            <Badge
                              className={
                                p.warningsCount > 0
                                  ? "gap-1 bg-[#ba0c2f] text-white text-[10px]"
                                  : "border border-border bg-[#f8f9fb] text-muted-foreground text-[10px]"
                              }
                            >
                              Warnings: {p.warningsCount}
                            </Badge>
                            {p.recognitionsCount > 0 && (
                              <Badge className="bg-[#f0f9e8] text-[#1e6b0a] text-[10px]">
                                Recog: {p.recognitionsCount}
                              </Badge>
                            )}
                            {p.internalNotesCount !== null &&
                              p.internalNotesCount > 0 && (
                                <Badge className="bg-[#f5edf7] text-[#5a1b63] text-[10px]">
                                  Notes: {p.internalNotesCount}
                                </Badge>
                              )}
                            {p.overdueCount > 0 && (
                              <Badge className="bg-[#fdecec] text-[#ba0c2f] text-[10px]">
                                {p.overdueCount} overdue
                              </Badge>
                            )}
                            <span className="ml-auto font-mono text-muted-foreground">
                              Att {p.attendancePoints} · Work{" "}
                              {p.assignmentPoints + p.taskPoints} · Adj{" "}
                              {netAdj >= 0 ? `+${netAdj}` : netAdj}
                            </span>
                          </div>

                          {p.statusFlag === "needs_attention" && (
                            <p className="rounded-md bg-[#fdecec] px-2.5 py-1.5 text-[11px] font-semibold text-[#ba0c2f]">
                              Needs attention: {p.attentionReasons.join(" · ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
        </>
      )}
    </div>
  );
}
