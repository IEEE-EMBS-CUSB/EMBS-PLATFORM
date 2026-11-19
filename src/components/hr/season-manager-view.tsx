"use client";

import { useState } from "react";
import {
  CheckCircle,
  Copy,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canManageSeasons } from "@/lib/permissions";

export interface SeasonItem {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  startDate: Date;
  endDate?: Date | null;
  committeeCount: number;
  memberCount: number;
}

interface SeasonManagerViewProps {
  seasons: SeasonItem[];
  currentUserRole?: MembershipRole;
}

export function SeasonManagerView({
  seasons,
  currentUserRole = "master_admin",
}: SeasonManagerViewProps) {
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<SeasonItem | null>(null);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [cloneSuccess, setCloneSuccess] = useState(false);

  const canManage = canManageSeasons(currentUserRole);
  const activeSeason = seasons.find((s) => s.status === "active");

  const handleOpenClone = (season: SeasonItem) => {
    setSelectedSeason(season);
    setNewSeasonName(`${season.name.replace(/\d{4}/, (y) => (parseInt(y, 10) + 1).toString())}`);
    setCloneSuccess(false);
    setCloneModalOpen(true);
  };

  const handleExecuteClone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    // Client-side simulation of the clone action; in live integration calls server action
    setCloneSuccess(true);
    setTimeout(() => {
      setCloneModalOpen(false);
      setCloneSuccess(false);
    }, 1500);
  };

  return (
    <div className="space-y-8">
      {!canManage && (
        <div className="rounded-lg border border-[#ffc627]/40 bg-[#fffbeb] p-3 text-xs text-[#92400e]">
          <strong>Master Authority Required:</strong> Only the Master Administrator has authority to create, clone, or transition seasons.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Season Lifecycle & Rollover
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage active operational seasons and clone settings for instant next-year chapter turnover.
          </p>
        </div>

        {canManage && activeSeason && (
          <Button
            type="button"
            onClick={() => handleOpenClone(activeSeason)}
            className="h-11 gap-2 bg-[#772583] px-5 text-sm font-semibold text-white hover:bg-[#5a1b63]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            <span>Clone Season</span>
          </Button>
        )}
      </div>

      {/* Season Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seasons.map((season) => {
          const isActive = season.status === "active";
          const isArchived = season.status === "archived";

          return (
            <Card
              key={season.id}
              className={`border bg-white shadow-xs transition-all ${
                isActive
                  ? "border-[#772583] ring-2 ring-[#772583]/15"
                  : "border-border"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={
                      isActive
                        ? "default"
                        : isArchived
                          ? "secondary"
                          : "outline"
                    }
                    className={
                      isActive
                        ? "bg-[#772583] text-white"
                        : isArchived
                          ? "bg-muted text-muted-foreground"
                          : "border-border text-foreground"
                    }
                  >
                    {isActive ? "Active" : isArchived ? "Archived" : "Draft"}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {season.startDate.toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <CardTitle className="mt-2 font-heading text-xl font-bold text-[#002855]">
                  {season.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 border-y border-border/70 py-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Committees:</span>
                    <p className="font-heading font-bold text-[#002855]">
                      {season.committeeCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Members:</span>
                    <p className="font-heading font-bold text-[#002855]">
                      {season.memberCount}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenClone(season)}
                    className="h-9 gap-1.5 border-border text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clone</span>
                  </Button>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#78be20]">
                      <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Current Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isArchived ? "Permanently locked" : "Draft season"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Clone Season Modal Dialog */}
      {cloneModalOpen && selectedSeason && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clone-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#772583]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5edf7]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="clone-dialog-title" className="font-heading text-lg font-bold text-[#002855]">
                  Clone Season: {selectedSeason.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Zero-code rollover for the upcoming academic year.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-foreground/80">
              This will create a new draft season and <strong>copy committees and scoring rubrics</strong> from{" "}
              <strong>{selectedSeason.name}</strong>. Roster members and attendance records are not copied so the new team starts fresh.
            </p>

            <form onSubmit={handleExecuteClone} className="mt-5 space-y-4">
              <div>
                <label htmlFor="new-season-name" className="block text-xs font-semibold text-[#002855]">
                  New Season Name
                </label>
                <Input
                  id="new-season-name"
                  type="text"
                  required
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g. 2027-2028 or Fall 2027"
                  className="mt-1.5 h-11 text-sm"
                />
              </div>

              {cloneSuccess && (
                <div className="rounded-lg bg-[#ebf3f8] p-3 text-xs font-semibold text-[#00629b]">
                  ✓ Season cloned successfully into draft!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCloneModalOpen(false)}
                  className="h-10 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={cloneSuccess}
                  className="h-10 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                >
                  Create Cloned Season
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
