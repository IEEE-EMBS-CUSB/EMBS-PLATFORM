"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Trash2,
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
import type { MembershipRole } from "@/lib/auth-helpers";
import { canManageCommittees, canManageRubrics } from "@/lib/permissions";
import {
  DEFAULT_COMMITTEE_TRACKS,
  inferDefaultTrackSlug,
} from "@/lib/season-settings";

export interface CommitteeTrackItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  directorNames?: string[];
}

export interface CommitteeViewItem {
  id: string;
  name: string;
  slug: string;
  category: "technical" | "non_technical";
  trackId?: string | null;
  isActive: boolean;
  memberCount: number;
}

export interface RubricViewItem {
  id: string;
  name: string;
  maxPoints: number;
  weight: string;
  leadersOnly: boolean;
}

interface CommitteesRubricsViewProps {
  tracks?: CommitteeTrackItem[];
  committees: CommitteeViewItem[];
  rubrics: RubricViewItem[];
  currentUserRole?: MembershipRole;
  scopedTrackName?: string | null;
  onAddTrack?: (data: {
    name: string;
    description?: string;
  }) => Promise<{ ok: boolean; trackId?: string; slug?: string; error?: string } | void>;
  onRenameTrack?: (data: {
    trackId: string;
    name: string;
    description?: string;
  }) => Promise<{ ok: boolean; error?: string } | void>;
  onDeleteTrack?: (
    trackId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAssignCommitteeTrack?: (
    committeeId: string,
    trackId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAddCommittee?: (data: {
    name: string;
    trackId?: string | null;
    category: "technical" | "non_technical";
    slug?: string;
  }) => Promise<
    { ok: boolean; committeeId?: string; slug?: string; error?: string } | void
  >;
  onRemoveCommittee?: (
    committeeId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAddRubric?: (data: {
    name: string;
    maxPoints: number;
    weight?: string;
    leadersOnly?: boolean;
  }) => Promise<{ ok: boolean; rubricId?: string; error?: string } | void>;
  onRemoveRubric?: (
    rubricId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
}

const TRACK_ACCENTS = [
  { heading: "text-[#007377]", badge: "bg-[#ebf3f8] text-[#002855]" },
  { heading: "text-[#772583]", badge: "bg-[#f5edf7] text-[#5a1b63]" },
  { heading: "text-[#00629b]", badge: "bg-[#e6f2f8] text-[#004b78]" },
  { heading: "text-[#002855]", badge: "bg-[#eef1f6] text-[#002855]" },
];

function buildFallbackTracks(): CommitteeTrackItem[] {
  return DEFAULT_COMMITTEE_TRACKS.map((t) => ({
    id: t.slug,
    name: t.name,
    slug: t.slug,
    description: t.description,
    directorNames: [],
  }));
}

export function CommitteesRubricsView({
  tracks: initialTracks,
  committees: initialCommittees,
  rubrics: initialRubrics,
  currentUserRole = "master_admin",
  scopedTrackName = null,
  onAddTrack,
  onRenameTrack,
  onDeleteTrack,
  onAssignCommitteeTrack,
  onAddCommittee,
  onRemoveCommittee,
  onAddRubric,
  onRemoveRubric,
}: CommitteesRubricsViewProps) {
  const [tracks, setTracks] = useState<CommitteeTrackItem[]>(() =>
    initialTracks && initialTracks.length > 0
      ? initialTracks
      : buildFallbackTracks()
  );
  const [committees, setCommittees] = useState<CommitteeViewItem[]>(() => {
    const baseTracks =
      initialTracks && initialTracks.length > 0
        ? initialTracks
        : buildFallbackTracks();
    const bySlug = new Map(baseTracks.map((t) => [t.slug, t.id]));
    const fallbackTrackId = baseTracks[0]?.id ?? null;
    return initialCommittees.map((c) => ({
      ...c,
      trackId:
        c.trackId ?? bySlug.get(inferDefaultTrackSlug(c)) ?? fallbackTrackId,
    }));
  });
  const [rubrics, setRubrics] = useState(initialRubrics);
  const [activeTab, setActiveTab] = useState<"committees" | "rubrics">(
    "committees"
  );
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Track Modal state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackDesc, setNewTrackDesc] = useState("");
  const [trackModalError, setTrackModalError] = useState("");
  const [isAddingTrack, setIsAddingTrack] = useState(false);

  // Inline Rename Track state
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTrackTitle, setEditTrackTitle] = useState("");
  const [editTrackDesc, setEditTrackDesc] = useState("");
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);

  // Add Committee Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [commName, setCommName] = useState("");
  const [commTrackId, setCommTrackId] = useState<string>(
    () => tracks[0]?.id ?? ""
  );
  const [commSlug, setCommSlug] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [movingCommId, setMovingCommId] = useState<string | null>(null);

  // Add Rubric Modal state
  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [rubricName, setRubricName] = useState("");
  const [rubricMax, setRubricMax] = useState(20);
  const [rubricWeight, setRubricWeight] = useState("1.0");
  const [rubricLeadersOnly, setRubricLeadersOnly] = useState(false);
  const [rubricError, setRubricError] = useState("");
  const [isAddingRubric, setIsAddingRubric] = useState(false);
  const [removingRubricId, setRemovingRubricId] = useState<string | null>(null);

  const isMaster = canManageCommittees(currentUserRole);
  const canEditRubrics = canManageRubrics(currentUserRole);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddModalOpen(false);
        setRubricModalOpen(false);
        setTrackModalOpen(false);
        setEditingTrackId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const committeesByTrack = useMemo(() => {
    const map = new Map<string, CommitteeViewItem[]>();
    for (const t of tracks) {
      map.set(t.id, []);
    }
    const fallbackId = tracks[0]?.id;
    for (const c of committees) {
      const targetId =
        c.trackId && map.has(c.trackId) ? c.trackId : fallbackId;
      if (targetId) {
        map.get(targetId)!.push(c);
      }
    }
    return map;
  }, [tracks, committees]);

  const handleAddTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackTitle.trim()) {
      setTrackModalError("Track title is required.");
      return;
    }
    setIsAddingTrack(true);
    setTrackModalError("");
    try {
      let createdId = `trk-${Date.now()}`;
      let createdSlug = newTrackTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (onAddTrack) {
        const res = await onAddTrack({
          name: newTrackTitle.trim(),
          description: newTrackDesc.trim() || undefined,
        });
        if (res && !res.ok) {
          setTrackModalError(res.error ?? "Failed to create committee track.");
          return;
        }
        if (res && res.trackId) createdId = res.trackId;
        if (res && res.slug) createdSlug = res.slug;
      }

      setTracks((prev) => [
        ...prev,
        {
          id: createdId,
          name: newTrackTitle.trim(),
          slug: createdSlug,
          description: newTrackDesc.trim() || null,
          directorNames: [],
        },
      ]);
      setTrackModalOpen(false);
      setNewTrackTitle("");
      setNewTrackDesc("");
    } catch (err: unknown) {
      setTrackModalError(
        err instanceof Error ? err.message : "Error creating committee track."
      );
    } finally {
      setIsAddingTrack(false);
    }
  };

  const handleSaveRenameTrack = async (trackId: string) => {
    if (!editTrackTitle.trim()) {
      setActionError("Track title cannot be empty.");
      return;
    }
    setSavingTrackId(trackId);
    setActionError(null);
    try {
      if (onRenameTrack) {
        const res = await onRenameTrack({
          trackId,
          name: editTrackTitle.trim(),
          description: editTrackDesc.trim(),
        });
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to rename track.");
          return;
        }
      }
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                name: editTrackTitle.trim(),
                description: editTrackDesc.trim() || null,
              }
            : t
        )
      );
      setEditingTrackId(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to rename track."
      );
    } finally {
      setSavingTrackId(null);
    }
  };

  const handleDeleteTrack = async (track: CommitteeTrackItem) => {
    const count = committeesByTrack.get(track.id)?.length ?? 0;
    if (count > 0) {
      setActionError(
        `Move or remove the ${count} committee(s) in "${track.name}" before deleting this track.`
      );
      return;
    }
    if (!window.confirm(`Delete the "${track.name}" committee track?`)) {
      return;
    }
    setSavingTrackId(track.id);
    setActionError(null);
    try {
      if (onDeleteTrack) {
        const res = await onDeleteTrack(track.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to delete track.");
          return;
        }
      }
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete track."
      );
    } finally {
      setSavingTrackId(null);
    }
  };

  const handleMoveCommitteeTrack = async (
    comm: CommitteeViewItem,
    newTrackId: string
  ) => {
    if (!newTrackId || newTrackId === comm.trackId) return;
    const previousTrackId = comm.trackId;
    const targetTrack = tracks.find((t) => t.id === newTrackId);
    setMovingCommId(comm.id);
    setActionError(null);
    setCommittees((prev) =>
      prev.map((c) =>
        c.id === comm.id
          ? {
              ...c,
              trackId: newTrackId,
              category:
                targetTrack?.slug === "technical"
                  ? "technical"
                  : "non_technical",
            }
          : c
      )
    );
    try {
      if (onAssignCommitteeTrack) {
        const res = await onAssignCommitteeTrack(comm.id, newTrackId);
        if (res && !res.ok) {
          setCommittees((prev) =>
            prev.map((c) =>
              c.id === comm.id ? { ...c, trackId: previousTrackId } : c
            )
          );
          setActionError(res.error ?? "Failed to reassign committee track.");
        }
      }
    } catch (err: unknown) {
      setCommittees((prev) =>
        prev.map((c) =>
          c.id === comm.id ? { ...c, trackId: previousTrackId } : c
        )
      );
      setActionError(
        err instanceof Error ? err.message : "Failed to reassign track."
      );
    } finally {
      setMovingCommId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commName.trim()) {
      setAddError("Committee name is required.");
      return;
    }
    setIsAdding(true);
    setAddError("");
    try {
      const slug =
        commSlug.trim().toLowerCase() ||
        commName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const selectedTrack =
        tracks.find((t) => t.id === commTrackId) ?? tracks[0];
      const derivedCategory: "technical" | "non_technical" =
        selectedTrack?.slug === "technical" ? "technical" : "non_technical";

      let createdId = `comm-${Date.now()}`;
      let createdSlug = slug;

      if (onAddCommittee) {
        const res = await onAddCommittee({
          name: commName.trim(),
          trackId: selectedTrack?.id ?? null,
          category: derivedCategory,
          slug,
        });
        if (res && !res.ok) {
          setAddError(res.error ?? "Failed to add committee.");
          return;
        }
        if (res && res.committeeId) createdId = res.committeeId;
        if (res && res.slug) createdSlug = res.slug;
      }

      const newComm: CommitteeViewItem = {
        id: createdId,
        name: commName.trim(),
        slug: createdSlug,
        category: derivedCategory,
        trackId: selectedTrack?.id ?? null,
        isActive: true,
        memberCount: 0,
      };

      setCommittees((prev) => [...prev, newComm]);
      setAddModalOpen(false);
      setCommName("");
      setCommSlug("");
      setCommTrackId(tracks[0]?.id ?? "");
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : "Error adding committee."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (comm: CommitteeViewItem) => {
    if (
      !window.confirm(
        `Are you sure you want to remove the "${comm.name}" committee?`
      )
    ) {
      return;
    }
    setRemovingId(comm.id);
    setActionError(null);
    try {
      if (onRemoveCommittee) {
        const res = await onRemoveCommittee(comm.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to remove committee.");
          return;
        }
      }
      setCommittees((prev) => prev.filter((c) => c.id !== comm.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove committee."
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddRubricSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubricName.trim()) {
      setRubricError("Rubric name is required.");
      return;
    }
    if (!Number.isInteger(rubricMax) || rubricMax <= 0) {
      setRubricError("Max points must be a positive whole number.");
      return;
    }
    setIsAddingRubric(true);
    setRubricError("");
    try {
      let createdId = `rub-${Date.now()}`;
      if (onAddRubric) {
        const res = await onAddRubric({
          name: rubricName.trim(),
          maxPoints: rubricMax,
          weight: rubricWeight,
          leadersOnly: rubricLeadersOnly,
        });
        if (res && !res.ok) {
          setRubricError(res.error ?? "Failed to add rubric.");
          return;
        }
        if (res && res.rubricId) createdId = res.rubricId;
      }

      setRubrics((prev) => [
        ...prev,
        {
          id: createdId,
          name: rubricName.trim(),
          maxPoints: rubricMax,
          weight: rubricWeight,
          leadersOnly: rubricLeadersOnly,
        },
      ]);
      setRubricModalOpen(false);
      setRubricName("");
      setRubricMax(20);
      setRubricWeight("1.0");
      setRubricLeadersOnly(false);
    } catch (err: unknown) {
      setRubricError(
        err instanceof Error ? err.message : "Error creating scoring rubric."
      );
    } finally {
      setIsAddingRubric(false);
    }
  };

  const handleRemoveRubric = async (rubric: RubricViewItem) => {
    setRemovingRubricId(rubric.id);
    setActionError(null);
    try {
      if (onRemoveRubric) {
        const res = await onRemoveRubric(rubric.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to remove rubric.");
          return;
        }
      }
      setRubrics((prev) => prev.filter((x) => x.id !== rubric.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove rubric."
      );
    } finally {
      setRemovingRubricId(null);
    }
  };

  return (
    <div className="space-y-8">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {actionError}
        </div>
      )}

      {scopedTrackName && (
        <div className="rounded-lg border border-[#772583]/25 bg-[#f5edf7] p-3 text-xs text-[#5a1b63]">
          <strong>Director Track Scope:</strong> Showing committees in your
          assigned <strong>{scopedTrackName}</strong> track.
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Committees, Tracks & Rubrics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize committees into editable tracks (Technical, Creative,
            Operations, or custom sets). Directors assigned to a track
            automatically oversee all committees inside it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMaster && activeTab === "committees" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTrackModalError("");
                  setTrackModalOpen(true);
                }}
                className="h-9 gap-1.5 border-border px-3.5 text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>New Track</span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setAddError("");
                  setCommTrackId(tracks[0]?.id ?? "");
                  setAddModalOpen(true);
                }}
                className="h-9 gap-1.5 bg-[#002855] px-3.5 text-xs font-semibold text-white hover:bg-[#001c3d]"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                <span>Add Committee</span>
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab("committees")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "committees"
                  ? "bg-[#772583] text-white"
                  : "text-foreground/80 hover:bg-[#f5edf7] hover:text-[#772583]"
              }`}
            >
              Committees ({committees.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rubrics")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "rubrics"
                  ? "bg-[#772583] text-white"
                  : "text-foreground/80 hover:bg-[#f5edf7] hover:text-[#772583]"
              }`}
            >
              Scoring Rubrics ({rubrics.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "rubrics" && canEditRubrics ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setRubricError("");
              setRubricModalOpen(true);
            }}
            className="h-9 gap-1.5 bg-[#772583] px-3.5 text-xs font-semibold text-white hover:bg-[#5a1b63]"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            <span>Add Rubric</span>
          </Button>
        </div>
      ) : null}

      {activeTab === "committees" ? (
        <div className="space-y-8">
          {tracks.map((track, idx) => {
            const trackComms = committeesByTrack.get(track.id) ?? [];
            const accent = TRACK_ACCENTS[idx % TRACK_ACCENTS.length];
            const isEditing = editingTrackId === track.id;

            return (
              <section key={track.id} className="space-y-3">
                <div className="flex flex-col gap-2 border-b border-border/70 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        aria-label={`Track title for ${track.name}`}
                        value={editTrackTitle}
                        onChange={(e) => setEditTrackTitle(e.target.value)}
                        className="h-8 text-xs font-semibold sm:w-52"
                      />
                      <Input
                        aria-label={`Track description for ${track.name}`}
                        value={editTrackDesc}
                        onChange={(e) => setEditTrackDesc(e.target.value)}
                        placeholder="Short description..."
                        className="h-8 flex-1 text-xs"
                      />
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingTrackId === track.id}
                          onClick={() => handleSaveRenameTrack(track.id)}
                          className="h-8 gap-1 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Save Track Title</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTrackId(null)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className={`font-heading text-sm font-bold tracking-wide uppercase ${accent.heading}`}
                          >
                            {track.name} ({trackComms.length})
                          </h2>
                          {track.directorNames &&
                          track.directorNames.length > 0 ? (
                            track.directorNames.map((dir) => (
                              <Badge
                                key={dir}
                                className="bg-[#f5edf7] text-[#5a1b63] text-[11px] font-semibold"
                              >
                                Director: {dir}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              No director assigned
                            </span>
                          )}
                        </div>
                        {track.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {track.description}
                          </p>
                        )}
                      </div>

                      {isMaster && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Rename track ${track.name}`}
                            onClick={() => {
                              setEditingTrackId(track.id);
                              setEditTrackTitle(track.name);
                              setEditTrackDesc(track.description ?? "");
                              setActionError(null);
                            }}
                            className="h-7 gap-1 px-2.5 text-[11px] font-semibold text-[#002855]"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Rename</span>
                          </Button>
                          {trackComms.length === 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete track ${track.name}`}
                              disabled={savingTrackId === track.id}
                              onClick={() => handleDeleteTrack(track)}
                              className="h-7 w-7 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {trackComms.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-[#f8f9fb] px-4 py-5 text-xs text-muted-foreground">
                    No committees in <strong>{track.name}</strong> yet. Add a
                    committee or move an existing one here.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {trackComms.map((comm) => (
                      <Card
                        key={comm.id}
                        className="border-border bg-white shadow-xs"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              className={`${accent.badge} font-semibold text-[11px]`}
                            >
                              {track.name}
                            </Badge>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#1e6b0a]">
                                Active
                              </span>
                              {isMaster && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemove(comm)}
                                  disabled={removingId === comm.id}
                                  aria-label={`Remove committee ${comm.name}`}
                                  className="h-6 w-6 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </Button>
                              )}
                            </div>
                          </div>
                          <CardTitle className="mt-2 font-heading text-base font-bold text-[#002855]">
                            {comm.name}
                          </CardTitle>
                          <code className="text-[11px] text-muted-foreground">
                            /{comm.slug}
                          </code>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                          <span>
                            <strong className="text-foreground tabular-nums">
                              {comm.memberCount}
                            </strong>{" "}
                            members enrolled
                          </span>
                          {isMaster && tracks.length > 1 && (
                            <select
                              aria-label={`Assign track for ${comm.name}`}
                              value={comm.trackId ?? track.id}
                              disabled={movingCommId === comm.id}
                              onChange={(e) =>
                                handleMoveCommitteeTrack(comm, e.target.value)
                              }
                              className="h-7 max-w-[140px] rounded border border-border bg-white px-2 text-[11px] font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                            >
                              {tracks.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="border-border bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-bold text-[#002855]">
              Active Seasonal Evaluation Rubrics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Rubrics configure seasonal grading parameters. Point weights and
              maximums are derived deterministically.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#f8f9fb]">
                <TableRow>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Rubric Category
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Max Points
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Weight
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Scope
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-[#002855]">
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {canEditRubrics && onRemoveRubric && (
                          <button
                            type="button"
                            disabled={removingRubricId === r.id}
                            aria-label={`Remove rubric ${r.name}`}
                            onClick={() => handleRemoveRubric(r)}
                            className="rounded p-1 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                          >
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums font-heading font-bold">
                      {r.maxPoints} pts
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      x{r.weight}
                    </TableCell>
                    <TableCell>
                      {r.leadersOnly ? (
                        <Badge className="bg-[#ffc627]/30 text-[#002855] text-[11px] font-semibold">
                          Leaders only
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          All members
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rubrics.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No scoring rubrics configured for this season yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Committee Track Modal */}
      {trackModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create Committee Track"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTrackModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close new track modal"
              onClick={() => setTrackModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 text-[#772583]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5edf7]">
                <Layers className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  New Committee Track
                </h2>
                <p className="text-xs text-muted-foreground">
                  Create a new committee set that Directors can oversee.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddTrackSubmit} className="mt-5 space-y-4">
              {trackModalError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {trackModalError}
                </div>
              )}

              <div>
                <label
                  htmlFor="new-track-title"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Track Title
                </label>
                <Input
                  id="new-track-title"
                  type="text"
                  required
                  placeholder="e.g. Biomedical Outreach"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="new-track-desc"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Description (Optional)
                </label>
                <Input
                  id="new-track-desc"
                  type="text"
                  placeholder="e.g. Community engagement, workshops, and partnerships"
                  value={newTrackDesc}
                  onChange={(e) => setNewTrackDesc(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTrackModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingTrack}
                  className="h-9 gap-1.5 bg-[#772583] px-4 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isAddingTrack ? "Creating..." : "Create Track"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Committee Modal */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add New Committee"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add committee modal"
              onClick={() => setAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 text-[#002855]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ebf3f8]">
                <FolderPlus
                  className="h-5 w-5 text-[#002855]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Add New Committee
                </h2>
                <p className="text-xs text-muted-foreground">
                  Create a chapter committee inside one of this season&apos;s
                  tracks.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              {addError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {addError}
                </div>
              )}

              <div>
                <label
                  htmlFor="comm-name-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Committee Name
                </label>
                <Input
                  id="comm-name-input"
                  type="text"
                  required
                  placeholder="e.g. Neuroscience & Brain-Computer Interfaces"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="comm-track-select"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Committee Track
                </label>
                <select
                  id="comm-track-select"
                  value={commTrackId}
                  onChange={(e) => setCommTrackId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                >
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="comm-slug-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Custom Slug (Optional)
                </label>
                <Input
                  id="comm-slug-input"
                  type="text"
                  placeholder="e.g. bci-neuroscience (leave blank to auto-generate)"
                  value={commSlug}
                  onChange={(e) => setCommSlug(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="h-9 bg-[#002855] px-4 text-xs font-bold text-white hover:bg-[#001c3d]"
                >
                  {isAdding ? "Creating..." : "Create Committee"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Scoring Rubric Modal */}
      {rubricModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Scoring Rubric"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRubricModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add rubric modal"
              onClick={() => setRubricModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Add Scoring Rubric
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Define a weighted evaluation category for the active season.
            </p>

            <form onSubmit={handleAddRubricSubmit} className="mt-5 space-y-4">
              {rubricError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {rubricError}
                </div>
              )}

              <div>
                <label
                  htmlFor="rubric-name-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Rubric Name
                </label>
                <Input
                  id="rubric-name-input"
                  type="text"
                  required
                  placeholder="e.g. Technical Delivery Quality"
                  value={rubricName}
                  onChange={(e) => setRubricName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rubric-max-input"
                    className="block text-xs font-semibold text-foreground/85"
                  >
                    Max Points
                  </label>
                  <Input
                    id="rubric-max-input"
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={rubricMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setRubricMax(Number.isNaN(v) ? 0 : v);
                    }}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rubric-weight-input"
                    className="block text-xs font-semibold text-foreground/85"
                  >
                    Weight Multiplier
                  </label>
                  <Input
                    id="rubric-weight-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    required
                    value={rubricWeight}
                    onChange={(e) => setRubricWeight(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={rubricLeadersOnly}
                  onChange={(e) => setRubricLeadersOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span>Leaders only (Committee Heads & Officers)</span>
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRubricModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingRubric}
                  className="h-9 bg-[#772583] px-4 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  {isAddingRubric ? "Creating..." : "Create Rubric"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
