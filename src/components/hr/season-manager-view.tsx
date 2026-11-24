"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle,
  CheckSquare,
  Copy,
  Lock,
  Megaphone,
  Pencil,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Settings2,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canManageCommittees,
  canManageRubrics,
  canManageSeasons,
} from "@/lib/permissions";
import {
  calculateRubricPoints,
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  validateSeasonSettings,
  type SeasonSettings,
  type TaskCompletionMode,
} from "@/lib/season-settings";

export interface SeasonTrackSummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  committeeCount: number;
  directorNames: string[];
}

export interface SeasonRubricSummary {
  id: string;
  name: string;
  maxPoints: number;
  weight: string;
  leadersOnly: boolean;
}

export interface SeasonItem {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  startDate: Date;
  endDate?: Date | null;
  committeeCount: number;
  memberCount: number;
  settings?: SeasonSettings;
  tracks?: SeasonTrackSummary[];
  rubrics?: SeasonRubricSummary[];
}

interface SeasonManagerViewProps {
  seasons: SeasonItem[];
  currentUserRole?: MembershipRole;
  onCreateSeason?: (input: {
    name: string;
    startDate: string;
    endDate?: string;
  }) => Promise<{ ok: boolean; seasonId?: string; error?: string } | void>;
  onUpdateSettings?: (
    seasonId: string,
    settings: SeasonSettings
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onCloneSeason?: (
    sourceSeasonId: string,
    newName: string,
    options?: { includeRoster?: boolean }
  ) => Promise<{ ok: boolean; seasonId?: string; error?: string } | void>;
  onActivateSeason?: (
    seasonId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAddTrack?: (input: {
    name: string;
    description?: string;
    seasonId?: string;
  }) => Promise<{ ok: boolean; trackId?: string; slug?: string; error?: string } | void>;
  onRenameTrack?: (input: {
    trackId: string;
    name: string;
    description?: string;
  }) => Promise<{ ok: boolean; error?: string } | void>;
  onDeleteTrack?: (
    trackId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAddRubric?: (input: {
    name: string;
    maxPoints: number;
    weight?: string;
    leadersOnly?: boolean;
    seasonId?: string;
  }) => Promise<{ ok: boolean; rubricId?: string; error?: string } | void>;
  onRemoveRubric?: (
    rubricId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
}

type SettingsTab = "grading" | "tracks";

function parseNonNegativeInt(raw: string, fallback = 0): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, n);
}

export function SeasonManagerView({
  seasons: initialSeasons,
  currentUserRole = "master_admin",
  onCreateSeason,
  onUpdateSettings,
  onCloneSeason,
  onActivateSeason,
  onAddTrack,
  onRenameTrack,
  onDeleteTrack,
}: SeasonManagerViewProps) {
  const [seasons, setSeasons] = useState<SeasonItem[]>(() =>
    initialSeasons.map((s) => ({
      ...s,
      settings: normalizeSeasonSettings(s.settings),
      tracks: s.tracks ?? [],
      rubrics: s.rubrics ?? [],
    }))
  );

  const defaultSelectedId =
    initialSeasons.find((s) => s.status === "active")?.id ??
    initialSeasons[0]?.id ??
    null;

  const [inspectedSeasonId, setInspectedSeasonId] = useState<string | null>(
    defaultSelectedId
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("grading");

  const inspectedSeason =
    seasons.find((s) => s.id === inspectedSeasonId) ?? seasons[0] ?? null;

  // Settings form state synced to the currently inspected season
  const [draftSettings, setDraftSettings] = useState<SeasonSettings>(() =>
    normalizeSeasonSettings(inspectedSeason?.settings)
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Track editor state
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackDesc, setNewTrackDesc] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);
  const [isSavingTrack, setIsSavingTrack] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTrackName, setEditTrackName] = useState("");
  const [editTrackDesc, setEditTrackDesc] = useState("");

  // Modals state
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cloneTargetSeason, setCloneTargetSeason] = useState<SeasonItem | null>(
    null
  );
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
  const canEditSettings = canManageRubrics(currentUserRole);
  const canEditTracks = canManageCommittees(currentUserRole);
  const activeSeason = seasons.find((s) => s.status === "active");

  const selectSeasonForSettings = (season: SeasonItem) => {
    setInspectedSeasonId(season.id);
    setDraftSettings(normalizeSeasonSettings(season.settings));
    setSettingsMessage(null);
    setSettingsError(null);
    setTrackError(null);
    setEditingTrackId(null);
    setSettingsTab("grading");
    setSettingsModalOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCloneModalOpen(false);
        setCreateModalOpen(false);
        setSettingsModalOpen(false);
        setEditingTrackId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleOpenClone = (season: SeasonItem) => {
    setCloneTargetSeason(season);
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
    if (!newSeasonName.trim() || !cloneTargetSeason) return;
    setIsCloning(true);
    setCloneError(null);
    try {
      let createdId = `draft-${Date.now()}`;
      if (onCloneSeason) {
        const res = await onCloneSeason(
          cloneTargetSeason.id,
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
      const clonedItem: SeasonItem = {
        id: createdId,
        name: newSeasonName.trim(),
        status: "draft",
        startDate: cloneTargetSeason.startDate,
        endDate: cloneTargetSeason.endDate,
        committeeCount: cloneTargetSeason.committeeCount,
        memberCount: includeRoster ? cloneTargetSeason.memberCount : 0,
        settings: normalizeSeasonSettings(cloneTargetSeason.settings),
        tracks: (cloneTargetSeason.tracks ?? []).map((t) => ({
          ...t,
          directorNames: includeRoster ? t.directorNames : [],
        })),
        rubrics: cloneTargetSeason.rubrics ?? [],
      };
      setSeasons((prev) => [clonedItem, ...prev]);
      selectSeasonForSettings(clonedItem);
      setCloneSuccess(true);
      setTimeout(() => {
        setCloneModalOpen(false);
        setCloneSuccess(false);
      }, 900);
    } catch (err: unknown) {
      setCloneError(
        err instanceof Error ? err.message : "Error cloning season"
      );
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
      const newItem: SeasonItem = {
        id: createdId,
        name: createName.trim(),
        status: "draft",
        startDate: new Date(createStartDate),
        endDate: createEndDate ? new Date(createEndDate) : null,
        committeeCount: 0,
        memberCount: 0,
        settings: normalizeSeasonSettings(DEFAULT_SEASON_SETTINGS),
        tracks: [
          {
            id: `trk-tech-${Date.now()}`,
            name: "Technical",
            slug: "technical",
            description: "Engineering, software, AI, and robotics committees.",
            committeeCount: 0,
            directorNames: [],
          },
          {
            id: `trk-creative-${Date.now()}`,
            name: "Creative",
            slug: "creative",
            description: "Design, media production, branding, and marketing.",
            committeeCount: 0,
            directorNames: [],
          },
          {
            id: `trk-ops-${Date.now()}`,
            name: "Operations",
            slug: "operations",
            description: "HR, PR, logistics, fundraising, and chapter ops.",
            committeeCount: 0,
            directorNames: [],
          },
        ],
        rubrics: [],
      };
      setSeasons((prev) => [newItem, ...prev]);
      selectSeasonForSettings(newItem);
      setCreateModalOpen(false);
      setCreateName("");
      setCreateStartDate("");
      setCreateEndDate("");
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Error creating season"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivate = async (season: SeasonItem) => {
    const confirmMessage =
      season.status === "archived"
        ? `Re-activate "${season.name}"? The current active season will be archived.`
        : `Activate "${season.name}"? The current active season will be archived.`;
    if (!window.confirm(confirmMessage)) {
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
      setActionError(
        err instanceof Error ? err.message : "Failed to activate season."
      );
    } finally {
      setTransitioningId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedSeason || inspectedSeason.status === "archived") return;

    const validation = validateSeasonSettings(draftSettings);
    if (!validation.ok) {
      setSettingsError(validation.error);
      setSettingsMessage(null);
      return;
    }

    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      if (onUpdateSettings) {
        const res = await onUpdateSettings(inspectedSeason.id, draftSettings);
        if (res && !res.ok) {
          setSettingsError(res.error ?? "Failed to save season settings.");
          return;
        }
      }
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === inspectedSeason.id ? { ...s, settings: draftSettings } : s
        )
      );
      setSettingsMessage("Season settings saved and applied.");
    } catch (err: unknown) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to save season settings."
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedSeason || !newTrackName.trim()) {
      setTrackError("Track title is required.");
      return;
    }
    setIsSavingTrack(true);
    setTrackError(null);
    try {
      let createdId = `trk-${Date.now()}`;
      let createdSlug = newTrackName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (onAddTrack) {
        const res = await onAddTrack({
          name: newTrackName.trim(),
          description: newTrackDesc.trim() || undefined,
          seasonId: inspectedSeason.id,
        });
        if (res && !res.ok) {
          setTrackError(res.error ?? "Failed to add committee track.");
          return;
        }
        if (res && res.trackId) createdId = res.trackId;
        if (res && res.slug) createdSlug = res.slug;
      }

      const added: SeasonTrackSummary = {
        id: createdId,
        name: newTrackName.trim(),
        slug: createdSlug,
        description: newTrackDesc.trim() || null,
        committeeCount: 0,
        directorNames: [],
      };
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === inspectedSeason.id
            ? { ...s, tracks: [...(s.tracks ?? []), added] }
            : s
        )
      );
      setNewTrackName("");
      setNewTrackDesc("");
    } catch (err: unknown) {
      setTrackError(
        err instanceof Error ? err.message : "Failed to add committee track."
      );
    } finally {
      setIsSavingTrack(false);
    }
  };

  const handleSaveTrackRename = async (trackId: string) => {
    if (!inspectedSeason || !editTrackName.trim()) {
      setTrackError("Track title is required.");
      return;
    }
    setIsSavingTrack(true);
    setTrackError(null);
    try {
      if (onRenameTrack) {
        const res = await onRenameTrack({
          trackId,
          name: editTrackName.trim(),
          description: editTrackDesc.trim(),
        });
        if (res && !res.ok) {
          setTrackError(res.error ?? "Failed to rename track.");
          return;
        }
      }
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === inspectedSeason.id
            ? {
                ...s,
                tracks: (s.tracks ?? []).map((t) =>
                  t.id === trackId
                    ? {
                        ...t,
                        name: editTrackName.trim(),
                        description: editTrackDesc.trim() || null,
                      }
                    : t
                ),
              }
            : s
        )
      );
      setEditingTrackId(null);
    } catch (err: unknown) {
      setTrackError(
        err instanceof Error ? err.message : "Failed to rename track."
      );
    } finally {
      setIsSavingTrack(false);
    }
  };

  const handleDeleteTrack = async (track: SeasonTrackSummary) => {
    if (!inspectedSeason) return;
    if (track.committeeCount > 0) {
      setTrackError(
        `Move or remove the ${track.committeeCount} committee(s) inside "${track.name}" first.`
      );
      return;
    }
    setIsSavingTrack(true);
    setTrackError(null);
    try {
      if (onDeleteTrack) {
        const res = await onDeleteTrack(track.id);
        if (res && !res.ok) {
          setTrackError(res.error ?? "Failed to remove track.");
          return;
        }
      }
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === inspectedSeason.id
            ? {
                ...s,
                tracks: (s.tracks ?? []).filter((t) => t.id !== track.id),
              }
            : s
        )
      );
    } catch (err: unknown) {
      setTrackError(
        err instanceof Error ? err.message : "Failed to remove track."
      );
    } finally {
      setIsSavingTrack(false);
    }
  };

  const perfectScorePreview = calculateRubricPoints({
    effortScore: 5,
    qualityScore: 5,
    timelinessScore: 5,
    maxPoints: draftSettings.grading.defaultMaxPoints,
    grading: draftSettings.grading,
  });

  const inspectedIsArchived = inspectedSeason?.status === "archived";
  const settingsReadOnly = !canEditSettings || inspectedIsArchived;
  const tracksReadOnly = !canEditTracks || inspectedIsArchived;

  return (
    <div className="space-y-8">
      {!canManage && canEditSettings && (
        <div className="rounded-lg border border-[#00629b]/25 bg-[#ebf3f8] p-3 text-xs text-[#002855]">
          <strong>HR Head Settings Access:</strong> You can configure Attendance,
          Tasks, Assignments, Feedback Bonus/Deduction Caps, and Leaderboard
          rules for active and draft seasons. Creating or archiving seasons is
          managed by Master Admin.
        </div>
      )}
      {!canManage && !canEditSettings && (
        <div className="rounded-lg border border-[#ffc627]/40 bg-[#fffbeb] p-3 text-xs text-[#92400e]">
          <strong>Master Authority Required:</strong> Only the Master
          Administrator has authority to create, clone, or transition seasons.
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

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Seasons &amp; Grading Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage chapter terms, scoring settings, and season rollovers.
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
              className="h-10 gap-2 border-border px-4 text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>New Season</span>
            </Button>
            {activeSeason && (
              <Button
                type="button"
                onClick={() => handleOpenClone(activeSeason)}
                className="h-10 gap-2 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Clone Season</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Season Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {seasons.map((season) => {
          const isActive = season.status === "active";
          const isArchived = season.status === "archived";
          const isDraft = season.status === "draft";
          const isSelected = settingsModalOpen && inspectedSeason?.id === season.id;

          return (
            <Card
              key={season.id}
              data-season-card={season.id}
              className={`border bg-white shadow-xs transition-all ${
                isSelected
                  ? "border-[#772583] ring-2 ring-[#772583]/15"
                  : isActive
                    ? "border-[#772583]/60"
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
              <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-0">
                <div className="grid grid-cols-3 gap-2 border-y border-border/70 py-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Tracks</span>
                    <p className="font-heading font-bold text-[#002855] tabular-nums">
                      {season.tracks?.length ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Committees</span>
                    <p className="font-heading font-bold text-[#002855] tabular-nums">
                      {season.committeeCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Members</span>
                    <p className="font-heading font-bold text-[#002855] tabular-nums">
                      {season.memberCount}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectSeasonForSettings(season)}
                      className={
                        isSelected
                          ? "h-8 gap-1 bg-[#002855] text-xs font-semibold text-white hover:bg-[#001c3d]"
                          : "h-8 gap-1 border-border text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
                      }
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Settings</span>
                    </Button>

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

                    {canManage && isArchived && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={transitioningId === season.id}
                        onClick={() => handleActivate(season)}
                        className="h-8 gap-1 border-[#772583]/35 text-xs font-semibold text-[#772583] hover:bg-[#f5edf7]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Re-activate</span>
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
                      {isArchived ? "Archived (read-only)" : "Draft season"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Season Settings Modal (matches Attendance Sheet modal shell) */}
      {settingsModalOpen && inspectedSeason && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Season Settings — ${inspectedSeason.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-6"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            {/* Sticky Modal Header */}
            <div className="border-b border-border bg-[#f8f9fb] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-extrabold text-[#002855]">
                      Season Settings — {inspectedSeason.name}
                    </h2>
                    <Badge
                      className={
                        inspectedSeason.status === "active"
                          ? "bg-[#772583] text-white"
                          : inspectedSeason.status === "archived"
                            ? "bg-muted text-muted-foreground"
                            : "bg-[#ebf3f8] text-[#002855]"
                      }
                    >
                      {inspectedSeason.status === "active"
                        ? "Active Season"
                        : inspectedSeason.status === "archived"
                          ? "Archived Season"
                          : "Draft Season"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every attendance rule, task default, assignment grading weight,
                    feedback cap, leaderboard tier, and committee track for{" "}
                    {inspectedSeason.name} lives here.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setSettingsTab("grading")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        settingsTab === "grading"
                          ? "bg-[#772583] text-white"
                          : "text-foreground/80 hover:bg-muted hover:text-[#002855]"
                      }`}
                    >
                      Scoring &amp; Rules
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab("tracks")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        settingsTab === "tracks"
                          ? "bg-[#772583] text-white"
                          : "text-foreground/80 hover:bg-muted hover:text-[#002855]"
                      }`}
                    >
                      Committee Tracks ({inspectedSeason.tracks?.length ?? 0})
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Close season settings"
                    onClick={() => setSettingsModalOpen(false)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {inspectedIsArchived && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#002855]" aria-hidden="true" />
                  <span>
                    <strong>Archived seasons are read-only.</strong> Re-activate
                    this season or clone it into a new draft to make changes.
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {settingsTab === "grading" && (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                {settingsError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
                  >
                    {settingsError}
                  </div>
                )}
                {settingsMessage && (
                  <div className="rounded-lg border border-[#78be20]/40 bg-[#78be20]/10 p-3 text-xs font-semibold text-[#1e6b0a]">
                    {settingsMessage}
                  </div>
                )}

                {/* 1. Attendance & Check-in Rules */}
                <section className="space-y-3 rounded-xl border border-border bg-[#f8f9fb]/60 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e3f5f6] text-[#007377]">
                      <QrCode className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-[#002855]">
                        Attendance &amp; Check-In Rules
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Applied automatically when creating sessions and scoring on-time vs. late arrivals in Attendance.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor="setting-base-points"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Base Attendance Points
                      </label>
                      <Input
                        id="setting-base-points"
                        type="number"
                        min={0}
                        max={500}
                        disabled={settingsReadOnly}
                        value={draftSettings.attendance.defaultBasePoints}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            attendance: {
                              ...prev.attendance,
                              defaultBasePoints: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-punctuality-bonus"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Punctuality Bonus
                      </label>
                      <Input
                        id="setting-punctuality-bonus"
                        type="number"
                        min={0}
                        max={200}
                        disabled={settingsReadOnly}
                        value={draftSettings.attendance.defaultPunctualityBonus}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            attendance: {
                              ...prev.attendance,
                              defaultPunctualityBonus: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-punctuality-cutoff"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        On-Time Cutoff (min)
                      </label>
                      <Input
                        id="setting-punctuality-cutoff"
                        type="number"
                        min={0}
                        max={180}
                        disabled={settingsReadOnly}
                        value={draftSettings.attendance.punctualityCutoffMinutes}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            attendance: {
                              ...prev.attendance,
                              punctualityCutoffMinutes: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-checkin-window"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Check-in Window (min)
                      </label>
                      <Input
                        id="setting-checkin-window"
                        type="number"
                        min={5}
                        max={360}
                        disabled={settingsReadOnly}
                        value={
                          draftSettings.attendance.defaultCheckinWindowMinutes
                        }
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            attendance: {
                              ...prev.attendance,
                              defaultCheckinWindowMinutes: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. HR Tasks (Check-off Work) */}
                <section className="space-y-3 rounded-xl border border-border bg-[#f8f9fb]/60 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                      <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-[#002855]">
                        Tasks (HR Check-Off Work)
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Defaults for HR check-off tasks. Tasks award their flat point value on completion (no 1–5 rubric).
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="setting-task-default-points"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Default Task Points
                      </label>
                      <Input
                        id="setting-task-default-points"
                        type="number"
                        min={1}
                        max={1000}
                        disabled={settingsReadOnly}
                        value={draftSettings.tasks.defaultTaskPoints}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tasks: {
                              ...prev.tasks,
                              defaultTaskPoints: parseNonNegativeInt(
                                e.target.value,
                                1
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 bg-white text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-task-completion-mode"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Default Completion Mode
                      </label>
                      <select
                        id="setting-task-completion-mode"
                        disabled={settingsReadOnly}
                        value={draftSettings.tasks.defaultCompletionMode}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tasks: {
                              ...prev.tasks,
                              defaultCompletionMode: e.target
                                .value as TaskCompletionMode,
                            },
                          }))
                        }
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-white px-3 text-xs font-semibold text-[#002855] focus-visible:outline-2 focus-visible:outline-[#772583] disabled:opacity-60"
                      >
                        <option value="self_report">
                          Self-Report (Member or HR can check off)
                        </option>
                        <option value="hr_only">
                          HR-Only (Only HR assigner can mark complete)
                        </option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* 3. Assignments (Rubric-Graded Deliverables) */}
                <section className="space-y-3 rounded-xl border border-border bg-[#f8f9fb]/60 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                      <Sliders className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-[#002855]">
                        Assignments (1–5 Rubric Grading Criteria)
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Controls how Effort, Quality, and Timeliness ratings translate into points when grading link-submitted assignments.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor="setting-effort-weight"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Effort Weight (per star)
                      </label>
                      <Input
                        id="setting-effort-weight"
                        type="number"
                        min={0}
                        max={100}
                        disabled={settingsReadOnly}
                        value={draftSettings.grading.effortWeight}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            grading: {
                              ...prev.grading,
                              effortWeight: parseNonNegativeInt(e.target.value),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-quality-weight"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Quality Weight (per star)
                      </label>
                      <Input
                        id="setting-quality-weight"
                        type="number"
                        min={0}
                        max={100}
                        disabled={settingsReadOnly}
                        value={draftSettings.grading.qualityWeight}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            grading: {
                              ...prev.grading,
                              qualityWeight: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-timeliness-weight"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Timeliness Weight (per star)
                      </label>
                      <Input
                        id="setting-timeliness-weight"
                        type="number"
                        min={0}
                        max={100}
                        disabled={settingsReadOnly}
                        value={draftSettings.grading.timelinessWeight}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            grading: {
                              ...prev.grading,
                              timelinessWeight: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-default-max"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Default Max Points
                      </label>
                      <Input
                        id="setting-default-max"
                        type="number"
                        min={1}
                        max={1000}
                        disabled={settingsReadOnly}
                        value={draftSettings.grading.defaultMaxPoints}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            grading: {
                              ...prev.grading,
                              defaultMaxPoints: parseNonNegativeInt(
                                e.target.value,
                                1
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#00629b]/20 bg-[#ebf3f8] px-3.5 py-2.5 text-xs text-[#002855]">
                    <strong>Live Formula:</strong>{" "}
                    <span className="font-mono">
                      min(maxPoints, Effort × {draftSettings.grading.effortWeight}{" "}
                      + Quality × {draftSettings.grading.qualityWeight} +
                      Timeliness × {draftSettings.grading.timelinessWeight})
                    </span>{" "}
                    · Perfect 5/5/5 score ={" "}
                    <strong className="tabular-nums">
                      {perfectScorePreview} pts
                    </strong>
                  </div>
                </section>

                {/* 4. Feedback Bonus & Deduction Caps */}
                <section className="space-y-3 rounded-xl border border-border bg-[#f8f9fb]/60 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5edf7] text-[#5a1b63]">
                      <Megaphone className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-[#002855]">
                        Feedback Bonus &amp; Deduction Caps
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Feedback entries always default to 0 pts. These caps limit optional bonus or deduction adjustments attached to a feedback note.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="setting-feedback-max-bonus"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Max Bonus per Feedback (pts)
                      </label>
                      <Input
                        id="setting-feedback-max-bonus"
                        type="number"
                        min={0}
                        max={500}
                        disabled={settingsReadOnly}
                        value={draftSettings.feedback.maxBonusPoints}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            feedback: {
                              ...prev.feedback,
                              maxBonusPoints: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 bg-white text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-feedback-max-deduction"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Max Deduction per Feedback (pts)
                      </label>
                      <Input
                        id="setting-feedback-max-deduction"
                        type="number"
                        min={0}
                        max={500}
                        disabled={settingsReadOnly}
                        value={draftSettings.feedback.maxDeductionPoints}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            feedback: {
                              ...prev.feedback,
                              maxDeductionPoints: parseNonNegativeInt(
                                e.target.value
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 bg-white text-xs font-semibold tabular-nums"
                      />
                    </div>
                  </div>
                </section>

                {/* 5. Leaderboard & Activity Tiers */}
                <section className="space-y-3 rounded-xl border border-border bg-[#f8f9fb]/60 p-4 sm:p-5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf5dd] text-[#1e6b0a]">
                      <Trophy className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-[#002855]">
                        Leaderboard &amp; Member Activity Tiers
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Thresholds must strictly increase (Bronze &lt; Silver &lt;
                        Gold &lt; Diamond).
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <label
                        htmlFor="setting-public-topn"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Public Top N
                      </label>
                      <Input
                        id="setting-public-topn"
                        type="number"
                        min={3}
                        max={50}
                        disabled={settingsReadOnly}
                        value={draftSettings.leaderboard.publicTopN}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            leaderboard: {
                              ...prev.leaderboard,
                              publicTopN: parseNonNegativeInt(
                                e.target.value,
                                3
                              ),
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-tier-bronze"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Bronze Tier (pts)
                      </label>
                      <Input
                        id="setting-tier-bronze"
                        type="number"
                        min={0}
                        disabled={settingsReadOnly}
                        value={draftSettings.leaderboard.tierThresholds.bronze}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            leaderboard: {
                              ...prev.leaderboard,
                              tierThresholds: {
                                ...prev.leaderboard.tierThresholds,
                                bronze: parseNonNegativeInt(e.target.value),
                              },
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-tier-silver"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Silver Tier (pts)
                      </label>
                      <Input
                        id="setting-tier-silver"
                        type="number"
                        min={1}
                        disabled={settingsReadOnly}
                        value={draftSettings.leaderboard.tierThresholds.silver}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            leaderboard: {
                              ...prev.leaderboard,
                              tierThresholds: {
                                ...prev.leaderboard.tierThresholds,
                                silver: parseNonNegativeInt(e.target.value),
                              },
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-tier-gold"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Gold Tier (pts)
                      </label>
                      <Input
                        id="setting-tier-gold"
                        type="number"
                        min={2}
                        disabled={settingsReadOnly}
                        value={draftSettings.leaderboard.tierThresholds.gold}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            leaderboard: {
                              ...prev.leaderboard,
                              tierThresholds: {
                                ...prev.leaderboard.tierThresholds,
                                gold: parseNonNegativeInt(e.target.value),
                              },
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="setting-tier-diamond"
                        className="block text-xs font-semibold text-foreground/85"
                      >
                        Diamond Tier (pts)
                      </label>
                      <Input
                        id="setting-tier-diamond"
                        type="number"
                        min={3}
                        disabled={settingsReadOnly}
                        value={draftSettings.leaderboard.tierThresholds.diamond}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            leaderboard: {
                              ...prev.leaderboard,
                              tierThresholds: {
                                ...prev.leaderboard.tierThresholds,
                                diamond: parseNonNegativeInt(e.target.value),
                              },
                            },
                          }))
                        }
                        className="mt-1 h-9 text-xs font-semibold tabular-nums"
                      />
                    </div>
                  </div>
                </section>

                {!settingsReadOnly && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDraftSettings(
                          normalizeSeasonSettings(DEFAULT_SEASON_SETTINGS)
                        );
                        setSettingsError(null);
                        setSettingsMessage(null);
                      }}
                      className="h-9 gap-1.5 text-xs font-semibold text-[#002855]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset to Defaults</span>
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingSettings}
                      className="h-9 bg-[#772583] px-5 text-xs font-semibold text-white hover:bg-[#5a1b63]"
                    >
                      {isSavingSettings
                        ? "Saving Settings..."
                        : "Save Season Settings"}
                    </Button>
                  </div>
                )}
              </form>
            )}

            {settingsTab === "tracks" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-[#f8f9fb] p-3 text-xs text-muted-foreground">
                  <strong className="text-[#002855]">
                    How Committee Tracks & Directors Work:
                  </strong>{" "}
                  Every committee belongs to a track (defaulting to Technical,
                  Creative, and Operations). Rename any track or add future sets
                  below. Assigning a Director to a track in Roster automatically
                  grants them access to all committees inside that track.
                </div>

                {trackError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
                  >
                    {trackError}
                  </div>
                )}

                <div className="space-y-2.5">
                  {(inspectedSeason.tracks ?? []).map((track) => {
                    const isEditing = editingTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        className="rounded-lg border border-border bg-white p-3.5"
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              aria-label={`Edit title for ${track.name}`}
                              value={editTrackName}
                              onChange={(e) => setEditTrackName(e.target.value)}
                              className="h-9 text-xs font-semibold sm:w-52"
                            />
                            <Input
                              aria-label={`Edit description for ${track.name}`}
                              value={editTrackDesc}
                              onChange={(e) => setEditTrackDesc(e.target.value)}
                              placeholder="Short description..."
                              className="h-9 flex-1 text-xs"
                            />
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isSavingTrack}
                                onClick={() => handleSaveTrackRename(track.id)}
                                className="h-9 gap-1 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Save Track</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingTrackId(null)}
                                className="h-9 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-heading text-sm font-bold text-[#002855]">
                                  {track.name}
                                </span>
                                <Badge className="bg-[#ebf3f8] text-[#002855] text-[11px] font-semibold">
                                  {track.committeeCount}{" "}
                                  {track.committeeCount === 1
                                    ? "committee"
                                    : "committees"}
                                </Badge>
                                {track.directorNames.length > 0 ? (
                                  track.directorNames.map((dir, dirIdx) => (
                                    <Badge
                                      key={`${track.id}-${dir}-${dirIdx}`}
                                      className="bg-[#f5edf7] text-[#5a1b63] text-[11px] font-semibold"
                                    >
                                      <span>Director:</span>
                                      <strong className="font-bold">{dir}</strong>
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    No track director assigned
                                  </span>
                                )}
                              </div>
                              {track.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {track.description}
                                </p>
                              )}
                            </div>

                            {!tracksReadOnly && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Edit track ${track.name}`}
                                  onClick={() => {
                                    setEditingTrackId(track.id);
                                    setEditTrackName(track.name);
                                    setEditTrackDesc(track.description ?? "");
                                    setTrackError(null);
                                  }}
                                  className="h-8 gap-1 text-xs font-semibold text-[#002855]"
                                >
                                  <Pencil
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Rename</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={
                                    isSavingTrack || track.committeeCount > 0
                                  }
                                  aria-label={`Delete track ${track.name}`}
                                  title={
                                    track.committeeCount > 0
                                      ? "Reassign committees before deleting this track"
                                      : `Delete ${track.name}`
                                  }
                                  onClick={() => handleDeleteTrack(track)}
                                  className="h-8 w-8 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f] disabled:opacity-40"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!tracksReadOnly && (
                  <form
                    onSubmit={handleAddTrackSubmit}
                    className="rounded-lg border border-dashed border-border bg-[#f8f9fb] p-4"
                  >
                    <p className="font-heading text-xs font-bold text-[#002855]">
                      Create a Future Committee Track / Set
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                      <Input
                        aria-label="New track title"
                        placeholder="e.g. Research & Innovation"
                        value={newTrackName}
                        onChange={(e) => setNewTrackName(e.target.value)}
                        className="h-9 bg-white text-xs sm:w-56"
                      />
                      <Input
                        aria-label="New track description"
                        placeholder="Short description (optional)"
                        value={newTrackDesc}
                        onChange={(e) => setNewTrackDesc(e.target.value)}
                        className="h-9 flex-1 bg-white text-xs"
                      />
                      <Button
                        type="submit"
                        disabled={isSavingTrack}
                        className="h-9 gap-1.5 bg-[#002855] px-4 text-xs font-semibold text-white hover:bg-[#001c3d]"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add Track</span>
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

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
              Starts in draft mode with default grading rules and Technical,
              Creative, and Operations tracks ready to customize.
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
      {cloneModalOpen && cloneTargetSeason && (
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
                  Clone Season: {cloneTargetSeason.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Zero-code rollover for the upcoming academic year.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-foreground/80">
              This creates a new draft season and copies{" "}
              <strong>
                grading settings, committee tracks, committees and scoring
                rubrics
              </strong>{" "}
              from <strong>{cloneTargetSeason.name}</strong>. Attendance and
              score records are never copied so historical records remain
              untouched.
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
                <span>
                  Also carry over active roster memberships & director tracks
                </span>
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
