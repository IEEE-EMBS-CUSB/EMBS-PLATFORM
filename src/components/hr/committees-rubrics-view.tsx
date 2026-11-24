"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  FolderPlus,
  Layers,
  Pencil,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAccessHrModule, canManageCommittees } from "@/lib/permissions";
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
  rubrics?: RubricViewItem[];
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
  { heading: "text-[#007377]", border: "border-t-[#007377]" },
  { heading: "text-[#772583]", border: "border-t-[#772583]" },
  { heading: "text-[#00629b]", border: "border-t-[#00629b]" },
  { heading: "text-[#002855]", border: "border-t-[#002855]" },
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
  currentUserRole = "master_admin",
  scopedTrackName = null,
  onAddTrack,
  onRenameTrack,
  onDeleteTrack,
  onAssignCommitteeTrack,
  onAddCommittee,
  onRemoveCommittee,
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

  const isMaster = canManageCommittees(currentUserRole);
  const canOpenSeasonSettings = canAccessHrModule(currentUserRole, "seasons");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddModalOpen(false);
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
    const previousCategory = comm.category;
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
              c.id === comm.id
                ? {
                    ...c,
                    trackId: previousTrackId,
                    category: previousCategory,
                  }
                : c
            )
          );
          setActionError(res.error ?? "Failed to reassign committee track.");
        }
      }
    } catch (err: unknown) {
      setCommittees((prev) =>
        prev.map((c) =>
          c.id === comm.id
            ? {
                ...c,
                trackId: previousTrackId,
                category: previousCategory,
              }
            : c
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
            Committees &amp; Tracks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize committees into editable tracks. Directors assigned to a
            track automatically oversee all committees inside it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canOpenSeasonSettings && (
            <Link
              href="/hr/seasons"
              className={buttonVariants({
                variant: "outline",
                className:
                  "h-10 gap-1.5 border-border px-3.5 text-xs font-semibold text-[#002855] hover:bg-[#f5edf7] hover:text-[#772583]",
              })}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              <span>Scoring Settings</span>
            </Link>
          )}
          {isMaster && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTrackModalError("");
                  setTrackModalOpen(true);
                }}
                className="h-10 gap-1.5 border-border px-3.5 text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
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
                className="h-10 gap-1.5 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                <span>Add Committee</span>
              </Button>
            </>
          )}
        </div>
      </div>

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
                          track.directorNames.map((dir, dirIdx) => (
                            <Badge
                              key={`${track.id}-${dir}-${dirIdx}`}
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
                          className="h-8 gap-1 px-2.5 text-xs font-semibold text-[#002855]"
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
                            className="h-8 w-8 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
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
                  {trackComms.map((comm) => {
                    const isProtectedHr = comm.slug === "human-resources";
                    return (
                      <Card
                        key={comm.id}
                        className={`border-border border-t-2 ${accent.border} bg-white shadow-xs`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="font-heading text-base font-bold text-[#002855]">
                                {comm.name}
                              </CardTitle>
                              <code className="block truncate text-[11px] text-muted-foreground">
                                /{comm.slug}
                              </code>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {isProtectedHr ? (
                                <Badge className="bg-[#f5edf7] text-[#5a1b63] text-[10px] font-semibold">
                                  Core
                                </Badge>
                              ) : (
                                isMaster && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(comm)}
                                    disabled={removingId === comm.id}
                                    aria-label={`Remove committee ${comm.name}`}
                                    className="h-7 w-7 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                                  >
                                    <Trash2
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-[#f8f9fb]/60 py-2.5 text-xs text-muted-foreground">
                          <span>
                            <strong className="text-[#002855] tabular-nums">
                              {comm.memberCount}
                            </strong>{" "}
                            {comm.memberCount === 1 ? "member" : "members"}
                          </span>
                          {isMaster && tracks.length > 1 && (
                            <select
                              aria-label={`Assign track for ${comm.name}`}
                              value={comm.trackId ?? track.id}
                              disabled={movingCommId === comm.id}
                              onChange={(e) =>
                                handleMoveCommitteeTrack(comm, e.target.value)
                              }
                              className="h-7 min-w-0 max-w-[140px] rounded border border-border bg-white px-2 text-[11px] font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
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
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

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
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close track modal"
              onClick={() => setTrackModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Create Committee Track
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a new committee set for this season (e.g. Research, Outreach,
              or Hardware). Directors can be assigned to oversee it from Roster.
            </p>

            {trackModalError && (
              <div
                role="alert"
                className="mt-3 rounded bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {trackModalError}
              </div>
            )}

            <form onSubmit={handleAddTrackSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="new-track-title"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Track Title
                </label>
                <Input
                  id="new-track-title"
                  type="text"
                  required
                  placeholder="e.g. Research & Innovation"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="new-track-desc"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (Optional)
                  </span>
                </label>
                <Input
                  id="new-track-desc"
                  type="text"
                  placeholder="Committees grouped under this track"
                  value={newTrackDesc}
                  onChange={(e) => setNewTrackDesc(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTrackModalOpen(false)}
                  className="h-10 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingTrack || !newTrackTitle.trim()}
                  className="h-10 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  {isAddingTrack ? "Creating..." : "Create Track"}
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
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add committee modal"
              onClick={() => setAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Add New Committee
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a new committee inside any track for the active season.
            </p>

            {addError && (
              <div
                role="alert"
                className="mt-3 rounded bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="comm-name"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Committee Name
                </label>
                <Input
                  id="comm-name"
                  type="text"
                  required
                  placeholder="e.g. Brain-Computer Interfaces"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="comm-track"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Committee Track
                </label>
                <select
                  id="comm-track"
                  value={commTrackId}
                  onChange={(e) => setCommTrackId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
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
                  htmlFor="comm-slug"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  URL Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (Optional)
                  </span>
                </label>
                <Input
                  id="comm-slug"
                  type="text"
                  placeholder="auto-generated from name"
                  value={commSlug}
                  onChange={(e) => setCommSlug(e.target.value)}
                  className="mt-1 h-10 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="h-10 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding || !commName.trim()}
                  className="h-10 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  {isAdding ? "Adding..." : "Create Committee"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
