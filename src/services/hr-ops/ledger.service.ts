import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  upsertScoreLedgerEntry,
  type LedgerPostingScope,
} from "@/db/ledger";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAwardBonus } from "@/lib/permissions";
import type { HrActor } from "./helpers";
import {
  assertMonthNotPublished,
  getDirectorTrackCommitteeIds,
  isSamePersonOrMembership,
  isValidMonthKey,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

/**
 * Resolves manual ledger posting scope with least privilege:
 * - Only `master_admin` and `hr_admin` can explicitly award org-wide `"open"` points.
 * - Committee-scoped roles (`committee_head`, `hr_member`, track `director`) post to
 *   the recipient's committee board (unless the recipient has no committee, in which case `"open"`).
 */
export function resolveManualLedgerPostingScope(input: {
  actorRole: MembershipRole;
  requestedScope?: LedgerPostingScope;
  memberCommitteeId: string | null;
}): { postingScope: LedgerPostingScope; committeeId: string | null } {
  const canAwardOrgWide =
    input.actorRole === "master_admin" || input.actorRole === "hr_admin";

  if (!input.memberCommitteeId) {
    return { postingScope: "open", committeeId: null };
  }

  if (canAwardOrgWide && input.requestedScope === "open") {
    return { postingScope: "open", committeeId: null };
  }

  return { postingScope: "committee", committeeId: input.memberCommitteeId };
}

export async function addManualLedgerEntryAsActor(
  input: {
    membershipId: string;
    points: number;
    month: string;
    reason: string;
    postingScope?: LedgerPostingScope;
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
      .select({
        id: schema.rosterMemberships.id,
        seasonId: schema.rosterMemberships.seasonId,
        personId: schema.rosterMemberships.personId,
        committeeId: schema.rosterMemberships.committeeId,
        role: schema.rosterMemberships.role,
        isActive: schema.rosterMemberships.isActive,
        personIsActive: schema.persons.isActive,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.rosterMemberships.id, input.membershipId))
      .limit(1);

    if (!member || !member.isActive || !member.personIsActive) {
      return { ok: false, error: "Active member not found." };
    }
    if (member.role === "attendee") {
      return {
        ok: false,
        error: "Attendees do not participate in member score ledgers.",
      };
    }
    if (isSamePersonOrMembership(actor.profile, member)) {
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
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canAwardBonus(permCtx, member.committeeId)) {
      return {
        ok: false,
        error:
          actor.profile.role === "director"
            ? "Unauthorized: Directors have read-only access to the points ledger and cannot edit points."
            : "Unauthorized: cannot award points to this member.",
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

    const resolvedScope = resolveManualLedgerPostingScope({
      actorRole: actor.profile.role,
      requestedScope: input.postingScope,
      memberCommitteeId: member.committeeId,
    });

    const inserted = await upsertScoreLedgerEntry(db, {
      seasonId: seasonRes.season.id,
      membershipId: member.id,
      month: input.month.trim(),
      sourceType: "manual_override",
      sourceId: null,
      postingScope: resolvedScope.postingScope,
      committeeId: resolvedScope.committeeId,
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
