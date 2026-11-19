"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Lock,
  Minus,
  Unlock,
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
  onPublish?: (month: string) => void;
}

export function LeaderboardPublisherView({
  snapshot,
  availableMonths,
  onPublish,
}: LeaderboardPublisherViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(snapshot.month);
  const [status, setStatus] = useState<"draft" | "published">(snapshot.status);
  const [activeTab, setActiveTab] = useState<"overall" | "committees">(
    "overall"
  );

  const handlePublishClick = () => {
    setStatus("published");
    if (onPublish) {
      onPublish(selectedMonth);
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
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#408c10]">
          ▲ {delta}
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#cc0000]">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Monthly Leaderboard Publisher
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview auto-calculated monthly rankings and freeze the deterministic historical snapshot.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
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
              onClick={handlePublishClick}
              className="inline-flex items-center gap-2 bg-[#772583] text-white hover:bg-[#5a1b63]"
            >
              <Lock className="h-4 w-4" />
              Publish & Freeze Rankings
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4e8aa] bg-[#f0f9eb] px-3 py-2 text-xs font-bold text-[#408c10]">
              <CheckCircle2 className="h-4 w-4" />
              Published & Locked
            </span>
          )}
        </div>
      </div>

      {/* Snapshot Status Card */}
      <div
        className={`rounded-xl border p-4 text-xs ${
          status === "published"
            ? "border-[#c4e8aa] bg-[#f0f9eb]/60 text-[#1b4308]"
            : "border-[#fed7aa] bg-[#fffaf5] text-[#7c2d12]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === "published" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#408c10] px-2 py-0.5 text-xs font-bold text-white">
                <Lock className="h-3 w-3" />
                Published & Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#ff9800] px-2 py-0.5 text-xs font-bold text-white">
                <Unlock className="h-3 w-3" />
                Draft · Unlocked
              </span>
            )}
            <span className="font-semibold">Month: {selectedMonth}</span>
          </div>

          <div className="text-muted-foreground">
            {status === "published"
              ? "Historical scores locked. Public portal shows this snapshot."
              : "Live calculation from Score Ledger. Changes to attendance or tasks will alter these ranks."}
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
                    <TableCell>{renderTrend(entry.rank, entry.previousRank)}</TableCell>
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(snapshot.committeeEntries).map(([slug, committeeList]) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
