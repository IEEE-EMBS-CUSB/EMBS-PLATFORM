import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { upsertScoreLedgerEntry } from "@/db/ledger";
import { canAwardBonus, canManageCommitteeSessions } from "@/lib/permissions";
import type { HrActor } from "./helpers";
import {
  assertMonthNotPublished,
  formatMonthInCairo,
  isValidDateString,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

export async function logEventAsActor(
  input: {
    title: string;
    description?: string;
    committeeId?: string | null;
    eventDate: string;
    points: number;
    targetMembershipIds: string[];
  },
  actor: HrActor
): Promise<{ ok: boolean; error?: string; eventId?: string; awarded?: number }> {
  const trimmedTitle = input.title?.trim() ?? "";
  if (!trimmedTitle) {
    return { ok: false, error: "Event title is required." };
  }
  if (!isValidDateString(input.eventDate)) {
    return { ok: false, error: "A valid event date is required." };
  }
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > 500) {
    return { ok: false, error: "Event points must be an integer between 0 and 500." };
  }

  const targetCommitteeId =
    input.committeeId !== undefined
      ? input.committeeId || null
      : actor.profile.committeeId ?? null;

  const permCtx = {
    id: actor.profile.id,
    email: actor.profile.email ?? "",
    role: actor.profile.role,
    committeeId: actor.profile.committeeId,
  };

  if (!canManageCommitteeSessions(permCtx, targetCommitteeId)) {
    return {
      ok: false,
      error: "Unauthorized: you do not have permission to log events for this scope.",
    };
  }

  try {
    const seasonRes = await resolveActiveSeason();
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
    const seasonId = seasonRes.season.id;

    const eventDate = new Date(input.eventDate);
    const monthKey = formatMonthInCairo(eventDate);

    if (input.points > 0) {
      const monthGuard = await assertMonthNotPublished(seasonId, monthKey);
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
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

    // Resolve eligible recipients before inserting the event
    let eligibleMembers: (typeof schema.rosterMemberships.$inferSelect)[] = [];
    if (input.targetMembershipIds.length > 0) {
      eligibleMembers = await db
        .select()
        .from(schema.rosterMemberships)
        .where(
          and(
            inArray(schema.rosterMemberships.id, input.targetMembershipIds),
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.isActive, true),
            ne(schema.rosterMemberships.role, "attendee")
          )
        );
    } else if (targetCommitteeId) {
      eligibleMembers = await db
        .select()
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.committeeId, targetCommitteeId),
            eq(schema.rosterMemberships.isActive, true),
            ne(schema.rosterMemberships.role, "attendee")
          )
        );
    } else {
      // Branch-wide event (only master_admin / hr_admin can reach here with null targetCommitteeId)
      eligibleMembers = await db
        .select()
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.isActive, true),
            ne(schema.rosterMemberships.role, "attendee")
          )
        );
    }

    const authorizedRecipients = eligibleMembers.filter((m) =>
      canAwardBonus(permCtx, m.committeeId)
    );

    const [event] = await db
      .insert(schema.events)
      .values({
        seasonId,
        committeeId: targetCommitteeId,
        title: trimmedTitle,
        description: input.description?.trim() || null,
        eventDate,
        points: input.points,
        createdBy: actor.profile.id,
      })
      .returning();

    let awarded = 0;
    if (input.points > 0) {
      for (const member of authorizedRecipients) {
        await upsertScoreLedgerEntry(db, {
          seasonId,
          membershipId: member.id,
          month: monthKey,
          sourceType: "event",
          sourceId: event.id,
          points: input.points,
          reason: `Event: ${trimmedTitle}`,
          createdBy: actor.profile.id,
        });
        awarded++;
      }
    }

    return { ok: true, eventId: event.id, awarded };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to log event."),
    };
  }
}
