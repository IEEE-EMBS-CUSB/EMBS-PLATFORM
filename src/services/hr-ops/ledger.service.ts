import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertScoreLedgerEntry } from "@/db/ledger";
import { canAwardBonus } from "@/lib/permissions";
import type { HrActor } from "./helpers";
import {
  assertMonthNotPublished,
  getDirectorTrackCommitteeIds,
  isValidMonthKey,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

export async function addManualLedgerEntryAsActor(
  input: {
    membershipId: string;
    points: number;
    month: string;
    reason: string;
  },
  actor: HrActor
) {
  if (!isValidMonthKey(input.month)) {
    return { ok: false, error: "Invalid month format. Expected YYYY-MM." };
  }
  if (!Number.isInteger(input.points) || input.points === 0 || Math.abs(input.points) > 500) {
    return {
      ok: false,
      error: "Points must be a non-zero integer between -500 and +500.",
    };
  }
  const trimmedReason = input.reason?.trim() ?? "";
  if (!trimmedReason) {
    return { ok: false, error: "A clear reason is required for point adjustments." };
  }

  try {
    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, input.membershipId))
      .limit(1);

    if (!member || !member.isActive) {
      return { ok: false, error: "Active member not found." };
    }
    if (member.role === "attendee") {
      return {
        ok: false,
        error: "Attendees do not participate in member score ledgers.",
      };
    }
    if (actor.profile.id === member.id) {
      return {
        ok: false,
        error: "You cannot award manual bonus points to yourself.",
      };
    }

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
    };
    if (!canAwardBonus(permCtx, member.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: cannot award points to this member.",
      };
    }

    const seasonRes = await resolveActiveSeason(member.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const directorTrackCommitteeIds = await getDirectorTrackCommitteeIds(
      seasonRes.season.id,
      actor.profile.role,
      actor.profile.managedTrackId
    );
    if (
      directorTrackCommitteeIds &&
      (!member.committeeId || !directorTrackCommitteeIds.has(member.committeeId))
    ) {
      return {
        ok: false,
        error:
          "Unauthorized: Track Directors can only award points to members in their assigned committee track.",
      };
    }

    const monthGuard = await assertMonthNotPublished(
      seasonRes.season.id,
      input.month.trim()
    );
    if (!monthGuard.ok) return { ok: false, error: monthGuard.error };

    const inserted = await upsertScoreLedgerEntry(db, {
      seasonId: seasonRes.season.id,
      membershipId: member.id,
      month: input.month.trim(),
      sourceType: "manual_override",
      sourceId: null,
      points: input.points,
      reason: trimmedReason,
      createdBy: actor.profile.id,
    });

    return { ok: true, id: inserted.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to save ledger entry."),
    };
  }
}
