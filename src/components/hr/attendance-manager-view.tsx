"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Plus,
  QrCode,
  Radio,
  Search,
  StopCircle,
  Timer,
  X,
} from "lucide-react";
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
  extendSessionCheckinWindowAction,
  getSessionAttendanceRosterAction,
  setSessionMemberAttendanceAction,
  toggleSessionCheckinAction,
  type CheckinOpenOptions,
  type CreateSessionInput,
  type CreateSessionResult,
  type SessionAttendanceStatus,
  type SessionRosterRow,
} from "@/app/hr/attendance/actions";

export interface SessionItem {
  id: string;
  title: string;
  committeeId?: string | null;
  committeeName: string;
  startsAt: Date;
  checkinOpen: boolean;
  checkinCode: string | null;
  checkinStartsAt?: Date | null;
  checkinEndsAt?: Date | null;
  punctualityStartsAt?: Date | null;
  punctualityCutoffMinutes?: number;
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
  onCreateSession?: (
    input: CreateSessionInput
  ) => Promise<CreateSessionResult | unknown>;
  onToggleCheckin?: (
    sessionId: string,
    open: boolean,
    windowMinutes?: number,
    options?: CheckinOpenOptions
  ) => Promise<CreateSessionResult | unknown>;
  onExtendCheckin?: (
    sessionId: string,
    extraMinutes?: number,
    options?: CheckinOpenOptions
  ) => Promise<{
    ok: boolean;
    error?: string;
    checkinCode?: string | null;
    checkinStartsAt?: Date | null;
    checkinEndsAt?: Date | null;
    punctualityStartsAt?: Date | null;
  }>;
  onLoadSessionRoster?: (sessionId: string) => Promise<{
    ok: boolean;
    error?: string;
    roster?: SessionRosterRow[];
  }>;
  onSetMemberAttendance?: (input: {
    sessionId: string;
    membershipId: string;
    status: SessionAttendanceStatus;
    overrideReason?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    pointsAwarded?: number;
    status?: SessionAttendanceStatus;
    statusUpdatedAt?: string;
  }>;
}

type SessionLifecycleState = "scheduled" | "live" | "closed";

function getSessionStateAt(
  sess: SessionItem,
  nowMs: number
): SessionLifecycleState {
  if (!sess.checkinOpen) return "closed";
  if (
    sess.checkinEndsAt &&
    new Date(sess.checkinEndsAt).getTime() <= nowMs
  ) {
    return "closed";
  }
  if (
    sess.checkinStartsAt &&
    new Date(sess.checkinStartsAt).getTime() > nowMs
  ) {
    return "scheduled";
  }
  return "live";
}

function formatRemainingCountdown(
  targetAt: Date | null | undefined,
  nowMs: number
): string | null {
  if (!targetAt) return null;
  const remainingSec = Math.max(
    0,
    Math.floor((new Date(targetAt).getTime() - nowMs) / 1000)
  );
  if (remainingSec <= 0) return "00:00";
  const days = Math.floor(remainingSec / 86400);
  const hours = Math.floor((remainingSec % 86400) / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSessionDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatExactTimestamp(iso: string | null | undefined): string {
  if (!iso) return "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isPastPunctualityCutoff(
  sess: SessionItem,
  nowMs: number,
  defaultCutoffMinutes: number
): boolean {
  const cutoffMins = sess.punctualityCutoffMinutes ?? defaultCutoffMinutes;
  const anchor = new Date(sess.punctualityStartsAt ?? sess.startsAt);
  if (Number.isNaN(anchor.getTime())) return false;
  return nowMs > anchor.getTime() + cutoffMins * 60_000;
}

function getLocalDatetimeInputValue(date: Date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

const STATUS_META: Record<
  SessionAttendanceStatus,
  { label: string; shortKey: string; activeClass: string; badgeClass: string }
> = {
  on_time: {
    label: "On Time",
    shortKey: "O",
    activeClass: "bg-[#1e6b0a] text-white border-[#1e6b0a]",
    badgeClass: "bg-[#78be20]/15 text-[#1e6b0a]",
  },
  late: {
    label: "Late",
    shortKey: "L",
    activeClass: "bg-[#b45309] text-white border-[#b45309]",
    badgeClass: "bg-[#ffc627]/25 text-[#92400e]",
  },
  excused: {
    label: "Excused",
    shortKey: "E",
    activeClass: "bg-[#00629b] text-white border-[#00629b]",
    badgeClass: "bg-[#00629b]/15 text-[#00629b]",
  },
  absent: {
    label: "Absent",
    shortKey: "A",
    activeClass: "bg-[#ba0c2f] text-white border-[#ba0c2f]",
    badgeClass: "bg-[#ba0c2f]/10 text-[#ba0c2f]",
  },
};

const ALL_STATUSES: SessionAttendanceStatus[] = [
  "on_time",
  "late",
  "excused",
  "absent",
];

function formatRoleTag(role: string): string {
  switch (role) {
    case "master_admin":
      return "Admin";
    case "director":
      return "Director";
    case "hr_admin":
      return "HR Head";
    case "hr_member":
      return "HR";
    case "committee_head":
      return "Head";
    case "attendee":
      return "Attendee";
    default:
      return "Member";
  }
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
  onExtendCheckin,
  onLoadSessionRoster,
  onSetMemberAttendance,
}: AttendanceManagerViewProps) {
  const [sessionList, setSessionList] = useState<SessionItem[]>(sessions);
  const [prevSessionsProp, setPrevSessionsProp] = useState(sessions);
  if (sessions !== prevSessionsProp) {
    setPrevSessionsProp(sessions);
    setSessionList(sessions);
  }
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [liveCheckinSessionId, setLiveCheckinSessionId] = useState<
    string | null
  >(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdBanner, setCreatedBanner] = useState<{
    sessionId: string;
    title: string;
    state: SessionLifecycleState;
  } | null>(null);
  const [pendingReopenPrompt, setPendingReopenPrompt] = useState<{
    session: SessionItem;
    mode: "toggle" | "extend";
    minutes: number;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  // Per-session attendance roster sheet state
  const [sheetSession, setSheetSession] = useState<SessionItem | null>(null);
  const [rosterRows, setRosterRows] = useState<SessionRosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterStatusFilter, setRosterStatusFilter] = useState<
    "all" | SessionAttendanceStatus
  >("all");
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(
    null
  );
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newStartsAt, setNewStartsAt] = useState(() =>
    getLocalDatetimeInputValue()
  );
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

  const liveCheckinSession = useMemo(
    () =>
      liveCheckinSessionId
        ? sessionList.find((s) => s.id === liveCheckinSessionId) ?? null
        : null,
    [liveCheckinSessionId, sessionList]
  );

  // Tick every second only while at least one session is actively scheduled or live
  const hasPendingOrLiveTimer = useMemo(
    () =>
      sessionList.some((s) => {
        const state = getSessionStateAt(s, nowMs);
        return (
          (state === "live" && Boolean(s.checkinEndsAt)) ||
          (state === "scheduled" && Boolean(s.checkinStartsAt))
        );
      }),
    [sessionList, nowMs]
  );

  useEffect(() => {
    if (!hasPendingOrLiveTimer) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [hasPendingOrLiveTimer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateModal(false);
        setLiveCheckinSessionId(null);
        setSheetSession(null);
        setPendingReopenPrompt(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const liveSessionState: SessionLifecycleState = liveCheckinSession
    ? getSessionStateAt(liveCheckinSession, nowMs)
    : "closed";
  // Persistent QR: always generate when the session has a check-in code (scheduled, live, or closed)
  const activeQrCode = liveCheckinSession?.checkinCode ?? null;

  useEffect(() => {
    let cancelled = false;
    if (activeQrCode) {
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";
      const qrPayload = origin
        ? buildCheckinQrUrl(origin, activeQrCode)
        : activeQrCode;
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
  }, [activeQrCode]);

  const isCommitteeScoped =
    currentUserRole === "committee_head" || currentUserRole === "hr_member";
  const hasMissingCommitteeScope =
    isCommitteeScoped && !currentUserCommitteeId;
  const canCreate =
    (currentUserRole === "master_admin" ||
      currentUserRole === "hr_admin" ||
      currentUserRole === "hr_member" ||
      currentUserRole === "committee_head") &&
    !hasMissingCommitteeScope;

  const canManageSession = useCallback(
    (sess: SessionItem) =>
      currentUserRole === "master_admin" ||
      currentUserRole === "hr_admin" ||
      (isCommitteeScoped &&
        currentUserCommitteeId !== null &&
        sess.committeeId === currentUserCommitteeId),
    [currentUserRole, isCommitteeScoped, currentUserCommitteeId]
  );

  const createSchedulePreview = useMemo(() => {
    const start = new Date(newStartsAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + newWindowMinutes * 60_000);
    if (start.getTime() > nowMs) {
      return {
        tone: "info" as const,
        message: `Auto-opens on ${formatSessionDateTime(start)} and closes on ${formatSessionDateTime(end)} (${newWindowMinutes}m). Persistent QR & code are ready immediately for slides.`,
      };
    }
    if (end.getTime() > nowMs) {
      const remainingMins = Math.max(
        1,
        Math.ceil((end.getTime() - nowMs) / 60_000)
      );
      return {
        tone: "live" as const,
        message: `Check-in opens immediately and stays open until ${formatSessionDateTime(end)} (~${remainingMins}m remaining).`,
      };
    }
    return {
      tone: "warning" as const,
      message: `The ${newWindowMinutes}m check-in window from this start time has already elapsed. The session will be created Closed with its persistent QR & code — you can re-open check-in anytime.`,
    };
  }, [newStartsAt, newWindowMinutes, nowMs]);

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
    };

    try {
      const rawRes = onCreateSession
        ? await onCreateSession(input)
        : await createSessionAction(input);
      const res =
        rawRes && typeof rawRes === "object"
          ? (rawRes as CreateSessionResult)
          : null;

      if (res && res.ok === false) {
        setErrorMessage(res.error || "Failed to create session.");
        return;
      }

      if (res?.session) {
        const createdItem: SessionItem = {
          ...res.session,
          startsAt: new Date(res.session.startsAt),
          checkinStartsAt: res.session.checkinStartsAt
            ? new Date(res.session.checkinStartsAt)
            : null,
          checkinEndsAt: res.session.checkinEndsAt
            ? new Date(res.session.checkinEndsAt)
            : null,
          punctualityStartsAt: res.session.punctualityStartsAt
            ? new Date(res.session.punctualityStartsAt)
            : null,
        };
        setNowMs(Date.now());
        setSessionList((prev) => {
          const withoutDup = prev.filter((item) => item.id !== createdItem.id);
          return [createdItem, ...withoutDup].sort(
            (a, b) =>
              new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
          );
        });
        setCreatedBanner({
          sessionId: createdItem.id,
          title: createdItem.title,
          state: getSessionStateAt(createdItem, Date.now()),
        });
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
    windowMinutes: number = attendanceDefaults.defaultCheckinWindowMinutes,
    options?: CheckinOpenOptions
  ) => {
    setTogglingId(sessionId);
    setActionError(null);
    try {
      const rawRes = onToggleCheckin
        ? await onToggleCheckin(sessionId, open, windowMinutes, options)
        : await toggleSessionCheckinAction(
            sessionId,
            open,
            windowMinutes,
            options
          );
      const res =
        rawRes && typeof rawRes === "object"
          ? (rawRes as CreateSessionResult)
          : null;
      if (res && res.ok === false) {
        setActionError(res.error ?? "Failed to update check-in status.");
        return;
      }
      const now = new Date();
      setNowMs(now.getTime());
      setSessionList((prev) =>
        prev.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                checkinOpen: open,
                checkinCode: res?.checkinCode ?? item.checkinCode,
                checkinStartsAt: open ? (res?.checkinStartsAt ?? now) : null,
                checkinEndsAt: open
                  ? (res?.checkinEndsAt ??
                    new Date(now.getTime() + windowMinutes * 60_000))
                  : null,
                punctualityStartsAt:
                  res?.punctualityStartsAt !== undefined
                    ? res.punctualityStartsAt
                    : open && options?.resetPunctualityFromNow
                      ? now
                      : item.punctualityStartsAt,
              }
            : item
        )
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update check-in status."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleExtendWindow = async (
    sessionId: string,
    extraMinutes = 15,
    options?: CheckinOpenOptions
  ) => {
    setExtendingId(sessionId);
    setActionError(null);
    try {
      const res = onExtendCheckin
        ? await onExtendCheckin(sessionId, extraMinutes, options)
        : await extendSessionCheckinWindowAction(
            sessionId,
            extraMinutes,
            options
          );
      if (!res.ok) {
        setActionError(res.error ?? "Failed to extend check-in window.");
        return;
      }
      const now = new Date();
      setNowMs(now.getTime());
      setSessionList((prev) =>
        prev.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                checkinOpen: true,
                checkinCode: res.checkinCode ?? item.checkinCode,
                checkinStartsAt:
                  res.checkinStartsAt !== undefined
                    ? res.checkinStartsAt
                    : getSessionStateAt(item, now.getTime()) === "closed"
                      ? now
                      : item.checkinStartsAt,
                checkinEndsAt:
                  res.checkinEndsAt ??
                  new Date(now.getTime() + extraMinutes * 60_000),
                punctualityStartsAt:
                  res.punctualityStartsAt !== undefined
                    ? res.punctualityStartsAt
                    : options?.resetPunctualityFromNow
                      ? now
                      : item.punctualityStartsAt,
              }
            : item
        )
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to extend check-in window."
      );
    } finally {
      setExtendingId(null);
    }
  };

  const requestOpenOrReopen = (
    sess: SessionItem,
    mode: "toggle" | "extend",
    minutes: number
  ) => {
    const nowMsCurrent = new Date().getTime();
    if (
      isPastPunctualityCutoff(
        sess,
        nowMsCurrent,
        attendanceDefaults.punctualityCutoffMinutes
      )
    ) {
      setPendingReopenPrompt({ session: sess, mode, minutes });
      return;
    }
    if (mode === "extend") {
      void handleExtendWindow(sess.id, minutes);
    } else {
      void handleToggleCheckin(sess.id, true, minutes);
    }
  };

  const confirmPendingReopen = (resetPunctualityFromNow: boolean) => {
    if (!pendingReopenPrompt) return;
    const { session, mode, minutes } = pendingReopenPrompt;
    setPendingReopenPrompt(null);
    const opts: CheckinOpenOptions = { resetPunctualityFromNow };
    if (mode === "extend") {
      void handleExtendWindow(session.id, minutes, opts);
    } else {
      void handleToggleCheckin(session.id, true, minutes, opts);
    }
  };

  // Open Per-Session Attendance Sheet
  const openAttendanceSheet = async (sess: SessionItem) => {
    setSheetSession(sess);
    setRosterRows([]);
    setRosterError(null);
    setRosterSearch("");
    setRosterStatusFilter("all");
    setActiveRowIndex(0);
    setRosterLoading(true);
    try {
      const res = onLoadSessionRoster
        ? await onLoadSessionRoster(sess.id)
        : await getSessionAttendanceRosterAction(sess.id);
      if (!res.ok) {
        setRosterError(res.error ?? "Failed to load attendance sheet.");
      } else {
        setRosterRows(res.roster ?? []);
      }
    } catch (err: unknown) {
      setRosterError(
        err instanceof Error ? err.message : "Failed to load attendance sheet."
      );
    } finally {
      setRosterLoading(false);
    }
  };

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return rosterRows.filter((row) => {
      if (rosterStatusFilter !== "all" && row.status !== rosterStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.committeeName.toLowerCase().includes(q)
      );
    });
  }, [rosterRows, rosterSearch, rosterStatusFilter]);

  const rosterCounts = useMemo(() => {
    const counts = { on_time: 0, late: 0, excused: 0, absent: 0 };
    for (const row of rosterRows) {
      counts[row.status] += 1;
    }
    return counts;
  }, [rosterRows]);

  const handleSetRowAttendance = useCallback(
    async (row: SessionRosterRow, nextStatus: SessionAttendanceStatus) => {
      if (!sheetSession) return;
      if (!canManageSession(sheetSession)) return;
      if (row.status === nextStatus) return;

      const prevRows = rosterRows;
      const estimatedPoints =
        row.role === "attendee"
          ? 0
          : nextStatus === "on_time"
            ? sheetSession.basePoints + sheetSession.punctualityBonus
            : nextStatus === "late"
              ? sheetSession.basePoints
              : 0;

      const wasPresent = row.status === "on_time" || row.status === "late";
      const willBePresent =
        nextStatus === "on_time" || nextStatus === "late";
      const attendanceDelta =
        Number(willBePresent) - Number(wasPresent);

      // Optimistic update
      const optimisticUpdatedAt = new Date().toISOString();
      setRosterError(null);
      setSavingMembershipId(row.membershipId);
      setRosterRows((curr) =>
        curr.map((item) =>
          item.membershipId === row.membershipId
            ? {
                ...item,
                status: nextStatus,
                pointsAwarded: estimatedPoints,
                statusUpdatedAt: optimisticUpdatedAt,
              }
            : item
        )
      );
      if (attendanceDelta !== 0) {
        setSessionList((curr) =>
          curr.map((item) =>
            item.id === sheetSession.id
              ? {
                  ...item,
                  attendanceCount: Math.max(
                    0,
                    item.attendanceCount + attendanceDelta
                  ),
                }
              : item
          )
        );
      }

      try {
        const payload = {
          sessionId: sheetSession.id,
          membershipId: row.membershipId,
          status: nextStatus,
        };
        const res = onSetMemberAttendance
          ? await onSetMemberAttendance(payload)
          : await setSessionMemberAttendanceAction(payload);
        if (!res.ok) {
          setRosterRows(prevRows);
          if (attendanceDelta !== 0) {
            setSessionList((curr) =>
              curr.map((item) =>
                item.id === sheetSession.id
                  ? {
                      ...item,
                      attendanceCount: Math.max(
                        0,
                        item.attendanceCount - attendanceDelta
                      ),
                    }
                  : item
              )
            );
          }
          setRosterError(res.error ?? "Failed to save attendance update.");
        } else {
          setRosterRows((curr) =>
            curr.map((item) =>
              item.membershipId === row.membershipId
                ? {
                    ...item,
                    pointsAwarded:
                      typeof res.pointsAwarded === "number"
                        ? res.pointsAwarded
                        : item.pointsAwarded,
                    statusUpdatedAt: res.statusUpdatedAt ?? optimisticUpdatedAt,
                  }
                : item
            )
          );
        }
      } catch (err: unknown) {
        setRosterRows(prevRows);
        if (attendanceDelta !== 0) {
          setSessionList((curr) =>
            curr.map((item) =>
              item.id === sheetSession.id
                ? {
                    ...item,
                    attendanceCount: Math.max(
                      0,
                      item.attendanceCount - attendanceDelta
                    ),
                  }
                : item
            )
          );
        }
        setRosterError(
          err instanceof Error ? err.message : "Failed to save attendance."
        );
      } finally {
        setSavingMembershipId(null);
      }
    },
    [sheetSession, canManageSession, rosterRows, onSetMemberAttendance]
  );

  // Keyboard shortcuts inside Attendance Sheet (↑ / ↓ / O / L / E / A)
  useEffect(() => {
    if (!sheetSession || filteredRoster.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(filteredRoster.length - 1, activeRowIndex + 1);
        setActiveRowIndex(next);
        rowRefs.current[next]?.scrollIntoView?.({ block: "nearest" });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, activeRowIndex - 1);
        setActiveRowIndex(next);
        rowRefs.current[next]?.scrollIntoView?.({ block: "nearest" });
        return;
      }

      const key = e.key.toLowerCase();
      const statusByKey: Record<string, SessionAttendanceStatus> = {
        o: "on_time",
        l: "late",
        e: "excused",
        a: "absent",
      };
      const mapped = statusByKey[key];
      if (mapped && canManageSession(sheetSession)) {
        const activeRow = filteredRoster[activeRowIndex];
        if (activeRow) {
          e.preventDefault();
          void handleSetRowAttendance(activeRow, mapped);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    sheetSession,
    filteredRoster,
    activeRowIndex,
    canManageSession,
    handleSetRowAttendance,
  ]);

  const liveCountdown =
    liveCheckinSession && liveSessionState === "live"
      ? formatRemainingCountdown(liveCheckinSession.checkinEndsAt, nowMs)
      : null;
  const scheduledCountdown =
    liveCheckinSession && liveSessionState === "scheduled"
      ? formatRemainingCountdown(liveCheckinSession.checkinStartsAt, nowMs)
      : null;

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

      {createdBanner && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#78be20]/40 bg-[#eaf5dd] px-4 py-3 text-xs text-[#1e6b0a]"
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Created session &ldquo;{createdBanner.title}&rdquo; (
              {createdBanner.state === "live"
                ? "Check-in Open"
                : createdBanner.state === "scheduled"
                  ? "Scheduled Auto-Open"
                  : "Closed — ready to re-open"}
              ).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLiveCheckinSessionId(createdBanner.sessionId)}
              className="h-7 border-[#1e6b0a]/30 bg-white px-2.5 text-[11px] font-semibold text-[#1e6b0a] hover:bg-[#eaf5dd]"
            >
              View QR &amp; Code
            </Button>
            <button
              type="button"
              aria-label="Dismiss session created banner"
              onClick={() => setCreatedBanner(null)}
              className="rounded p-1 text-[#1e6b0a]/80 hover:bg-[#1e6b0a]/10 hover:text-[#1e6b0a]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Sessions &amp; Live QR Attendance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project live QR codes with auto-closing check-in timers, or open a
            session&apos;s Attendance Sheet to adjust statuses directly.
          </p>
        </div>

        {canCreate && (
          <Button
            type="button"
            onClick={() => {
              const now = new Date();
              setErrorMessage(null);
              setNowMs(now.getTime());
              setNewStartsAt(getLocalDatetimeInputValue(now));
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
                Set up a session with an auto-closing check-in window and
                punctuality points.
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
                    Date &amp; Time
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

              {createSchedulePreview && (
                <div
                  className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                    createSchedulePreview.tone === "warning"
                      ? "border-[#b45309]/30 bg-[#ffc627]/15 text-[#92400e]"
                      : createSchedulePreview.tone === "live"
                        ? "border-[#78be20]/40 bg-[#eaf5dd] text-[#1e6b0a]"
                        : "border-[#00629b]/25 bg-[#f0f6fa] text-[#002855]"
                  }`}
                >
                  {createSchedulePreview.message}
                </div>
              )}

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
      {sessionList.length === 0 ? (
        <Card className="border-border bg-white shadow-xs">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {hasMissingCommitteeScope
              ? "You are not assigned to a committee yet. Ask an HR Admin or Master Admin to assign your committee before managing sessions."
              : "No sessions scheduled yet for this season."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessionList.map((sess) => {
            const state = getSessionStateAt(sess, nowMs);
            const isLive = state === "live";
            const isScheduled = state === "scheduled";
            const canManageThis = canManageSession(sess);
            const hasCode = Boolean(sess.checkinCode);
            const countdown = isLive
              ? formatRemainingCountdown(sess.checkinEndsAt, nowMs)
              : isScheduled
                ? formatRemainingCountdown(sess.checkinStartsAt, nowMs)
                : null;

            return (
              <Card
                key={sess.id}
                className="flex flex-col border-border bg-white shadow-xs"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        className={
                          isLive
                            ? "bg-[#78be20] font-semibold text-[11px] text-white"
                            : isScheduled
                              ? "bg-[#00629b] font-semibold text-[11px] text-white"
                              : "bg-muted font-semibold text-[11px] text-muted-foreground"
                        }
                      >
                        {isLive
                          ? "Check-in Open"
                          : isScheduled
                            ? "Scheduled"
                            : "Closed"}
                      </Badge>
                      {countdown && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                            isScheduled
                              ? "bg-[#00629b]/10 text-[#00629b]"
                              : "bg-[#f5edf7] text-[#772583]"
                          }`}
                        >
                          <Timer className="h-3 w-3" aria-hidden="true" />
                          {isScheduled ? `Opens in ${countdown}` : countdown}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                  <div className="space-y-3">
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

                    {hasCode && (
                      <div className="flex items-center justify-between rounded-lg bg-[#002855]/5 px-3 py-1.5 text-xs">
                        <span className="font-semibold text-muted-foreground">
                          Code:
                        </span>
                        <span className="font-mono text-sm font-extrabold text-[#772583]">
                          {sess.checkinCode}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        disabled={!hasCode}
                        onClick={() => setLiveCheckinSessionId(sess.id)}
                        className="h-9 gap-1.5 bg-[#772583] px-2.5 text-xs font-semibold text-white hover:bg-[#5a1b63] disabled:opacity-45"
                      >
                        <QrCode className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {isLive || !hasCode
                            ? "Open Live Check-In"
                            : "View QR & Code"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        title="Open Attendance Sheet"
                        onClick={() => openAttendanceSheet(sess)}
                        className="h-9 gap-1.5 border-[#002855]/25 px-2.5 text-xs font-semibold text-[#002855] hover:bg-[#f5edf7] hover:text-[#772583]"
                      >
                        <ClipboardList
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Sheet</span>
                      </Button>
                    </div>

                    {canManageThis && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={togglingId === sess.id}
                        onClick={() => {
                          if (isLive) {
                            void handleToggleCheckin(sess.id, false);
                          } else {
                            requestOpenOrReopen(
                              sess,
                              "toggle",
                              attendanceDefaults.defaultCheckinWindowMinutes
                            );
                          }
                        }}
                        className={`h-9 text-xs font-semibold ${
                          isLive
                            ? "text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                            : "text-[#1e6b0a] hover:bg-[#78be20]/10"
                        }`}
                      >
                        {isLive ? (
                          <>
                            <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                            Close Check-In
                          </>
                        ) : isScheduled ? (
                          <>
                            <Radio className="mr-1.5 h-3.5 w-3.5" />
                            Open Now (
                            {attendanceDefaults.defaultCheckinWindowMinutes}m)
                          </>
                        ) : (
                          <>
                            <Radio className="mr-1.5 h-3.5 w-3.5" />
                            Re-open Check-In (
                            {attendanceDefaults.defaultCheckinWindowMinutes}m)
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
      )}

      {/* Per-Session Keyboard-Friendly Attendance Sheet Modal */}
      {sheetSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Attendance Sheet: ${sheetSession.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetSession(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-6"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            {/* Sheet Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-[#f8f9fb] px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-lg font-extrabold text-[#002855]">
                    Attendance Sheet — {sheetSession.title}
                  </h2>
                  <Badge className="bg-[#f5edf7] text-[11px] font-bold text-[#772583]">
                    {sheetSession.committeeName}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(sheetSession.startsAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · On Time = +{sheetSession.basePoints + sheetSession.punctualityBonus} pts ·
                  Late = +{sheetSession.basePoints} pts · Excused / Absent = 0 pts
                </p>
              </div>
              <button
                type="button"
                aria-label="Close attendance sheet"
                onClick={() => setSheetSession(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Summary & Filter Controls */}
            <div className="space-y-3 border-b border-border bg-white px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRosterStatusFilter("all");
                      setActiveRowIndex(0);
                    }}
                    className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                      rosterStatusFilter === "all"
                        ? "bg-[#002855] text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    All ({rosterRows.length})
                  </button>
                  {ALL_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setRosterStatusFilter(st);
                        setActiveRowIndex(0);
                      }}
                      className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                        rosterStatusFilter === st
                          ? STATUS_META[st].activeClass
                          : STATUS_META[st].badgeClass
                      }`}
                    >
                      {STATUS_META[st].label} ({rosterCounts[st]})
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    placeholder="Filter member or committee..."
                    value={rosterSearch}
                    onChange={(e) => {
                      setRosterSearch(e.target.value);
                      setActiveRowIndex(0);
                    }}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f5edf7]/70 px-3 py-1.5 text-[11px] text-[#5a1b63]">
                <span>
                  <strong>Keyboard shortcuts:</strong>{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    ↑
                  </kbd>{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    ↓
                  </kbd>{" "}
                  move row ·{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    O
                  </kbd>{" "}
                  On Time ·{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    L
                  </kbd>{" "}
                  Late ·{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    E
                  </kbd>{" "}
                  Excused ·{" "}
                  <kbd className="rounded border border-[#772583]/30 bg-white px-1 py-0.5 font-mono text-[10px]">
                    A
                  </kbd>{" "}
                  Absent
                </span>
                {!canManageSession(sheetSession) && (
                  <span className="font-semibold text-[#00629b]">
                    Read-only view
                  </span>
                )}
              </div>

              {rosterError && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
                >
                  {rosterError}
                </div>
              )}
            </div>

            {/* Roster Table */}
            <div className="flex-1 overflow-auto">
              {rosterLoading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Loading assigned roster…
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No members match the current filter.
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-[#f8f9fb] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Member</th>
                      <th className="hidden px-3 py-2.5 sm:table-cell">
                        Committee
                      </th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">
                        Status Updated
                      </th>
                      <th className="px-4 py-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredRoster.map((row, idx) => {
                      const isSelected = idx === activeRowIndex;
                      const editable = canManageSession(sheetSession);
                      const isRowSaving = savingMembershipId === row.membershipId;

                      return (
                        <tr
                          key={row.membershipId}
                          ref={(el) => {
                            rowRefs.current[idx] = el;
                          }}
                          onClick={() => setActiveRowIndex(idx)}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-[#f5edf7]/70"
                              : "bg-white hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-heading text-sm font-bold text-[#002855]">
                                {row.fullName}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {formatRoleTag(row.role)}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {row.email}
                            </p>
                          </td>

                          <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                            {row.committeeName}
                          </td>

                          <td className="px-3 py-2.5">
                            <div
                              role="group"
                              aria-label={`Attendance status for ${row.fullName}`}
                              className="flex flex-wrap items-center justify-center gap-1"
                            >
                              {ALL_STATUSES.map((st) => {
                                const active = row.status === st;
                                const meta = STATUS_META[st];
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={!editable || isRowSaving}
                                    aria-pressed={active}
                                    aria-label={`Mark ${row.fullName} as ${meta.label}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRowIndex(idx);
                                      void handleSetRowAttendance(row, st);
                                    }}
                                    className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                      active
                                        ? meta.activeClass
                                        : "border-border bg-white text-muted-foreground hover:border-[#772583]/40 hover:text-[#002855]"
                                    }`}
                                  >
                                    <span>{meta.label}</span>
                                    <span
                                      className={`hidden font-mono text-[9px] sm:inline ${
                                        active
                                          ? "opacity-85"
                                          : "text-muted-foreground/70"
                                      }`}
                                    >
                                      ({meta.shortKey})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                            {formatExactTimestamp(
                              row.statusUpdatedAt ?? row.checkedInAt
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-[#002855]">
                            {row.pointsAwarded > 0
                              ? `+${row.pointsAwarded} pts`
                              : "0 pts"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Live Check-In Projector View */}
      {liveCheckinSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live Check-In Projector"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLiveCheckinSessionId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative flex w-full max-w-lg flex-col items-center rounded-2xl border border-border bg-white p-8 text-center shadow-2xl">
            <button
              type="button"
              aria-label="Close check-in"
              onClick={() => setLiveCheckinSessionId(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {liveCheckinSession.checkinCode ? (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {liveSessionState === "live" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5edf7] px-3 py-1 font-heading text-xs font-bold text-[#772583]">
                        <Radio className="h-3.5 w-3.5 animate-pulse text-[#772583]" />
                        Live Check-In Active
                      </span>
                      {liveCountdown && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#002855]/10 px-3 py-1 font-mono text-xs font-bold text-[#002855]">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          Closes in {liveCountdown}
                        </span>
                      )}
                    </>
                  )}
                  {liveSessionState === "scheduled" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00629b]/10 px-3 py-1 font-heading text-xs font-bold text-[#00629b]">
                        <CalendarClock
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Scheduled Auto-Open
                      </span>
                      {scheduledCountdown && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#002855]/10 px-3 py-1 font-mono text-xs font-bold text-[#002855]">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          Opens in {scheduledCountdown}
                        </span>
                      )}
                    </>
                  )}
                  {liveSessionState === "closed" && (
                    <Badge className="bg-muted text-xs font-bold text-muted-foreground">
                      Check-In Window Closed
                    </Badge>
                  )}
                </div>

                <h2 className="mt-3 font-heading text-2xl font-extrabold text-[#002855]">
                  {liveCheckinSession.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {liveCheckinSession.committeeName} · Base{" "}
                  {liveCheckinSession.basePoints} pts +{" "}
                  {liveCheckinSession.punctualityBonus} punctuality bonus
                </p>

                {liveSessionState === "scheduled" && (
                  <p className="mt-3 rounded-lg border border-[#00629b]/25 bg-[#f0f6fa] px-3 py-2 text-xs text-[#002855]">
                    Add this QR to your slides. Check-in opens automatically on{" "}
                    <span className="font-bold">
                      {formatSessionDateTime(liveCheckinSession.checkinStartsAt)}
                    </span>
                    {liveCheckinSession.checkinEndsAt
                      ? ` and closes on ${formatSessionDateTime(liveCheckinSession.checkinEndsAt)}`
                      : ""}
                    .
                  </p>
                )}

                {liveSessionState === "closed" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Check-in is currently closed, but this QR and code stay the
                    same when you re-open check-in later.
                  </p>
                )}

                {/* High-contrast persistent QR display */}
                <div className="mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#772583]/40 bg-[#f8f9fb] p-6">
                  <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-border bg-white p-2 shadow-sm">
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

                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download={`${liveCheckinSession.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "") || "session"}-qr.png`}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#772583] hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download QR for slides (PNG)
                    </a>
                  )}
                </div>

                {liveSessionState === "live" &&
                  canManageSession(liveCheckinSession) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={extendingId === liveCheckinSession.id}
                        onClick={() =>
                          handleExtendWindow(liveCheckinSession.id, 15)
                        }
                        className="h-9 gap-1.5 border-[#772583]/30 text-xs font-semibold text-[#772583] hover:bg-[#f5edf7]"
                      >
                        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                        {extendingId === liveCheckinSession.id
                          ? "Extending…"
                          : "+15m Extend Window"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void handleToggleCheckin(
                            liveCheckinSession.id,
                            false
                          );
                          setLiveCheckinSessionId(null);
                        }}
                        className="h-9 gap-1.5 text-xs font-semibold text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                      >
                        <StopCircle
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Close Now
                      </Button>
                    </div>
                  )}

                {liveSessionState === "scheduled" &&
                  canManageSession(liveCheckinSession) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        disabled={togglingId === liveCheckinSession.id}
                        onClick={() =>
                          requestOpenOrReopen(
                            liveCheckinSession,
                            "toggle",
                            attendanceDefaults.defaultCheckinWindowMinutes
                          )
                        }
                        className="h-9 gap-1.5 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                      >
                        <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                        Open Now (
                        {attendanceDefaults.defaultCheckinWindowMinutes}m)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={togglingId === liveCheckinSession.id}
                        onClick={() =>
                          handleToggleCheckin(liveCheckinSession.id, false)
                        }
                        className="h-9 gap-1.5 text-xs font-semibold text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                      >
                        <StopCircle
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Cancel Auto-Open
                      </Button>
                    </div>
                  )}

                {liveSessionState === "closed" && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {canManageSession(liveCheckinSession) && (
                      <Button
                        type="button"
                        disabled={extendingId === liveCheckinSession.id}
                        onClick={() =>
                          requestOpenOrReopen(liveCheckinSession, "extend", 15)
                        }
                        className="h-9 gap-1.5 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                      >
                        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                        Re-open (+15m)
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const target = liveCheckinSession;
                        setLiveCheckinSessionId(null);
                        void openAttendanceSheet(target);
                      }}
                      className="h-9 gap-1.5 text-xs font-semibold text-[#002855]"
                    >
                      <ClipboardList
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Open Attendance Sheet
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 py-4">
                <Badge className="bg-muted text-xs font-bold text-muted-foreground">
                  Check-In Window Closed
                </Badge>
                <h2 className="font-heading text-xl font-extrabold text-[#002855]">
                  {liveCheckinSession.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  This session does not have a check-in code yet. Open check-in
                  to assign its persistent QR and code, or mark arrivals in the
                  Attendance Sheet.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {canManageSession(liveCheckinSession) && (
                    <Button
                      type="button"
                      onClick={() =>
                        requestOpenOrReopen(liveCheckinSession, "extend", 15)
                      }
                      className="h-9 gap-1.5 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
                    >
                      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                      Re-open (+15m)
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const target = liveCheckinSession;
                      setLiveCheckinSessionId(null);
                      void openAttendanceSheet(target);
                    }}
                    className="h-9 gap-1.5 text-xs font-semibold text-[#002855]"
                  >
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                    Open Attendance Sheet
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Punctuality Cutoff Choice Modal when re-opening a delayed or past session */}
      {pendingReopenPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Punctuality Cutoff Has Passed"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingReopenPrompt(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Cancel re-open"
              onClick={() => setPendingReopenPrompt(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ffc627]/25 text-[#92400e]">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-extrabold text-[#002855]">
                  Punctuality Cutoff Has Passed
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The punctuality window for{" "}
                  <span className="font-semibold text-foreground">
                    {pendingReopenPrompt.session.title}
                  </span>{" "}
                  has already ended. Choose how attendees checking in during
                  this {pendingReopenPrompt.minutes}-minute window should be
                  scored:
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => confirmPendingReopen(true)}
                className="h-10 w-full justify-center bg-[#772583] text-xs font-bold text-white hover:bg-[#5a1b63]"
              >
                Reset Grace Period from Now (
                {pendingReopenPrompt.session.punctualityCutoffMinutes ??
                  attendanceDefaults.punctualityCutoffMinutes}
                m)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => confirmPendingReopen(false)}
                className="h-10 w-full justify-center text-xs font-semibold text-[#002855]"
              >
                Keep Original Start Time (Mark Late)
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingReopenPrompt(null)}
                className="h-9 w-full justify-center text-xs font-medium text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
