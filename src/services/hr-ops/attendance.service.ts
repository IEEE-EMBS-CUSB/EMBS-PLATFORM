import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canManageCommitteeSessions,
  getOperationalCommitteeScope,
} from "@/lib/permissions";
import { normalizeSeasonSettings } from "@/lib/season-settings";
import { upsertScoreLedgerEntry } from "@/db/ledger";
import { deduplicateRecipientsByPerson } from "./tasks.service";
import {
  assertMonthNotPublished,
  formatMonthInCairo,
  getPostgresErrorCode,
  isValidDateString,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

export type SessionAttendanceStatus = "on_time" | "late" | "excused" | "absent";

export interface SessionRosterRow {
  membershipId: string;
  fullName: string;
  email: string;
  committeeName: string;
  role: MembershipRole;
  status: SessionAttendanceStatus;
  pointsAwarded: number;
  checkedInAt: string | null;
  overrideReason: string | null;
}

/**
 * Pure source-of-truth check for whether a session's check-in window is currently live.
 * Returns false immediately once `checkinEndsAt` / `checkinExpiresAt` has passed,
 * even if the raw database `checkin_open` boolean has not been lazily closed yet.
 */
export function isSessionCheckinLive(
  session: {
    checkinOpen: boolean;
    checkinEndsAt?: Date | string | null;
    checkinExpiresAt?: Date | string | null;
  },
  now: Date = new Date()
): boolean {
  if (!session.checkinOpen) return false;
  const deadlineRaw = session.checkinEndsAt ?? session.checkinExpiresAt;
  if (!deadlineRaw) return true;
  const deadline =
    deadlineRaw instanceof Date ? deadlineRaw : new Date(deadlineRaw);
  if (Number.isNaN(deadline.getTime())) return true;
  return now.getTime() <= deadline.getTime();
}

/**
 * Deterministically maps a manual HR attendance status to DB fields and points.
 */
export function computePointsForAttendanceStatus(input: {
  status: SessionAttendanceStatus;
  basePoints: number;
  punctualityBonus: number;
  isAttendee: boolean;
}): {
  dbStatus: "present" | "excused" | "absent";
  isPunctual: boolean;
  pointsAwarded: number;
} {
  const { status, basePoints, punctualityBonus, isAttendee } = input;
  switch (status) {
    case "on_time":
      return {
        dbStatus: "present",
        isPunctual: true,
        pointsAwarded: isAttendee ? 0 : basePoints + punctualityBonus,
      };
    case "late":
      return {
        dbStatus: "present",
        isPunctual: false,
        pointsAwarded: isAttendee ? 0 : basePoints,
      };
    case "excused":
      return {
        dbStatus: "excused",
        isPunctual: false,
        pointsAwarded: 0,
      };
    case "absent":
    default:
      return {
        dbStatus: "absent",
        isPunctual: false,
        pointsAwarded: 0,
      };
  }
}

/**
 * Lazily closes any expired live check-ins for a season so DB state stays consistent
 * without needing an external cron daemon.
 */
export async function closeExpiredSessionsForSeason(
  seasonId: string,
  now: Date = new Date()
): Promise<void> {
  try {
    await db
      .update(schema.branchSessions)
      .set({
        checkinOpen: false,
        checkinCode: null,
      })
      .where(
        and(
          eq(schema.branchSessions.seasonId, seasonId),
          eq(schema.branchSessions.checkinOpen, true),
          sql`COALESCE(${schema.branchSessions.checkinEndsAt}, ${schema.branchSessions.checkinExpiresAt}) < ${now}`
        )
      );
  } catch {
    // Non-fatal lazy cleanup
  }
}

function generate6DigitCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export interface CreateSessionResult {
  ok: boolean;
  error?: string;
  sessionId?: string;
  checkinCode?: string | null;
  checkinExpiresAt?: Date | null;
  checkinOpen?: boolean;
}

export interface CreateSessionInput {
  title: string;
  startsAt: string;
  committeeId?: string | null;
  checkinWindowMinutes?: number;
  punctualityCutoffMinutes?: number;
  basePoints?: number;
  punctualityBonus?: number;
  openCheckinImmediately?: boolean;
  seasonId?: string;
}

export interface AttendanceActor {
  profile: {
    id: string;
    role: MembershipRole;
    committeeId: string | null;
    trackedCommitteeId?: string | null;
    email?: string;
    fullName?: string;
  };
}

export async function createSessionAsActor(
  input: CreateSessionInput,
  actor: AttendanceActor
): Promise<CreateSessionResult> {
  const actorScopeCommitteeId = getOperationalCommitteeScope(actor.profile);
  const targetCommitteeId =
    input.committeeId !== undefined ? input.committeeId : actorScopeCommitteeId;

  const permCtx = {
    id: actor.profile.id,
    email: actor.profile.email ?? "",
    role: actor.profile.role,
    committeeId: actor.profile.committeeId,
    trackedCommitteeId: actor.profile.trackedCommitteeId,
  };

  if (!canManageCommitteeSessions(permCtx, targetCommitteeId ?? null)) {
    return {
      ok: false,
      error:
        "Unauthorized: you do not have permission to create sessions for this scope.",
    };
  }

  const trimmedTitle = input.title?.trim() ?? "";
  if (!trimmedTitle) {
    return { ok: false, error: "Session title is required." };
  }
  if (!isValidDateString(input.startsAt)) {
    return { ok: false, error: "A valid session start date/time is required." };
  }

  try {
    const seasonRes = await resolveActiveSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
    const seasonId = seasonRes.season.id;
    const attDefaults = normalizeSeasonSettings(
      seasonRes.season.settingsJson
    ).attendance;

    const windowMinutes =
      input.checkinWindowMinutes ?? attDefaults.defaultCheckinWindowMinutes;
    const punctualityCutoff =
      input.punctualityCutoffMinutes ?? attDefaults.punctualityCutoffMinutes;
    const basePoints = input.basePoints ?? attDefaults.defaultBasePoints;
    const punctualityBonus =
      input.punctualityBonus ?? attDefaults.defaultPunctualityBonus;

    if (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 720) {
      return { ok: false, error: "Check-in window must be between 1 and 720 minutes." };
    }
    if (!Number.isFinite(punctualityCutoff) || punctualityCutoff < 0 || punctualityCutoff > 240) {
      return { ok: false, error: "Punctuality cutoff must be between 0 and 240 minutes." };
    }
    if (!Number.isInteger(basePoints) || basePoints < 0 || basePoints > 500) {
      return { ok: false, error: "Base points must be an integer between 0 and 500." };
    }
    if (!Number.isInteger(punctualityBonus) || punctualityBonus < 0 || punctualityBonus > 500) {
      return { ok: false, error: "Punctuality bonus must be an integer between 0 and 500." };
    }

    if (targetCommitteeId) {
      const [comm] = await db
        .select({ id: schema.committees.id })
        .from(schema.committees)
        .where(
          and(
            eq(schema.committees.id, targetCommitteeId),
            eq(schema.committees.seasonId, seasonId),
            eq(schema.committees.isActive, true)
          )
        )
        .limit(1);
      if (!comm) {
        return { ok: false, error: "Selected committee does not exist in the active season." };
      }
    }

    const openCheckin = input.openCheckinImmediately ?? false;
    const code = openCheckin ? generate6DigitCode() : null;
    const now = new Date();
    const expiresAt = openCheckin
      ? new Date(now.getTime() + windowMinutes * 60_000)
      : null;

    const [session] = await db
      .insert(schema.branchSessions)
      .values({
        seasonId,
        committeeId: targetCommitteeId || null,
        title: trimmedTitle,
        startsAt: new Date(input.startsAt),
        checkinOpen: openCheckin,
        checkinCode: code,
        checkinStartsAt: openCheckin ? now : null,
        checkinEndsAt: expiresAt,
        checkinExpiresAt: expiresAt,
        punctualityCutoffMinutes: punctualityCutoff,
        basePoints,
        punctualityBonus,
      })
      .returning();

    return {
      ok: true,
      sessionId: session.id,
      checkinCode: session.checkinCode,
      checkinExpiresAt: session.checkinExpiresAt,
      checkinOpen: session.checkinOpen,
    };
  } catch (err: unknown) {
    return { ok: false, error: sanitizeDbError(err, "Failed to create session.") };
  }
}

export async function toggleSessionCheckinAsActor(
  sessionId: string,
  open: boolean,
  windowMinutes: number,
  actor: AttendanceActor
): Promise<CreateSessionResult> {
  if (open && (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 720)) {
    return { ok: false, error: "Check-in window must be between 1 and 720 minutes." };
  }

  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Session not found." };

    const seasonRes = await resolveActiveSeason(session.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you can only manage check-in for your assigned committee.",
      };
    }

    const code = open ? generate6DigitCode() : null;
    const now = new Date();
    const expiresAt = open
      ? new Date(now.getTime() + windowMinutes * 60_000)
      : null;

    const [updated] = await db
      .update(schema.branchSessions)
      .set({
        checkinOpen: open,
        checkinCode: code,
        checkinStartsAt: open ? now : null,
        checkinEndsAt: expiresAt,
        checkinExpiresAt: expiresAt,
      })
      .where(eq(schema.branchSessions.id, sessionId))
      .returning();

    return {
      ok: true,
      checkinOpen: updated.checkinOpen,
      checkinCode: updated.checkinCode,
      checkinExpiresAt: updated.checkinExpiresAt,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update check-in status."),
    };
  }
}

export async function rotateSessionCheckinCodeAsActor(
  sessionId: string,
  _windowMinutes: number,
  actor: AttendanceActor
): Promise<{
  ok: boolean;
  expired?: boolean;
  error?: string;
  checkinCode?: string | null;
  checkinExpiresAt?: Date | null;
}> {
  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Session not found." };

    const seasonRes = await resolveActiveSeason(session.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you cannot rotate check-in codes for this session.",
      };
    }

    const now = new Date();
    if (!isSessionCheckinLive(session, now)) {
      if (session.checkinOpen) {
        await db
          .update(schema.branchSessions)
          .set({ checkinOpen: false, checkinCode: null })
          .where(eq(schema.branchSessions.id, sessionId));
      }
      return {
        ok: false,
        expired: true,
        error: "This check-in window has expired and was automatically closed.",
      };
    }

    // Only rotate the 6-digit code — NEVER extend checkinEndsAt / checkinExpiresAt!
    const code = generate6DigitCode();
    const [updated] = await db
      .update(schema.branchSessions)
      .set({
        checkinCode: code,
      })
      .where(eq(schema.branchSessions.id, sessionId))
      .returning();

    return {
      ok: true,
      checkinCode: updated.checkinCode,
      checkinExpiresAt: updated.checkinEndsAt ?? updated.checkinExpiresAt,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to rotate check-in code."),
    };
  }
}

export async function extendSessionCheckinWindowAsActor(
  sessionId: string,
  extraMinutes: number,
  actor: AttendanceActor
): Promise<CreateSessionResult> {
  if (!Number.isFinite(extraMinutes) || extraMinutes < 1 || extraMinutes > 240) {
    return { ok: false, error: "Extension must be between 1 and 240 minutes." };
  }

  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Session not found." };

    const seasonRes = await resolveActiveSeason(session.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you cannot extend check-in for this session.",
      };
    }

    const now = new Date();
    const currentEnd = session.checkinEndsAt ?? session.checkinExpiresAt;
    const baseTime =
      currentEnd && currentEnd.getTime() > now.getTime()
        ? currentEnd.getTime()
        : now.getTime();
    const nextEnd = new Date(baseTime + extraMinutes * 60_000);
    const code = session.checkinCode ?? generate6DigitCode();

    const [updated] = await db
      .update(schema.branchSessions)
      .set({
        checkinOpen: true,
        checkinCode: code,
        checkinStartsAt: session.checkinStartsAt ?? now,
        checkinEndsAt: nextEnd,
        checkinExpiresAt: nextEnd,
      })
      .where(eq(schema.branchSessions.id, sessionId))
      .returning();

    return {
      ok: true,
      checkinOpen: updated.checkinOpen,
      checkinCode: updated.checkinCode,
      checkinExpiresAt: updated.checkinEndsAt ?? updated.checkinExpiresAt,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to extend check-in window."),
    };
  }
}

export async function getSessionAttendanceRosterAsActor(
  sessionId: string,
  actor: AttendanceActor
): Promise<{
  ok: boolean;
  error?: string;
  roster?: SessionRosterRow[];
}> {
  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Session not found." };

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you can only inspect attendance for your assigned committee.",
      };
    }

    const [rawMembers, dbCommittees, existingRecords] = await Promise.all([
      db
        .select({
          id: schema.rosterMemberships.id,
          personId: schema.rosterMemberships.personId,
          fullName: schema.persons.fullName,
          email: schema.persons.email,
          committeeId: schema.rosterMemberships.committeeId,
          role: schema.rosterMemberships.role,
        })
        .from(schema.rosterMemberships)
        .innerJoin(
          schema.persons,
          eq(schema.rosterMemberships.personId, schema.persons.id)
        )
        .where(
          session.committeeId
            ? and(
                eq(schema.rosterMemberships.seasonId, session.seasonId),
                eq(schema.rosterMemberships.committeeId, session.committeeId),
                eq(schema.rosterMemberships.isActive, true),
                eq(schema.persons.isActive, true),
                ne(schema.rosterMemberships.role, "attendee")
              )
            : and(
                eq(schema.rosterMemberships.seasonId, session.seasonId),
                eq(schema.rosterMemberships.isActive, true),
                eq(schema.persons.isActive, true),
                ne(schema.rosterMemberships.role, "attendee")
              )
        )
        .orderBy(asc(schema.persons.fullName)),
      db
        .select({ id: schema.committees.id, name: schema.committees.name })
        .from(schema.committees)
        .where(eq(schema.committees.seasonId, session.seasonId)),
      db
        .select()
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, session.id)),
    ]);

    const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
    const recordByMembership = new Map(
      existingRecords.map((r) => [r.membershipId, r])
    );

    // Deduplicate branch-wide sessions by personId so each human appears once
    const allowedIds = new Set(
      deduplicateRecipientsByPerson(
        rawMembers.map((m) => ({
          id: m.id,
          personId: m.personId,
          role: m.role as MembershipRole,
        }))
      )
    );
    // Keep any membership that already has an attendance record for this session
    for (const rec of existingRecords) {
      allowedIds.add(rec.membershipId);
    }

    const roster: SessionRosterRow[] = rawMembers
      .filter((m) => allowedIds.has(m.id))
      .map((m) => {
        const rec = recordByMembership.get(m.id);
        let status: SessionAttendanceStatus = "absent";
        if (rec) {
          if (rec.status === "excused") {
            status = "excused";
          } else if (rec.status === "absent") {
            status = "absent";
          } else {
            status = rec.isPunctual ? "on_time" : "late";
          }
        }
        return {
          membershipId: m.id,
          fullName: m.fullName,
          email: m.email,
          committeeName: m.committeeId
            ? commMap.get(m.committeeId) ?? "Unassigned"
            : "Branch-wide",
          role: m.role as MembershipRole,
          status,
          pointsAwarded: rec?.pointsAwarded ?? 0,
          checkedInAt: rec?.checkedInAt ? rec.checkedInAt.toISOString() : null,
          overrideReason: rec?.overrideReason ?? null,
        };
      });

    return { ok: true, roster };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to load session attendance roster."),
    };
  }
}

export async function setSessionMemberAttendanceAsActor(
  input: {
    sessionId: string;
    membershipId: string;
    status: SessionAttendanceStatus;
    overrideReason?: string;
  },
  actor: AttendanceActor
): Promise<{
  ok: boolean;
  error?: string;
  pointsAwarded?: number;
  status?: SessionAttendanceStatus;
}> {
  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, input.sessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Session not found." };

    const seasonRes = await resolveActiveSeason(session.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you can only edit attendance for your assigned committee.",
      };
    }

    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.id, input.membershipId),
          eq(schema.rosterMemberships.seasonId, session.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);
    if (!member) {
      return { ok: false, error: "Active member not found in this season." };
    }

    const isAttendee = member.role === "attendee";
    const monthKey = formatMonthInCairo(session.startsAt);
    if (!isAttendee) {
      const monthGuard = await assertMonthNotPublished(
        session.seasonId,
        monthKey
      );
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
    }

    const { dbStatus, isPunctual, pointsAwarded } =
      computePointsForAttendanceStatus({
        status: input.status,
        basePoints: session.basePoints,
        punctualityBonus: session.punctualityBonus,
        isAttendee,
      });

    const reasonText =
      input.overrideReason?.trim() || "Manual HR attendance update";

    const [record] = await db
      .insert(schema.attendanceRecords)
      .values({
        sessionId: session.id,
        membershipId: member.id,
        checkedInAt: new Date(),
        status: dbStatus,
        isPunctual,
        pointsAwarded,
        overrideReason: reasonText,
      })
      .onConflictDoUpdate({
        target: [
          schema.attendanceRecords.sessionId,
          schema.attendanceRecords.membershipId,
        ],
        set: {
          status: dbStatus,
          isPunctual,
          pointsAwarded,
          overrideReason: reasonText,
        },
      })
      .returning();

    if (!isAttendee) {
      const statusLabel =
        input.status === "on_time"
          ? "On Time"
          : input.status === "late"
            ? "Late"
            : input.status === "excused"
              ? "Excused"
              : "Absent";

      await upsertScoreLedgerEntry(db, {
        seasonId: session.seasonId,
        membershipId: member.id,
        month: monthKey,
        sourceType: "attendance",
        sourceId: record.id,
        postingScope: session.committeeId ? "committee" : "open",
        committeeId: session.committeeId,
        points: pointsAwarded,
        reason: `Attendance: ${session.title} (${statusLabel})`,
        createdBy: actor.profile.id,
      });
    }

    return { ok: true, pointsAwarded, status: input.status };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update attendance status."),
    };
  }
}

export interface CheckinMembershipCandidate {
  id: string;
  role: MembershipRole;
  committeeId: string | null;
}

/**
 * Resolves which active membership of a person should record check-in for a session:
 * - Branch-wide sessions (sessionCommitteeId === null) always stamp the active hat.
 * - Committee sessions stamp the active hat if eligible (same committee, master_admin, or hr_admin);
 *   otherwise fall back to another active hat owned by the same person in that committee
 *   (preferring non-attendee roles if multiple exist).
 */
export function selectCheckinMembershipForSession<
  T extends CheckinMembershipCandidate,
>(input: {
  activeMembership: T;
  allPersonSeasonMemberships: readonly T[];
  sessionCommitteeId: string | null;
}): T | null {
  const { activeMembership, allPersonSeasonMemberships, sessionCommitteeId } =
    input;

  if (sessionCommitteeId === null) {
    return activeMembership;
  }

  if (
    activeMembership.committeeId === sessionCommitteeId ||
    activeMembership.role === "master_admin" ||
    activeMembership.role === "hr_admin"
  ) {
    return activeMembership;
  }

  const matching = allPersonSeasonMemberships.filter(
    (m) => m.committeeId === sessionCommitteeId
  );
  if (matching.length === 0) {
    return null;
  }

  return matching.find((m) => m.role !== "attendee") ?? matching[0];
}

export async function recordMemberCheckin(
  checkinCode: string,
  membershipId: string
): Promise<{
  ok: boolean;
  error?: string;
  pointsAwarded?: number;
  isPunctual?: boolean;
  sessionTitle?: string;
}> {
  const code = checkinCode?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Please enter a valid 6-digit numeric check-in code." };
  }

  try {
    const [sessionRow] = await db
      .select()
      .from(schema.branchSessions)
      .where(
        and(
          eq(schema.branchSessions.checkinCode, code),
          eq(schema.branchSessions.checkinOpen, true)
        )
      )
      .limit(1);

    if (!sessionRow) {
      return {
        ok: false,
        error: "Invalid check-in code or check-in is not currently open.",
      };
    }

    const seasonRes = await resolveActiveSeason(sessionRow.seasonId);
    if (!seasonRes.ok) {
      return { ok: false, error: "This session does not belong to the active season." };
    }

    const now = new Date();
    const start = sessionRow.checkinStartsAt ?? sessionRow.startsAt;
    const end = sessionRow.checkinEndsAt ?? sessionRow.checkinExpiresAt;
    if (start && now.getTime() < start.getTime()) {
      return { ok: false, error: "Check-in has not started yet." };
    }
    if (end && now.getTime() > end.getTime()) {
      return { ok: false, error: "This check-in window has expired." };
    }

    const [activeMembership] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.id, membershipId),
          eq(schema.rosterMemberships.seasonId, sessionRow.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);

    if (!activeMembership) {
      return { ok: false, error: "Active member record not found in this season." };
    }

    const personSeasonMemberships = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.personId, activeMembership.personId),
          eq(schema.rosterMemberships.seasonId, sessionRow.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      );

    const member = selectCheckinMembershipForSession({
      activeMembership: {
        ...activeMembership,
        role: activeMembership.role as MembershipRole,
      },
      allPersonSeasonMemberships: personSeasonMemberships.map((m) => ({
        ...m,
        role: m.role as MembershipRole,
      })),
      sessionCommitteeId: sessionRow.committeeId,
    });

    if (!member) {
      return {
        ok: false,
        error: "This session is exclusive to members of this committee.",
      };
    }

    // Prevent a multi-hat person from double-checking-in to the same session under two hats
    const personMembershipIds = personSeasonMemberships.map((m) => m.id);
    const [existing] = await db
      .select({ id: schema.attendanceRecords.id })
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, sessionRow.id),
          inArray(schema.attendanceRecords.membershipId, personMembershipIds)
        )
      )
      .limit(1);

    if (existing) {
      return { ok: false, error: "You have already checked in to this session." };
    }

    const punctualityCutoff = new Date(
      sessionRow.startsAt.getTime() + sessionRow.punctualityCutoffMinutes * 60_000
    );
    const isPunctual = now.getTime() <= punctualityCutoff.getTime();
    const isAttendee = member.role === "attendee";
    const pointsAwarded = isAttendee
      ? 0
      : sessionRow.basePoints + (isPunctual ? sessionRow.punctualityBonus : 0);

    const monthKey = formatMonthInCairo(sessionRow.startsAt);
    if (!isAttendee) {
      const monthGuard = await assertMonthNotPublished(sessionRow.seasonId, monthKey);
      if (!monthGuard.ok) {
        return { ok: false, error: monthGuard.error };
      }
    }

    const [record] = await db
      .insert(schema.attendanceRecords)
      .values({
        sessionId: sessionRow.id,
        membershipId: member.id,
        checkedInAt: now,
        isPunctual,
        pointsAwarded,
      })
      .returning();

    if (!isAttendee && pointsAwarded > 0) {
      await upsertScoreLedgerEntry(db, {
        seasonId: sessionRow.seasonId,
        membershipId: member.id,
        month: monthKey,
        sourceType: "attendance",
        sourceId: record.id,
        postingScope: sessionRow.committeeId ? "committee" : "open",
        committeeId: sessionRow.committeeId,
        points: pointsAwarded,
        reason: `Attendance: ${sessionRow.title}${isPunctual ? " (Punctual)" : ""}`,
      });
    }

    return {
      ok: true,
      pointsAwarded,
      isPunctual,
      sessionTitle: sessionRow.title,
    };
  } catch (err: unknown) {
    if (getPostgresErrorCode(err) === "23505") {
      return { ok: false, error: "You have already checked in to this session." };
    }
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to record check-in."),
    };
  }
}
