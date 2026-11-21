import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { canGiveFeedback } from "@/lib/permissions";
import type { HrActor } from "./helpers";
import {
  getDirectorTrackCommitteeIds,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

export async function addHrFeedbackAsActor(
  input: {
    membershipId: string;
    content: string;
    isWarning: boolean;
    isPublished?: boolean;
  },
  actor: HrActor
) {
  const trimmedContent = input.content?.trim() ?? "";
  if (!trimmedContent) {
    return { ok: false, error: "Feedback content is required." };
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

    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
    };
    if (!canGiveFeedback(permCtx, member.committeeId)) {
      return {
        ok: false,
        error: "Unauthorized: cannot submit feedback for this member.",
      };
    }

    // Only master_admin, director, and hr_admin can create private HR warnings or internal unpublished notes
    const canCreatePrivateHrNote =
      actor.profile.role === "master_admin" ||
      actor.profile.role === "director" ||
      actor.profile.role === "hr_admin";

    if (input.isWarning && !canCreatePrivateHrNote) {
      return {
        ok: false,
        error: "Unauthorized: only HR Admin, Director, or Master Admin can issue private HR warnings.",
      };
    }

    const isPublished = input.isWarning
      ? false
      : canCreatePrivateHrNote
        ? (input.isPublished ?? true)
        : true;

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

    const [row] = await db
      .insert(schema.hrFeedback)
      .values({
        seasonId: seasonRes.season.id,
        membershipId: member.id,
        content: trimmedContent,
        isPublished,
        isWarning: input.isWarning,
        createdBy: actor.profile.id,
      })
      .returning();

    return { ok: true, id: row.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to save feedback."),
    };
  }
}
