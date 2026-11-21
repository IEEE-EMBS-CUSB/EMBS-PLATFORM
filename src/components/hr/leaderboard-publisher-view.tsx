"use client";

import { useState } from "react";
import { CheckCircle2, Lock, Minus, Unlock } from "lucide-react";
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
import type { CalculatedSnapshotEntry } from "@/services/hr.service";

export interface SnapshotDisplayData {
  month: string;
  status: "draft" | "published";
  publishedAt?: string;
  publishedByName?: string;
  overallEntries: CalculatedSnapshotEntry[];
  committeeEntries: Record<string, CalculatedSnapshotEntry[]>;
}

interface LeaderboardPublisherViewProps {
  snapshot: SnapshotDisplayData;
  availableMonths: string[];
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
  onPublish,
  onLoadMonth,
}: LeaderboardPublisherViewProps) {
  const [snapshot, setSnapshot] = useState<SnapshotDisplayData>(initialSnapshot);
  const [selectedMonth, setSelectedMonth] = useState(initialSnapshot.month);
  const [activeTab, setActiveTab] = useState<"overall" | "committees">(
    "overall"
  );
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMonthChange = async (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    setErrorMessage(null);
    if (!onLoadMonth) return;

    setIsLoadingMonth(true);
    try {
      const res = await onLoadMonth(nextMonth);
      if (res.ok) {
        setSnapshot(res.snapshot);
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

  const handlePublishClick = async () => {
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
      setSnapshot((prev) => ({
        ...prev,
        month: selectedMonth,
        status: "published",
        publishedAt: new Date().toISOString().slice(0, 10),
      }));
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to publish leaderboard."
      );
    } finally {
      setIsPublishing(false);
    }
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

  const status = snapshot.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Monthly Leaderboard Publisher
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview auto-calculated monthly rankings and freeze the deterministic historical snapshot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select publishing month"
            value={selectedMonth}
            disabled={isLoadingMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                Month: {m}
              </option>
            ))}
          </select>

          {status === "draft" ? (
            <Button
              type="button"
              disabled={isPublishing || isLoadingMonth}
              onClick={handlePublishClick}
              className="inline-flex items-center gap-2 bg-[#772583] text-white hover:bg-[#5a1b63]"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {isPublishing ? "Publishing..." : "Publish & Freeze Rankings"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#78be20]/40 bg-[#78be20]/10 px-3 py-2 text-xs font-bold text-[#1e6b0a]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Published & Locked
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {errorMessage}
        </div>
      )}

      {/* Snapshot Status Card */}
      <div
        className={`rounded-xl border p-4 text-xs ${
          status === "published"
            ? "border-[#78be20]/40 bg-[#78be20]/10 text-[#1e6b0a]"
            : "border-[#ffc627]/50 bg-[#fffbeb] text-[#002855]"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {status === "published" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#1e6b0a] px-2 py-0.5 text-xs font-bold text-white">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Published & Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#ffc627] px-2 py-0.5 text-xs font-bold text-[#002855]">
                <Unlock className="h-3 w-3" aria-hidden="true" />
                Draft · Unlocked
              </span>
            )}
            <span className="font-semibold">
              Month: {snapshot.month}
              {isLoadingMonth ? " (Loading...)" : ""}
            </span>
          </div>

          <div className="text-muted-foreground">
            {status === "published"
              ? "Historical scores locked. Public portal shows this snapshot."
              : "Live calculation from Score Ledger. Changes to attendance or tasks will alter these ranks until published."}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("overall")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "overall"
              ? "border-[#772583] text-[#772583]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overall Top 10
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
      {activeTab === "overall" ? (
        <Card className="border-border">
          <CardHeader className="border-b bg-[#fafafa] px-6 py-4">
            <CardTitle className="text-base font-semibold text-[#002855]">
              Overall Chapter Rankings ({snapshot.overallEntries.length} Members)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Rank</TableHead>
                  <TableHead className="w-[80px]">Trend</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead className="text-right">Monthly Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.overallEntries.map((entry) => (
                  <TableRow key={entry.memberId}>
                    <TableCell>{getRankBadge(entry.rank)}</TableCell>
                    <TableCell>
                      {renderTrend(entry.rank, entry.previousRank)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">
                        {entry.memberName}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {entry.role.replace("_", " ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {entry.committeeName}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-[#00629b]">
                      {entry.monthlyScore} pts
                    </TableCell>
                  </TableRow>
                ))}
                {snapshot.overallEntries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No scored members recorded for {snapshot.month} yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {committeeList.map((m) => (
                        <TableRow key={m.memberId}>
                          <TableCell>{getRankBadge(m.rank)}</TableCell>
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
        </div>
      )}
    </div>
  );
}
