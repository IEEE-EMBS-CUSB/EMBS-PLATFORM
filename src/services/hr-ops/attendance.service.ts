import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canManageCommitteeSessions } from "@/lib/permissions";
import { normalizeSeasonSettings } from "@/lib/season-settings";
import {
  assertMonthNotPublished,
  formatMonthInCairo,
  getPostgresErrorCode,
  isValidDateString,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

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
    email?: string;
    fullName?: string;
  };
}

export async function createSessionAsActor(
  input: CreateSessionInput,
  actor: AttendanceActor
): Promise<CreateSessionResult> {
  const targetCommitteeId =
    input.committeeId !== undefined ? input.committeeId : actor.profile.committeeId;

  const permCtx = {
    id: actor.profile.id,
    email: actor.profile.email ?? "",
    role: actor.profile.role,
    committeeId: actor.profile.committeeId,
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
  windowMinutes: number,
  actor: AttendanceActor
): Promise<{
  ok: boolean;
  error?: string;
  checkinCode?: string | null;
  checkinExpiresAt?: Date | null;
}> {
  if (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 720) {
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
    };
    if (!canManageCommitteeSessions(permCtx, session.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: you cannot rotate check-in codes for this session.",
      };
    }

    if (!session.checkinOpen) {
      return { ok: false, error: "Session check-in is not currently open." };
    }

    const code = generate6DigitCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowMinutes * 60_000);

    const [updated] = await db
      .update(schema.branchSessions)
      .set({
        checkinCode: code,
        checkinStartsAt: now,
        checkinEndsAt: expiresAt,
        checkinExpiresAt: expiresAt,
      })
      .where(eq(schema.branchSessions.id, sessionId))
      .returning();

    return {
      ok: true,
      checkinCode: updated.checkinCode,
      checkinExpiresAt: updated.checkinExpiresAt,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to rotate check-in code."),
    };
  }
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

    const [member] = await db
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

    if (!member) {
      return { ok: false, error: "Active member record not found in this season." };
    }

    if (
      sessionRow.committeeId !== null &&
      member.committeeId !== sessionRow.committeeId &&
      member.role !== "master_admin" &&
      member.role !== "hr_admin"
    ) {
      return {
        ok: false,
        error: "This session is exclusive to members of this committee.",
      };
    }

    const [existing] = await db
      .select({ id: schema.attendanceRecords.id })
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, sessionRow.id),
          eq(schema.attendanceRecords.membershipId, member.id)
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
      await db.insert(schema.scoreLedger).values({
        seasonId: sessionRow.seasonId,
        membershipId: member.id,
        month: monthKey,
        sourceType: "attendance",
        sourceId: record.id,
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
