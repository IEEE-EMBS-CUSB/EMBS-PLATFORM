"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle,
  Copy,
  Play,
  Plus,
  Sparkles,
  X,
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
  onCreateSeason?: (input: {
    name: string;
    startDate: string;
    endDate?: string;
  }) => Promise<{ ok: boolean; seasonId?: string; error?: string } | void>;
  onCloneSeason?: (
    sourceSeasonId: string,
    newName: string,
    options?: { includeRoster?: boolean }
  ) => Promise<{ ok: boolean; seasonId?: string; error?: string } | void>;
  onActivateSeason?: (
    seasonId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onArchiveSeason?: (
    seasonId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
}

export function SeasonManagerView({
  seasons: initialSeasons,
  currentUserRole = "master_admin",
  onCreateSeason,
  onCloneSeason,
  onActivateSeason,
  onArchiveSeason,
}: SeasonManagerViewProps) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<SeasonItem | null>(null);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [includeRoster, setIncludeRoster] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  // Create season form state
  const [createName, setCreateName] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Transition state
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = canManageSeasons(currentUserRole);
  const activeSeason = seasons.find((s) => s.status === "active");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCloneModalOpen(false);
        setCreateModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleOpenClone = (season: SeasonItem) => {
    setSelectedSeason(season);
    setNewSeasonName(
      `${season.name.replace(/\d{4}/, (y) => (parseInt(y, 10) + 1).toString())}`
    );
    setIncludeRoster(false);
    setCloneSuccess(false);
    setCloneError(null);
    setCloneModalOpen(true);
  };

  const handleExecuteClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim() || !selectedSeason) return;
    setIsCloning(true);
    setCloneError(null);
    try {
      let createdId = `draft-${Date.now()}`;
      if (onCloneSeason) {
        const res = await onCloneSeason(
          selectedSeason.id,
          newSeasonName.trim(),
          { includeRoster }
        );
        if (res && !res.ok) {
          setCloneError(res.error ?? "Failed to clone season.");
          return;
        }
        if (res && res.seasonId) {
          createdId = res.seasonId;
        }
      }
      setSeasons((prev) => [
        {
          id: createdId,
          name: newSeasonName.trim(),
          status: "draft",
          startDate: selectedSeason.startDate,
          endDate: selectedSeason.endDate,
          committeeCount: selectedSeason.committeeCount,
          memberCount: includeRoster ? selectedSeason.memberCount : 0,
        },
        ...prev,
      ]);
      setCloneSuccess(true);
      setTimeout(() => {
        setCloneModalOpen(false);
        setCloneSuccess(false);
      }, 1000);
    } catch (err: unknown) {
      setCloneError(err instanceof Error ? err.message : "Error cloning season");
    } finally {
      setIsCloning(false);
    }
  };

  const handleExecuteCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createStartDate) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      let createdId = `season-${Date.now()}`;
      if (onCreateSeason) {
        const res = await onCreateSeason({
          name: createName.trim(),
          startDate: createStartDate,
          endDate: createEndDate || undefined,
        });
        if (res && !res.ok) {
          setCreateError(res.error ?? "Failed to create season.");
          return;
        }
        if (res && res.seasonId) {
          createdId = res.seasonId;
        }
      }
      setSeasons((prev) => [
        {
          id: createdId,
          name: createName.trim(),
          status: "draft",
          startDate: new Date(createStartDate),
          endDate: createEndDate ? new Date(createEndDate) : null,
          committeeCount: 0,
          memberCount: 0,
        },
        ...prev,
      ]);
      setCreateModalOpen(false);
      setCreateName("");
      setCreateStartDate("");
      setCreateEndDate("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error creating season");
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivate = async (season: SeasonItem) => {
    if (
      !window.confirm(
        `Activate "${season.name}"? The current active season will be permanently archived.`
      )
    ) {
      return;
    }
    setTransitioningId(season.id);
    setActionError(null);
    try {
      if (onActivateSeason) {
        const res = await onActivateSeason(season.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to activate season.");
          return;
        }
      }
      setSeasons((prev) =>
        prev.map((s) => {
          if (s.id === season.id) return { ...s, status: "active" };
          if (s.status === "active") return { ...s, status: "archived" };
          return s;
        })
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to activate season.");
    } finally {
      setTransitioningId(null);
    }
  };

  const handleArchive = async (season: SeasonItem) => {
    if (
      !window.confirm(
        `Permanently archive "${season.name}"? Archived seasons are read-only and cannot be re-activated.`
      )
    ) {
      return;
    }
    setTransitioningId(season.id);
    setActionError(null);
    try {
      if (onArchiveSeason) {
        const res = await onArchiveSeason(season.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to archive season.");
          return;
        }
      }
      setSeasons((prev) =>
        prev.map((s) => (s.id === season.id ? { ...s, status: "archived" } : s))
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to archive season.");
    } finally {
      setTransitioningId(null);
    }
  };

  return (
    <div className="space-y-8">
      {!canManage && (
        <div className="rounded-lg border border-[#ffc627]/40 bg-[#fffbeb] p-3 text-xs text-[#92400e]">
          <strong>Master Authority Required:</strong> Only the Master Administrator has authority to create, clone, or transition seasons.
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {actionError}
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

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateError(null);
                setCreateModalOpen(true);
              }}
              className="h-11 gap-2 border-border px-4 text-sm font-semibold text-[#002855] hover:bg-[#ebf3f8]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>New Season</span>
            </Button>
            {activeSeason && (
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
        )}
      </div>

      {/* Season Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seasons.map((season) => {
          const isActive = season.status === "active";
          const isArchived = season.status === "archived";
          const isDraft = season.status === "draft";

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
                    {new Date(season.startDate).toLocaleDateString("en-US", {
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

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canManage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenClone(season)}
                        className="h-8 gap-1 border-border text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Clone</span>
                      </Button>
                    )}

                    {canManage && isDraft && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={transitioningId === season.id}
                        onClick={() => handleActivate(season)}
                        className="h-8 gap-1 bg-[#1e6b0a] text-xs font-semibold text-white hover:bg-[#165207]"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Activate</span>
                      </Button>
                    )}

                    {canManage && isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={transitioningId === season.id}
                        onClick={() => handleArchive(season)}
                        className="h-8 gap-1 border-[#ba0c2f]/30 text-xs font-semibold text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Archive</span>
                      </Button>
                    )}
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e6b0a]">
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

      {/* Create New Season Modal */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-season-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close create season modal"
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <h2
              id="create-season-title"
              className="font-heading text-lg font-bold text-[#002855]"
            >
              Create New Draft Season
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Starts in draft mode until you configure committees and activate it.
            </p>

            <form onSubmit={handleExecuteCreate} className="mt-4 space-y-4">
              {createError && (
                <div
                  role="alert"
                  className="rounded-lg bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
                >
                  {createError}
                </div>
              )}

              <div>
                <label
                  htmlFor="create-season-name"
                  className="block text-xs font-semibold text-[#002855]"
                >
                  Season Name
                </label>
                <Input
                  id="create-season-name"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Spring 2027"
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="create-season-start"
                    className="block text-xs font-semibold text-[#002855]"
                  >
                    Start Date
                  </label>
                  <Input
                    id="create-season-start"
                    type="date"
                    required
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-season-end"
                    className="block text-xs font-semibold text-[#002855]"
                  >
                    End Date (Optional)
                  </label>
                  <Input
                    id="create-season-end"
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="h-9 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                >
                  {isCreating ? "Creating..." : "Create Draft Season"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clone Season Modal Dialog */}
      {cloneModalOpen && selectedSeason && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clone-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCloneModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#772583]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5edf7]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="clone-dialog-title"
                  className="font-heading text-lg font-bold text-[#002855]"
                >
                  Clone Season: {selectedSeason.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Zero-code rollover for the upcoming academic year.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-foreground/80">
              This creates a new draft season and copies{" "}
              <strong>committees and scoring rubrics</strong> from{" "}
              <strong>{selectedSeason.name}</strong>. Attendance and score records are never copied so historical records remain untouched.
            </p>

            <form onSubmit={handleExecuteClone} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="new-season-name"
                  className="block text-xs font-semibold text-[#002855]"
                >
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

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={includeRoster}
                  onChange={(e) => setIncludeRoster(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span>Also carry over active roster memberships</span>
              </label>

              {cloneError && (
                <div
                  role="alert"
                  className="rounded-lg bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
                >
                  {cloneError}
                </div>
              )}
              {cloneSuccess && (
                <div className="rounded-lg bg-[#ebf3f8] p-3 text-xs font-semibold text-[#00629b]">
                  Season cloned successfully into draft!
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
                  disabled={cloneSuccess || isCloning}
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
