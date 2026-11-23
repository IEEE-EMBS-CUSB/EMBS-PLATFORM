"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  Minus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  classifyPublishingMonthState,
  formatPublishingMonthLabel,
} from "@/lib/publishing-state";
import type { CalculatedSnapshotEntry } from "@/services/hr.service";

export interface SnapshotDisplayData {
  month: string;
  status: "draft" | "published";
  publishedAt?: string;
  publishedByName?: string;
  committeeEntries: Record<string, CalculatedSnapshotEntry[]>;
}

interface LeaderboardPublisherViewProps {
  snapshot: SnapshotDisplayData;
  availableMonths: string[];
  monthStatuses?: Record<string, "draft" | "published">;
  currentMonth?: string;
  onPublish?: (
    month: string
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onLoadMonth?: (
    month: string
  ) => Promise<
    | { ok: true; snapshot: SnapshotDisplayData }
    | { ok: false; error?: string }
  >;
}

export function LeaderboardPublisherView({
  snapshot: initialSnapshot,
  availableMonths,
  monthStatuses: initialMonthStatuses,
  currentMonth,
  onPublish,
  onLoadMonth,
}: LeaderboardPublisherViewProps) {
  const effectiveCurrentMonth =
    currentMonth ?? new Date().toISOString().slice(0, 7);

  const [snapshot, setSnapshot] = useState<SnapshotDisplayData>(initialSnapshot);
  const [selectedMonth, setSelectedMonth] = useState(initialSnapshot.month);
  const [monthStatusMap, setMonthStatusMap] = useState<
    Record<string, "draft" | "published">
  >(() => ({
    ...(initialMonthStatuses ?? {}),
    [initialSnapshot.month]: initialSnapshot.status,
  }));
  const [activeTab, setActiveTab] = useState<"leaders" | "committees">(
    "leaders"
  );
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [confirmEarlyOpen, setConfirmEarlyOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmEarlyOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const phase = classifyPublishingMonthState(
    snapshot.month,
    snapshot.status,
    effectiveCurrentMonth
  );
  const monthLabel = formatPublishingMonthLabel(snapshot.month);

  // Detect if another past month is awaiting review while viewing a different month
  const otherDueReviewMonth = useMemo(() => {
    return availableMonths.find((m) => {
      if (m === selectedMonth) return false;
      const st = monthStatusMap[m] ?? "draft";
      return (
        classifyPublishingMonthState(m, st, effectiveCurrentMonth) ===
        "due_review"
      );
    });
  }, [availableMonths, selectedMonth, monthStatusMap, effectiveCurrentMonth]);

  const handleMonthChange = async (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    setErrorMessage(null);
    setConfirmEarlyOpen(false);
    if (!onLoadMonth) return;

    setIsLoadingMonth(true);
    try {
      const res = await onLoadMonth(nextMonth);
      if (res.ok) {
        setSnapshot(res.snapshot);
        setMonthStatusMap((prev) => ({
          ...prev,
          [res.snapshot.month]: res.snapshot.status,
        }));
      } else {
        setErrorMessage(res.error ?? "Failed to load selected month.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load selected month."
      );
    } finally {
      setIsLoadingMonth(false);
    }
  };

  const executePublish = async () => {
    if (isPublishing || snapshot.status === "published") return;
    setIsPublishing(true);
    setErrorMessage(null);
    try {
      if (onPublish) {
        const res = await onPublish(selectedMonth);
        if (res && typeof res === "object" && "ok" in res && !res.ok) {
          setErrorMessage(res.error ?? "Failed to publish leaderboard.");
          return;
        }
      }
      setConfirmEarlyOpen(false);
      setSnapshot((prev) => ({
        ...prev,
        month: selectedMonth,
        status: "published",
        publishedAt: new Date().toISOString().slice(0, 10),
      }));
      setMonthStatusMap((prev) => ({
        ...prev,
        [selectedMonth]: "published",
      }));
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to publish leaderboard."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const formatOptionLabel = (m: string) => {
    const label = formatPublishingMonthLabel(m);
    const st = monthStatusMap[m];
    if (!st) return label;
    const p = classifyPublishingMonthState(m, st, effectiveCurrentMonth);
    if (p === "published") return `${label} — Published`;
    if (p === "due_review") return `${label} — Ready to Review`;
    return `${label} — In Progress`;
  };

  const renderTrend = (rank: number, previousRank: number | null) => {
    if (previousRank === null) {
      return (
        <span className="inline-flex items-center rounded-md bg-[#eef2f6] px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
          NEW
        </span>
      );
    }

    const delta = previousRank - rank;
    if (delta > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#1e6b0a]">
          ▲ {delta}
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#ba0c2f]">
          ▼ {Math.abs(delta)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
      </span>
    );
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ffc627] text-xs font-black text-[#002855]">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e2e8f0] text-xs font-black text-[#002855]">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fed7aa] text-xs font-black text-[#7c2d12]">
          3
        </span>
      );
    }
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center text-xs font-bold text-muted-foreground">
        {rank}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Monthly Leaderboard Publisher
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review ended months to publish and permanently freeze rankings, or
            preview live in-progress standings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select publishing month"
            value={selectedMonth}
            disabled={isLoadingMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-10 rounded-md border border-input bg-white px-3 py-1 text-sm font-medium text-[#002855] shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatOptionLabel(m)}
              </option>
            ))}
          </select>

          {phase === "due_review" ? (
            <Button
              type="button"
              disabled={isPublishing || isLoadingMonth}
              onClick={executePublish}
              className="inline-flex h-10 items-center gap-2 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {isPublishing ? "Publishing..." : "Publish & Freeze Rankings"}
            </Button>
          ) : phase === "in_progress" ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPublishing || isLoadingMonth}
              onClick={() => setConfirmEarlyOpen(true)}
              className="inline-flex h-10 items-center gap-2 border-[#002855]/30 px-4 text-xs font-semibold text-[#002855] hover:bg-[#f5edf7] hover:text-[#772583]"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Publish Early…
            </Button>
          ) : (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#78be20]/40 bg-[#78be20]/10 px-3 text-xs font-bold text-[#1e6b0a]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Published &amp; Locked
            </span>
          )}
        </div>
      </div>

      {otherDueReviewMonth && onLoadMonth && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#772583]/30 bg-[#f5edf7] px-4 py-3 text-xs text-[#5a1b63]">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {formatPublishingMonthLabel(otherDueReviewMonth)} has ended and is
              ready for review &amp; publishing.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => handleMonthChange(otherDueReviewMonth)}
            className="h-8 bg-[#772583] px-3 text-xs font-semibold text-white hover:bg-[#5a1b63]"
          >
            Review {formatPublishingMonthLabel(otherDueReviewMonth)}
          </Button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {errorMessage}
        </div>
      )}

      {/* 3-State Snapshot Status Banner */}
      <div
        className={`rounded-xl border p-4 text-xs ${
          phase === "published"
            ? "border-[#78be20]/40 bg-[#78be20]/10 text-[#1e6b0a]"
            : phase === "due_review"
              ? "border-[#ffc627]/70 bg-[#fffbeb] text-[#002855]"
              : "border-[#00629b]/30 bg-[#f0f6fa] text-[#002855]"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {phase === "published" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#1e6b0a] px-2.5 py-1 text-xs font-bold text-white">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Published &amp; Locked
              </span>
            ) : phase === "due_review" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#ffc627] px-2.5 py-1 text-xs font-bold text-[#002855]">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Ready to Review &amp; Publish
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#00629b] px-2.5 py-1 text-xs font-bold text-white">
                <Clock className="h-3 w-3" aria-hidden="true" />
                In Progress — Wait for Month End
              </span>
            )}
            <span className="font-heading text-sm font-bold text-[#002855]">
              {monthLabel}
              {isLoadingMonth ? " (Loading...)" : ""}
            </span>
          </div>

          <div className="text-muted-foreground sm:text-right">
            {phase === "published" ? (
              <span>
                Historical rankings permanently locked
                {snapshot.publishedAt ? ` on ${snapshot.publishedAt}` : ""}
                {snapshot.publishedByName
                  ? ` by ${snapshot.publishedByName}`
                  : ""}
                . Public leaderboards serve this snapshot.
              </span>
            ) : phase === "due_review" ? (
              <span>
                {monthLabel} has ended. Verify the standings below, then click{" "}
                <strong>Publish &amp; Freeze Rankings</strong> to lock the month.
              </span>
            ) : (
              <span>
                {monthLabel} is still underway. Scores update live as attendance,
                tasks, and assignments are logged — no action needed until month
                end.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("leaders")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "leaders"
              ? "border-[#772583] text-[#772583]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Committee Leaders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("committees")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "committees"
              ? "border-[#772583] text-[#772583]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          By Committee
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "leaders" ? (
        (() => {
          const committeeLeaders = Object.entries(snapshot.committeeEntries)
            .map(([slug, list]) => ({
              slug,
              leader: list[0] ?? null,
            }))
            .filter(
              (item): item is { slug: string; leader: CalculatedSnapshotEntry } =>
                item.leader !== null
            );
          return (
            <Card className="border-border">
              <CardHeader className="border-b bg-[#fafafa] px-6 py-4">
                <CardTitle className="text-base font-semibold text-[#002855]">
                  Committee Leaders ({committeeLeaders.length} Committees)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Committee</TableHead>
                      <TableHead className="w-[80px]">Trend</TableHead>
                      <TableHead>Top Member</TableHead>
                      <TableHead className="text-right">Monthly Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {committeeLeaders.map(({ slug, leader }) => (
                      <TableRow key={`${slug}-${leader.memberId}`}>
                        <TableCell className="text-xs font-semibold text-[#002855]">
                          {leader.committeeName || slug}
                        </TableCell>
                        <TableCell>
                          {renderTrend(leader.rank, leader.previousRank)}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {leader.memberName}
                          </div>
                          <div className="text-xs capitalize text-muted-foreground">
                            {leader.role.replace("_", " ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#00629b]">
                          {leader.monthlyScore} pts
                        </TableCell>
                      </TableRow>
                    ))}
                    {committeeLeaders.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No scored members recorded for {monthLabel} yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(snapshot.committeeEntries).map(
            ([slug, committeeList]) => (
              <Card key={slug} className="border-border">
                <CardHeader className="border-b bg-[#fafafa] px-6 py-3">
                  <CardTitle className="text-sm font-bold text-[#002855]">
                    {committeeList[0]?.committeeName || slug}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Rank</TableHead>
                        <TableHead className="w-[70px]">Trend</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {committeeList.map((m) => (
                        <TableRow key={m.memberId}>
                          <TableCell>{getRankBadge(m.rank)}</TableCell>
                          <TableCell>
                            {renderTrend(m.rank, m.previousRank)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {m.memberName}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-[#00629b]">
                            {m.monthlyScore} pts
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          )}
          {Object.keys(snapshot.committeeEntries).length === 0 && (
            <Card className="border-border md:col-span-2">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No scored committee members recorded for {monthLabel} yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Early Publish Confirmation Modal */}
      {confirmEarlyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Publish ${monthLabel} Early`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmEarlyOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-heading text-base font-bold text-[#002855]">
                Publish {monthLabel} Early?
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close early publish modal"
                onClick={() => setConfirmEarlyOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <strong>{monthLabel}</strong> has not ended yet. Publishing now
              permanently freezes rankings for this month and blocks any further
              point updates for {monthLabel}. Only proceed if all sessions,
              tasks, and assignments for {monthLabel} are completely finalized.
            </p>
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmEarlyOpen(false)}
                className="h-9 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPublishing}
                onClick={executePublish}
                className="h-9 bg-[#ba0c2f] px-4 text-xs font-semibold text-white hover:bg-[#9b0b27]"
              >
                {isPublishing ? "Publishing..." : "Confirm Publish Early"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
