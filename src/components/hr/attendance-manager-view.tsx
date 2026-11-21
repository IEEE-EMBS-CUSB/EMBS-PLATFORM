"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, QrCode, Radio, StopCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import type { MembershipRole } from "@/lib/auth-helpers";
import { buildCheckinQrUrl } from "@/lib/checkin-url";
import {
  DEFAULT_SEASON_SETTINGS,
  type SeasonAttendanceSettings,
} from "@/lib/season-settings";
import {
  createSessionAction,
  toggleSessionCheckinAction,
  rotateSessionCheckinCodeAction,
  type CreateSessionInput,
} from "@/app/hr/attendance/actions";

export interface SessionItem {
  id: string;
  title: string;
  committeeId?: string | null;
  committeeName: string;
  startsAt: Date;
  checkinOpen: boolean;
  checkinCode: string | null;
  checkinExpiresAt?: Date | null;
  basePoints: number;
  punctualityBonus: number;
  attendanceCount: number;
}

export interface CommitteeRef {
  id: string;
  name: string;
}

interface AttendanceManagerViewProps {
  sessions: SessionItem[];
  currentUserRole?: MembershipRole;
  currentUserCommitteeId?: string | null;
  currentUserCommitteeName?: string | null;
  committees?: CommitteeRef[];
  attendanceDefaults?: SeasonAttendanceSettings;
  onCreateSession?: (input: CreateSessionInput) => Promise<unknown>;
  onToggleCheckin?: (
    sessionId: string,
    open: boolean,
    windowMinutes?: number
  ) => Promise<unknown>;
}

export function AttendanceManagerView({
  sessions,
  currentUserRole = "hr_admin",
  currentUserCommitteeId = null,
  currentUserCommitteeName = null,
  committees = [],
  attendanceDefaults = DEFAULT_SEASON_SETTINGS.attendance,
  onCreateSession,
  onToggleCheckin,
}: AttendanceManagerViewProps) {
  const [liveCheckinSession, setLiveCheckinSession] =
    useState<SessionItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newStartsAt, setNewStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [newCommitteeId, setNewCommitteeId] = useState<string>(
    currentUserCommitteeId ?? ""
  );
  const [newWindowMinutes, setNewWindowMinutes] = useState(
    attendanceDefaults.defaultCheckinWindowMinutes
  );
  const [newPunctualityCutoff, setNewPunctualityCutoff] = useState(
    attendanceDefaults.punctualityCutoffMinutes
  );
  const [newBasePoints, setNewBasePoints] = useState(
    attendanceDefaults.defaultBasePoints
  );
  const [newPunctualityBonus, setNewPunctualityBonus] = useState(
    attendanceDefaults.defaultPunctualityBonus
  );
  const [newOpenImmediately, setNewOpenImmediately] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateModal(false);
        setLiveCheckinSession(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (liveCheckinSession?.checkinCode) {
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";
      const qrPayload = origin
        ? buildCheckinQrUrl(origin, liveCheckinSession.checkinCode)
        : liveCheckinSession.checkinCode;
      QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 1,
      })
        .then((url) => {
          if (!cancelled) setQrDataUrl(url);
        })
        .catch(() => {
          if (!cancelled) setQrDataUrl(null);
        });
    } else {
      queueMicrotask(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [liveCheckinSession?.checkinCode]);

  useEffect(() => {
    if (!liveCheckinSession?.checkinOpen) return;
    const rotationMs = Math.max(15, attendanceDefaults.qrRotationSeconds) * 1000;
    const interval = setInterval(async () => {
      try {
        const res = await rotateSessionCheckinCodeAction(
          liveCheckinSession.id,
          attendanceDefaults.defaultCheckinWindowMinutes
        );
        if (res.ok && res.checkinCode) {
          setLiveCheckinSession((prev) =>
            prev
              ? {
                  ...prev,
                  checkinCode: res.checkinCode ?? prev.checkinCode,
                  checkinExpiresAt:
                    res.checkinExpiresAt ?? prev.checkinExpiresAt,
                }
              : prev
          );
        }
      } catch {
        // Keep current code visible if rotation request transiently fails
      }
    }, rotationMs);
    return () => clearInterval(interval);
  }, [
    liveCheckinSession?.id,
    liveCheckinSession?.checkinOpen,
    attendanceDefaults.qrRotationSeconds,
    attendanceDefaults.defaultCheckinWindowMinutes,
  ]);

  const isCommitteeScoped =
    currentUserRole === "committee_head" || currentUserRole === "hr_member";
  const canCreate =
    currentUserRole === "master_admin" ||
    currentUserRole === "hr_admin" ||
    currentUserRole === "hr_member" ||
    currentUserRole === "committee_head";

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const input: CreateSessionInput = {
      title: newTitle.trim(),
      startsAt: new Date(newStartsAt).toISOString(),
      committeeId: isCommitteeScoped
        ? currentUserCommitteeId
        : newCommitteeId || null,
      checkinWindowMinutes: newWindowMinutes,
      punctualityCutoffMinutes: newPunctualityCutoff,
      basePoints: newBasePoints,
      punctualityBonus: newPunctualityBonus,
      openCheckinImmediately: newOpenImmediately,
    };

    try {
      if (onCreateSession) {
        await onCreateSession(input);
      } else {
        const res = await createSessionAction(input);
        if (!res.ok) {
          setErrorMessage(res.error || "Failed to create session.");
          return;
        }
      }

      setShowCreateModal(false);
      setNewTitle("");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error creating session."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCheckin = async (
    sessionId: string,
    open: boolean,
    windowMinutes: number = 30
  ) => {
    setTogglingId(sessionId);
    setActionError(null);
    try {
      if (onToggleCheckin) {
        await onToggleCheckin(sessionId, open, windowMinutes);
      } else {
        const res = await toggleSessionCheckinAction(
          sessionId,
          open,
          windowMinutes
        );
        if (!res.ok) {
          setActionError(res.error ?? "Failed to update check-in status.");
          return;
        }
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update check-in status."
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
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
            Sessions & Live QR Attendance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project live QR codes for meetings, track punctuality bonuses, and log attendance.
          </p>
        </div>

        {canCreate && (
          <Button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setShowCreateModal(true);
            }}
            className="h-10 shrink-0 gap-2 bg-[#772583] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#5a1b63]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Session</span>
          </Button>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Session"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close create session modal"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="border-b border-border/70 pb-3">
              <h2 className="font-heading text-xl font-extrabold text-[#002855]">
                Create New Session
              </h2>
              <p className="text-xs text-muted-foreground">
                Set up a session with a designated live check-in window and points.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-3 rounded bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="session-title-input"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Session Title
                </label>
                <Input
                  id="session-title-input"
                  type="text"
                  required
                  placeholder="e.g. AI & ML Workshop: Neural Networks"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="session-starts-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Date & Time
                  </label>
                  <Input
                    id="session-starts-input"
                    type="datetime-local"
                    required
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="session-committee-select"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Committee
                  </label>
                  {isCommitteeScoped ? (
                    <Input
                      id="session-committee-select"
                      disabled
                      value={currentUserCommitteeName ?? "My Committee"}
                      className="mt-1 h-10 bg-muted text-xs font-semibold text-[#002855]"
                    />
                  ) : (
                    <select
                      id="session-committee-select"
                      value={newCommitteeId}
                      onChange={(e) => setNewCommitteeId(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                    >
                      <option value="">Branch-wide (All Members)</option>
                      {committees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="session-window-select"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Check-in Window
                  </label>
                  <select
                    id="session-window-select"
                    value={newWindowMinutes}
                    onChange={(e) =>
                      setNewWindowMinutes(parseInt(e.target.value, 10))
                    }
                    className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={120}>2 Hours</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="session-punctual-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Punctual Cutoff (min)
                  </label>
                  <Input
                    id="session-punctual-input"
                    type="number"
                    min={0}
                    max={240}
                    value={newPunctualityCutoff}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setNewPunctualityCutoff(
                        Number.isNaN(v) ? 0 : Math.max(0, v)
                      );
                    }}
                    className="mt-1 h-10 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="session-points-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Base + Bonus
                  </label>
                  <div className="mt-1 flex items-center gap-1">
                    <Input
                      id="session-points-input"
                      type="number"
                      min={0}
                      max={500}
                      value={newBasePoints}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setNewBasePoints(Number.isNaN(v) ? 0 : Math.max(0, v));
                      }}
                      className="h-10 text-xs"
                      aria-label="Base points"
                    />
                    <span className="text-xs font-bold text-muted-foreground">
                      +
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={newPunctualityBonus}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setNewPunctualityBonus(
                          Number.isNaN(v) ? 0 : Math.max(0, v)
                        );
                      }}
                      className="h-10 text-xs"
                      aria-label="Punctuality bonus points"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="session-immediate-checkin"
                  checked={newOpenImmediately}
                  onChange={(e) => setNewOpenImmediately(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-[#772583] focus:ring-[#772583]"
                />
                <label
                  htmlFor="session-immediate-checkin"
                  className="text-xs font-medium text-foreground"
                >
                  Open check-in immediately upon creation
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="h-10 gap-2 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  <span>{isSubmitting ? "Saving..." : "Save Session"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sessions.map((sess) => {
          const canManageThis =
            currentUserRole === "master_admin" ||
            currentUserRole === "hr_admin" ||
            (isCommitteeScoped && sess.committeeId === currentUserCommitteeId);
          const canProject = sess.checkinOpen && Boolean(sess.checkinCode);

          return (
            <Card key={sess.id} className="border-border bg-white shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge
                    className={
                      sess.checkinOpen
                        ? "bg-[#78be20] text-white font-semibold text-[11px]"
                        : "bg-muted text-muted-foreground font-semibold text-[11px]"
                    }
                  >
                    {sess.checkinOpen ? "Check-in Open" : "Closed"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(sess.startsAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <CardTitle className="mt-2 font-heading text-base font-bold text-[#002855]">
                  {sess.title}
                </CardTitle>
                <p className="text-xs font-semibold text-[#00629b]">
                  {sess.committeeName}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 border-y border-border/70 py-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Points:</span>
                    <p className="font-heading font-bold text-[#002855]">
                      {sess.basePoints} + {sess.punctualityBonus} bonus
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Attended:</span>
                    <p className="font-heading font-bold text-[#002855]">
                      {sess.attendanceCount} members
                    </p>
                  </div>
                </div>

                {canProject && (
                  <div className="flex items-center justify-between rounded-lg bg-[#002855]/5 px-3 py-1.5 text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Code:
                    </span>
                    <span className="font-mono text-sm font-extrabold text-[#772583]">
                      {sess.checkinCode}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={!canProject}
                    onClick={() => setLiveCheckinSession(sess)}
                    className="w-full h-10 gap-2 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63] disabled:opacity-45"
                  >
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    <span>Open Live Check-In</span>
                  </Button>

                  {canManageThis && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={togglingId === sess.id}
                      onClick={() =>
                        handleToggleCheckin(sess.id, !sess.checkinOpen, 30)
                      }
                      className={`h-9 text-xs font-semibold ${
                        sess.checkinOpen
                          ? "text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                          : "text-[#1e6b0a] hover:bg-[#78be20]/10"
                      }`}
                    >
                      {sess.checkinOpen ? (
                        <>
                          <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                          Close Check-In
                        </>
                      ) : (
                        <>
                          <Radio className="mr-1.5 h-3.5 w-3.5" />
                          Open Check-In (30m)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full-Screen Live Check-In Projector View */}
      {liveCheckinSession && liveCheckinSession.checkinCode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live Check-In Projector"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLiveCheckinSession(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative flex w-full max-w-lg flex-col items-center rounded-2xl border border-border bg-white p-8 text-center shadow-2xl">
            <button
              type="button"
              aria-label="Close check-in"
              onClick={() => setLiveCheckinSession(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5edf7] px-3 py-1 font-heading text-xs font-bold text-[#772583]">
              <Radio className="h-3.5 w-3.5 animate-pulse text-[#772583]" />
              Live Check-In Active
            </span>

            <h2 className="mt-3 font-heading text-2xl font-extrabold text-[#002855]">
              {liveCheckinSession.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {liveCheckinSession.committeeName} · Base{" "}
              {liveCheckinSession.basePoints} pts +{" "}
              {liveCheckinSession.punctualityBonus} punctuality bonus
            </p>

            {/* High-contrast QR display */}
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#772583]/40 bg-[#f8f9fb] p-6">
              <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-white p-2 shadow-sm border border-border">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="Check-in QR code"
                    width={160}
                    height={160}
                    unoptimized
                    className="h-40 w-40"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Generating…
                  </span>
                )}
              </div>

              <p className="mt-4 text-xs font-semibold text-foreground/85">
                Scan QR or enter code on your portal for instant check-in
              </p>

              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#002855] px-4 py-2 font-mono text-2xl font-extrabold tracking-widest text-white shadow-inner">
                {liveCheckinSession.checkinCode}
              </div>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Codes rotate every minute to prevent remote sharing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
