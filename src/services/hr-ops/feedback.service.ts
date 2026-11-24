import { db, withTransaction } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertScoreLedgerEntry } from "@/db/ledger";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canAwardBonus,
  canGiveFeedback,
  canIssueFeedbackWarnings,
  type UserPermissionContext,
} from "@/lib/permissions";
import {
  normalizeSeasonSettings,
  type SeasonFeedbackSettings,
} from "@/lib/season-settings";
import type { HrActor } from "./helpers";
import {
  assertMonthNotPublished,
  formatMonthInCairo,
  getDirectorTrackCommitteeIds,
  isSamePersonOrMembership,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

import {
  FEEDBACK_CATEGORY_META,
  type FeedbackCategory,
  type FeedbackCategoryMeta,
} from "@/lib/feedback-categories";

export { FEEDBACK_CATEGORY_META };
export type { FeedbackCategory, FeedbackCategoryMeta };

export function resolveFeedbackSubmissionPolicy(input: {
  actorRole: MembershipRole;
  category?: FeedbackCategory;
  isWarning?: boolean;
  isPublished?: boolean;
}):
  | {
      ok: true;
      category: FeedbackCategory;
      isPublished: boolean;
      isWarning: boolean;
    }
  | { ok: false; error: string } {
  const canWarnOrHide = canIssueFeedbackWarnings(input.actorRole);

  let category: FeedbackCategory;
  if (input.category) {
    if (!(input.category in FEEDBACK_CATEGORY_META)) {
      return { ok: false, error: "Invalid feedback category." };
    }
    category = input.category;
  } else if (input.isWarning) {
    // Legacy callers passing `{ isWarning: true }` without category default to hidden internal_note
    // unless `isPublished: true` was explicitly requested for a member-visible official warning.
    category = input.isPublished === true ? "warning" : "internal_note";
  } else if (input.isPublished === false) {
    category = "internal_note";
  } else {
    category = "recognition";
  }

  if (
    (category === "warning" || category === "internal_note") &&
    !canWarnOrHide
  ) {
    return {
      ok: false,
      error:
        "Unauthorized: only HR, Directors, or Master Admin can issue official warnings or log hidden HR notes.",
    };
  }

  if (category === "internal_note") {
    return {
      ok: true,
      category: "internal_note",
      isPublished: false,
      isWarning: Boolean(input.isWarning),
    };
  }

  if (category === "warning") {
    return {
      ok: true,
      category: "warning",
      isPublished: true,
      isWarning: true,
    };
  }

  return {
    ok: true,
    category,
    isPublished: true,
    isWarning: false,
  };
}

export function validateFeedbackPointsDelta(input: {
  pointsDelta: number;
  actor: UserPermissionContext;
  targetCommitteeId: string | null;
  targetRole: MembershipRole;
  caps: SeasonFeedbackSettings;
}): { ok: true } | { ok: false; error: string } {
  const { pointsDelta, actor, targetCommitteeId, targetRole, caps } = input;

  if (!Number.isInteger(pointsDelta)) {
    return {
      ok: false,
      error: "Feedback bonus/deduction must be a whole number.",
    };
  }

  if (pointsDelta === 0) {
    return { ok: true };
  }

  if (targetRole === "attendee") {
    return {
      ok: false,
      error: "Attendees do not participate in member score ledgers.",
    };
  }

  if (!canAwardBonus(actor, targetCommitteeId, targetRole)) {
    return {
      ok: false,
      error:
        actor.role === "director"
          ? "Unauthorized: Directors cannot modify member points."
          : actor.role === "hr_member" && targetRole !== "member"
            ? "Unauthorized: HR members cannot award or deduct points for committee heads or leadership."
            : "Unauthorized: you do not have permission to award or deduct points for this member.",
    };
  }

  if (pointsDelta > caps.maxBonusPoints) {
    return {
      ok: false,
      error: `Feedback bonus cannot exceed the season cap of +${caps.maxBonusPoints} pts.`,
    };
  }

  if (pointsDelta < -caps.maxDeductionPoints) {
    return {
      ok: false,
      error: `Feedback deduction cannot exceed the season cap of -${caps.maxDeductionPoints} pts.`,
    };
  }

  return { ok: true };
}

export interface AddHrFeedbackInput {
  membershipId: string;
  content: string;
  category?: FeedbackCategory;
  pointsDelta?: number;
  isWarning?: boolean;
  isPublished?: boolean;
}

export async function addHrFeedbackAsActor(
  input: AddHrFeedbackInput,
  actor: HrActor
) {
  const trimmedContent = input.content?.trim() ?? "";
  if (!trimmedContent) {
    return { ok: false, error: "Feedback content is required." };
  }

  const pointsDelta = input.pointsDelta ?? 0;

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

    if (isSamePersonOrMembership(actor.profile, member)) {
      return {
        ok: false,
        error: "You cannot submit feedback or warnings about yourself.",
      };
    }

    const permCtx: UserPermissionContext = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canGiveFeedback(permCtx, member.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: cannot submit feedback for this member.",
      };
    }

    const policy = resolveFeedbackSubmissionPolicy({
      actorRole: actor.profile.role,
      category: input.category,
      isWarning: input.isWarning,
      isPublished: input.isPublished,
    });
    if (!policy.ok) {
      return { ok: false, error: policy.error };
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
          "Unauthorized: Track Directors can only submit feedback for members in their assigned committee track.",
      };
    }

    const seasonSettings = normalizeSeasonSettings(
      seasonRes.season.settingsJson
    );
    const pointsCheck = validateFeedbackPointsDelta({
      pointsDelta,
      actor: permCtx,
      targetCommitteeId: member.committeeId,
      targetRole: member.role as MembershipRole,
      caps: seasonSettings.feedback,
    });
    if (!pointsCheck.ok) {
      return { ok: false, error: pointsCheck.error };
    }

    const monthKey = formatMonthInCairo(new Date());
    if (pointsDelta !== 0) {
      const monthGuard = await assertMonthNotPublished(
        seasonRes.season.id,
        monthKey
      );
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
    }

    const row = await withTransaction(async (tx) => {
      const [inserted] = await tx
        .insert(schema.hrFeedback)
        .values({
          seasonId: seasonRes.season.id,
          membershipId: member.id,
          content: trimmedContent,
          category: policy.category,
          pointsDelta,
          isPublished: policy.isPublished,
          isWarning: policy.isWarning,
          createdBy: actor.profile.id,
        })
        .returning();

      if (pointsDelta !== 0) {
        const metaLabel = FEEDBACK_CATEGORY_META[policy.category].label;
        const excerpt =
          trimmedContent.length > 80
            ? `${trimmedContent.slice(0, 77)}...`
            : trimmedContent;
        await upsertScoreLedgerEntry(tx, {
          seasonId: seasonRes.season.id,
          membershipId: member.id,
          month: monthKey,
          sourceType: "manual_override",
          sourceId: null,
          postingScope: member.committeeId ? "committee" : "open",
          committeeId: member.committeeId,
          points: pointsDelta,
          reason: `${metaLabel}: ${excerpt}`,
          createdBy: actor.profile.id,
        });
      }

      return inserted;
    });

    return {
      ok: true,
      id: row.id,
      category: policy.category,
      isPublished: policy.isPublished,
      isWarning: policy.isWarning,
      pointsDelta,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to save feedback."),
    };
  }
}
