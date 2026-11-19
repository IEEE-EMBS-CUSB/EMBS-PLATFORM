"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (e.g. vitest)
  }
}

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

export async function createSessionAction(
  input: CreateSessionInput,
  actorRole: MembershipRole = "committee_head",
  actorCommitteeId?: string | null
) {
  // Authorization
  if (
    actorRole !== "master_admin" &&
    actorRole !== "hr_admin" &&
    actorRole !== "committee_head"
  ) {
    return {
      ok: false,
      error: "Unauthorized: your role does not have permission to create sessions.",
    };
  }

  const targetCommitteeId = input.committeeId !== undefined ? input.committeeId : actorCommitteeId;

  if (actorRole === "committee_head") {
    if (!targetCommitteeId || targetCommitteeId !== actorCommitteeId) {
      return {
        ok: false,
        error: "Unauthorized: Committee Heads can only create sessions for their own committee.",
      };
    }
  }

  if (!input.title || !input.title.trim()) {
    return { ok: false, error: "Session title is required." };
  }

  try {
    // Resolve active season
    let seasonId = input.seasonId;
    if (!seasonId) {
      const activeSeasons = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"));
      if (activeSeasons.length === 0) {
        return { ok: false, error: "No active season found for session creation." };
      }
      seasonId = activeSeasons[0].id;
    }

    const windowMinutes = input.checkinWindowMinutes ?? 30;
    const openCheckin = input.openCheckinImmediately ?? false;
    const code = openCheckin ? generate6DigitCode() : null;
    const expiresAt = openCheckin
      ? new Date(Date.now() + windowMinutes * 60000)
      : null;

    const [session] = await db
      .insert(schema.branchSessions)
      .values({
        seasonId,
        committeeId: targetCommitteeId || null,
        title: input.title.trim(),
        startsAt: new Date(input.startsAt),
        checkinOpen: openCheckin,
        checkinCode: code,
        checkinExpiresAt: expiresAt,
        punctualityCutoffMinutes: input.punctualityCutoffMinutes ?? 15,
        basePoints: input.basePoints ?? 10,
        punctualityBonus: input.punctualityBonus ?? 5,
      })
      .returning();

    safeRevalidatePath("/hr/attendance");
    safeRevalidatePath("/member/attendance");

    return {
      ok: true,
      sessionId: session.id,
      checkinCode: session.checkinCode,
      checkinExpiresAt: session.checkinExpiresAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return { ok: false, error: message };
  }
}

export async function toggleSessionCheckinAction(
  sessionId: string,
  open: boolean,
  windowMinutes: number = 30,
  actorRole: MembershipRole = "committee_head",
  actorCommitteeId?: string | null
) {
  if (
    actorRole !== "master_admin" &&
    actorRole !== "hr_admin" &&
    actorRole !== "committee_head"
  ) {
    return {
      ok: false,
      error: "Unauthorized: your role cannot toggle check-in sessions.",
    };
  }

  try {
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(eq(schema.branchSessions.id, sessionId));

    if (!session) {
      return { ok: false, error: "Session not found." };
    }

    if (
      actorRole === "committee_head" &&
      session.committeeId !== actorCommitteeId
    ) {
      return {
        ok: false,
        error: "Unauthorized: Committee Heads can only manage sessions for their committee.",
      };
    }

    const code = open ? generate6DigitCode() : null;
    const expiresAt = open
      ? new Date(Date.now() + windowMinutes * 60000)
      : null;

    const [updated] = await db
      .update(schema.branchSessions)
      .set({
        checkinOpen: open,
        checkinCode: code,
        checkinExpiresAt: expiresAt,
      })
      .where(eq(schema.branchSessions.id, sessionId))
      .returning();

    safeRevalidatePath("/hr/attendance");
    safeRevalidatePath("/member/attendance");

    return {
      ok: true,
      checkinOpen: updated.checkinOpen,
      checkinCode: updated.checkinCode,
      checkinExpiresAt: updated.checkinExpiresAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update check-in status";
    return { ok: false, error: message };
  }
}

export async function memberCheckinAction(
  checkinCode: string,
  membershipId: string
) {
  const code = checkinCode.trim();
  if (!code) {
    return { ok: false, error: "Please enter a 6-digit check-in code." };
  }

  try {
    // 1. Find active session matching code
    const [session] = await db
      .select()
      .from(schema.branchSessions)
      .where(
        and(
          eq(schema.branchSessions.checkinCode, code),
          eq(schema.branchSessions.checkinOpen, true)
        )
      );

    if (!session) {
      return {
        ok: false,
        error: "Invalid check-in code or check-in is not currently open.",
      };
    }

    // 2. Validate expiration window
    const now = new Date();
    if (session.checkinExpiresAt && now.getTime() > session.checkinExpiresAt.getTime()) {
      return { ok: false, error: "This check-in window has expired." };
    }

    // 3. Verify member exists and belongs to committee (if scoped)
    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.id, membershipId),
          eq(schema.rosterMemberships.seasonId, session.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      );

    if (!member) {
      return { ok: false, error: "Active member record not found in this season." };
    }

    if (
      session.committeeId !== null &&
      member.committeeId !== session.committeeId &&
      member.role !== "master_admin" &&
      member.role !== "hr_admin"
    ) {
      return {
        ok: false,
        error: "This session is exclusive to members of this committee.",
      };
    }

    // 4. Verify member hasn't already checked in
    const [existing] = await db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, session.id),
          eq(schema.attendanceRecords.membershipId, member.id)
        )
      );

    if (existing) {
      return { ok: false, error: "You have already checked in to this session." };
    }

    // 5. Calculate punctuality & points
    const punctualityCutoff = new Date(
      session.startsAt.getTime() + session.punctualityCutoffMinutes * 60000
    );
    const isPunctual = now.getTime() <= punctualityCutoff.getTime();
    const pointsAwarded =
      session.basePoints + (isPunctual ? session.punctualityBonus : 0);

    // 6. Insert attendance record
    const [record] = await db
      .insert(schema.attendanceRecords)
      .values({
        sessionId: session.id,
        membershipId: member.id,
        checkedInAt: now,
        isPunctual,
        pointsAwarded,
      })
      .returning();

    // 7. Insert deterministic score ledger entry
    await db.insert(schema.scoreLedger).values({
      seasonId: session.seasonId,
      membershipId: member.id,
      month: formatMonth(now),
      sourceType: "attendance",
      sourceId: record.id,
      points: pointsAwarded,
      reason: `Attendance: ${session.title}${isPunctual ? " (Punctual)" : ""}`,
    });

    safeRevalidatePath("/member/attendance");
    safeRevalidatePath("/member");
    safeRevalidatePath("/hr/attendance");

    return {
      ok: true,
      pointsAwarded,
      isPunctual,
      sessionTitle: session.title,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record check-in";
    return { ok: false, error: message };
  }
}
