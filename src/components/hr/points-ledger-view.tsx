"use client";

import { useState } from "react";
import { Plus, Search, X, ArrowUpRight, ArrowDownRight } from "lucide-react";
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

export interface LedgerEntryItem {
  id: string;
  membershipId: string;
  memberName: string;
  memberEmail: string;
  committeeName: string;
  month: string;
  sourceType: "attendance" | "task" | "event" | "manual_override";
  points: number;
  reason: string;
  createdByName?: string;
  createdAt: string;
}

export interface MemberOption {
  id: string;
  fullName: string;
  committeeName: string;
  email: string;
}

interface PointsLedgerViewProps {
  entries: LedgerEntryItem[];
  members: MemberOption[];
}

export function PointsLedgerView({
  entries: initialEntries,
  members,
}: PointsLedgerViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New adjustment form state
  const [selectedMemberId, setSelectedMemberId] = useState(
    members[0]?.id || ""
  );
  const [pointsDelta, setPointsDelta] = useState("10");
  const [month, setMonth] = useState("2026-10");
  const [reason, setReason] = useState("");

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.memberEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reason.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === "all" || entry.sourceType === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (!targetMember) return;

    const pts = parseInt(pointsDelta, 10) || 0;
    const newEntry: LedgerEntryItem = {
      id: `led-${Date.now()}`,
      membershipId: targetMember.id,
      memberName: targetMember.fullName,
      memberEmail: targetMember.email,
      committeeName: targetMember.committeeName,
      month: month || "2026-10",
      sourceType: "manual_override",
      points: pts,
      reason: reason.trim(),
      createdByName: "HR Admin",
      createdAt: new Date().toISOString(),
    };

    setEntries([newEntry, ...entries]);
    setIsModalOpen(false);
    setReason("");
    setPointsDelta("10");
  };

  const getSourceBadge = (source: LedgerEntryItem["sourceType"]) => {
    switch (source) {
      case "manual_override":
        return (
          <span className="inline-flex items-center rounded-md bg-[#fff8e6] px-2 py-0.5 text-xs font-semibold text-[#b25e00] border border-[#ffe199]">
            Manual Override
          </span>
        );
      case "attendance":
        return (
          <span className="inline-flex items-center rounded-md bg-[#e6f4f5] px-2 py-0.5 text-xs font-semibold text-[#007377] border border-[#b3e0e2]">
            Attendance
          </span>
        );
      case "task":
        return (
          <span className="inline-flex items-center rounded-md bg-[#ebf3f8] px-2 py-0.5 text-xs font-semibold text-[#00629b] border border-[#b2d5ea]">
            Task
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground border">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Point Override Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deterministic audit trail for all point transactions and manual adjustments.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#772583] text-white hover:bg-[#5a1b63]"
        >
          <Plus className="h-4 w-4" />
          + Adjust Points
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by member or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
              >
                <option value="all">All Types</option>
                <option value="manual_override">Manual Overrides</option>
                <option value="attendance">Attendance</option>
                <option value="task">Tasks</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-border">
        <CardHeader className="border-b bg-[#fafafa] px-6 py-4">
          <CardTitle className="text-base font-semibold text-[#002855]">
            Ledger Records ({filteredEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="min-w-[200px]">Reason</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Author</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No ledger entries matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.createdAt.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">
                        {entry.memberName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.memberEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {entry.committeeName}
                    </TableCell>
                    <TableCell>{getSourceBadge(entry.sourceType)}</TableCell>
                    <TableCell className="text-xs text-foreground/90">
                      {entry.reason}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {entry.points >= 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f0f9eb] px-2.5 py-0.5 text-xs text-[#408c10] border border-[#c4e8aa]">
                          <ArrowUpRight className="h-3 w-3" />+{entry.points} pts
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fdf2f2] px-2.5 py-0.5 text-xs text-[#cc0000] border border-[#f9c5c5]">
                          <ArrowDownRight className="h-3 w-3" />{entry.points} pts
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.createdByName || "System"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjust Points Modal Dialog */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-[#002855]">
                Log Point Adjustment
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="memberSelect"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Select Member
                </label>
                <select
                  id="memberSelect"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.committeeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="monthInput"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Month (YYYY-MM)
                  </label>
                  <Input
                    id="monthInput"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-1"
                    placeholder="2026-10"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="pointsInput"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Points Adjustment
                  </label>
                  <Input
                    id="pointsInput"
                    type="number"
                    value={pointsDelta}
                    onChange={(e) => setPointsDelta(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. 10 or -5"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reasonInput"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Reason
                </label>
                <textarea
                  id="reasonInput"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why points are being awarded or deducted..."
                  className="mt-1 block w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#772583] text-white hover:bg-[#5a1b63]"
                >
                  Save Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
