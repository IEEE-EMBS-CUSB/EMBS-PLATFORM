"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MemberCombobox } from "@/components/ui/member-combobox";
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
  sourceType: "attendance" | "task" | "assignment" | "event" | "manual_override";
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
  currentUserName?: string;
  defaultMonth?: string;
  canChooseOpenScope?: boolean;
  readOnly?: boolean;
  scopedTrackName?: string;
  onAddEntry?: (input: {
    membershipId: string;
    points: number;
    month: string;
    reason: string;
    postingScope?: "committee" | "open";
  }) => Promise<{ ok: boolean; id?: string; error?: string } | void>;
}

export function PointsLedgerView({
  entries: initialEntries,
  members,
  currentUserName = "HR Team",
  defaultMonth,
  canChooseOpenScope = false,
  readOnly = false,
  scopedTrackName,
  onAddEntry,
}: PointsLedgerViewProps) {
  const resolvedDefaultMonth =
    defaultMonth ?? new Date().toISOString().slice(0, 7);

  const [entries, setEntries] = useState(initialEntries);
  const [prevInitialEntries, setPrevInitialEntries] = useState(initialEntries);
  if (initialEntries !== prevInitialEntries) {
    setPrevInitialEntries(initialEntries);
    setEntries(initialEntries);
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New adjustment form state
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pointsDelta, setPointsDelta] = useState("10");
  const [month, setMonth] = useState(resolvedDefaultMonth);
  const [postingScope, setPostingScope] = useState<"committee" | "open">(
    "committee"
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.memberEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reason.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === "all" || entry.sourceType === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;

    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (!targetMember) {
      setFormError("Please select a target member.");
      return;
    }

    const pts = parseInt(pointsDelta, 10);
    if (Number.isNaN(pts) || pts === 0) {
      setFormError("Points adjustment must be a non-zero integer.");
      return;
    }

    const targetMonth = month.trim() || resolvedDefaultMonth;
    setIsSubmitting(true);
    setFormError(null);

    try {
      let createdId = `led-${Date.now()}`;
      if (onAddEntry) {
        const res = await onAddEntry({
          membershipId: targetMember.id,
          points: pts,
          month: targetMonth,
          reason: reason.trim(),
          ...(canChooseOpenScope ? { postingScope } : {}),
        });
        if (res && !res.ok) {
          setFormError(res.error ?? "Failed to save adjustment.");
          return;
        }
        if (res && res.id) createdId = res.id;
      }

      const newEntry: LedgerEntryItem = {
        id: createdId,
        membershipId: targetMember.id,
        memberName: targetMember.fullName,
        memberEmail: targetMember.email,
        committeeName: targetMember.committeeName,
        month: targetMonth,
        sourceType: "manual_override",
        points: pts,
        reason: reason.trim(),
        createdByName: currentUserName,
        createdAt: new Date().toISOString(),
      };

      setEntries((prev) => [newEntry, ...prev]);
      setIsModalOpen(false);
      setReason("");
      setPointsDelta("10");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save adjustment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSourceBadge = (source: LedgerEntryItem["sourceType"]) => {
    switch (source) {
      case "manual_override":
        return (
          <span className="inline-flex items-center rounded-md bg-[#fff8e6] px-2 py-0.5 text-xs font-semibold text-[#92400e] border border-[#ffc627]/60">
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
          <span className="inline-flex items-center rounded-md bg-[#f5edf7] px-2 py-0.5 text-xs font-semibold text-[#5a1b63] border border-[#772583]/25">
            Task
          </span>
        );
      case "assignment":
        return (
          <span className="inline-flex items-center rounded-md bg-[#ebf3f8] px-2 py-0.5 text-xs font-semibold text-[#00629b] border border-[#b2d5ea]">
            Assignment
          </span>
        );
      case "event":
        return (
          <span className="inline-flex items-center rounded-md bg-[#eef8e0] px-2 py-0.5 text-xs font-semibold text-[#2f600b] border border-[#78be20]/40">
            Event
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
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Point Override Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly
              ? "Deterministic read-only audit trail for points across your managed committees."
              : "Deterministic audit trail for all point transactions and manual adjustments."}
          </p>
        </div>

        {!readOnly && (
          <Button
            type="button"
            disabled={members.length === 0}
            onClick={() => {
              setFormError(null);
              setSelectedMemberId("");
              setIsModalOpen(true);
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Adjust Points</span>
          </Button>
        )}
      </div>

      {readOnly && (
        <div className="flex items-start gap-3 rounded-lg border border-[#00629b]/25 bg-[#f0f6fa] p-4 text-xs text-[#002855]">
          <Eye
            className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]"
            aria-hidden="true"
          />
          <div>
            <span className="font-bold">Read-Only Audit View:</span>{" "}
            {scopedTrackName
              ? `Showing points ledger entries filtered to ${scopedTrackName}. `
              : "Showing points ledger entries across your managed committees. "}
            Manual point overrides are managed by HR and Master Admin.
          </div>
        </div>
      )}

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
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b] sm:w-auto"
              >
                <option value="all">All Types</option>
                <option value="manual_override">Manual Overrides</option>
                <option value="attendance">Attendance</option>
                <option value="task">Tasks</option>
                <option value="assignment">Assignments</option>
                <option value="event">Events</option>
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
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#78be20]/10 px-2.5 py-0.5 text-xs text-[#1e6b0a] border border-[#78be20]/40">
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />+
                          {entry.points} pts
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ba0c2f]/10 px-2.5 py-0.5 text-xs text-[#ba0c2f] border border-[#ba0c2f]/30">
                          <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                          {entry.points} pts
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
          aria-label="Log Point Adjustment"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-[#002855]">
                Log Point Adjustment
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close modal"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="mt-4 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="memberSelect"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Select Member
                </label>
                <div className="mt-1">
                  <MemberCombobox
                    id="memberSelect"
                    ariaLabel="Select member"
                    options={members}
                    value={selectedMemberId}
                    onChange={setSelectedMemberId}
                    placeholder="Type a member's name, email, or committee..."
                    required
                  />
                </div>
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
                    placeholder="2026-11"
                    pattern="\d{4}-(0[1-9]|1[0-2])"
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

              {canChooseOpenScope && (
                <div>
                  <label
                    htmlFor="scopeSelect"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Board Scope
                  </label>
                  <select
                    id="scopeSelect"
                    value={postingScope}
                    onChange={(e) =>
                      setPostingScope(e.target.value as "committee" | "open")
                    }
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  >
                    <option value="committee">
                      Member&apos;s Committee Board + Global
                    </option>
                    <option value="open">
                      Org-Wide (All Eligible Committee Boards + Global)
                    </option>
                  </select>
                </div>
              )}

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
                  disabled={isSubmitting}
                  className="bg-[#772583] text-white hover:bg-[#5a1b63]"
                >
                  {isSubmitting ? "Saving..." : "Save Adjustment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
