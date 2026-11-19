"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { resetMemberPassword } from "@/services/auth-password.service";
import { hashPassword } from "@/lib/password";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import { canAssignRoles, canAssignHrCommittees } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
}

export interface AddRosterMemberInput {
  fullName: string;
  email: string;
  role: MembershipRole;
  committeeId?: string | null;
  seasonId?: string;
}

export async function addRosterMemberAction(
  input: AddRosterMemberInput,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canAssignRoles(actorRole)) {
    return { ok: false, error: "Unauthorized: only Master Admin can add members to the roster." };
  }

  try {
    const normalizedEmail = normalizeEmail(input.email);
    if (!normalizedEmail || !input.fullName.trim()) {
      return { ok: false, error: "Full name and a valid email address are required." };
    }

    // Resolve active season if not provided
    let seasonId = input.seasonId;
    if (!seasonId) {
      const activeSeasons = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"));
      if (activeSeasons.length === 0) {
        return { ok: false, error: "No active season found to attach roster membership." };
      }
      seasonId = activeSeasons[0].id;
    }

    // Initial password hash for EMBS2026!
    const defaultHash = hashPassword("EMBS2026!");

    const [inserted] = await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId,
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        role: input.role,
        committeeId: input.committeeId || null,
        passwordHash: defaultHash,
        mustChangePassword: true,
        isActive: true,
      })
      .returning();

    safeRevalidatePath("/hr/roster");
    return { ok: true, memberId: inserted.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add member to roster";
    return { ok: false, error: message };
  }
}

export async function removeRosterMemberAction(
  memberId: string,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canAssignRoles(actorRole)) {
    return { ok: false, error: "Unauthorized: only Master Admin can remove members from the roster." };
  }

  try {
    await db
      .delete(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, memberId));

    safeRevalidatePath("/hr/roster");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove member from roster";
    return { ok: false, error: message };
  }
}

export async function resetMemberPasswordAction(memberId: string) {
  try {
    const result = await resetMemberPassword({ memberId });
    safeRevalidatePath("/hr/roster");
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset member password";
    return { ok: false, tempPassword: "", error: message };
  }
}

export async function assignMemberRoleAction(
  memberId: string,
  newRole: MembershipRole,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canAssignRoles(actorRole)) {
    return { ok: false, error: "Unauthorized: only Master Admin can assign roles." };
  }

  try {
    await db
      .update(schema.rosterMemberships)
      .set({ role: newRole })
      .where(eq(schema.rosterMemberships.id, memberId));

    safeRevalidatePath("/hr/roster");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update member role";
    return { ok: false, error: message };
  }
}

export async function assignMemberCommitteeAction(
  memberId: string,
  committeeId: string | null,
  actorRole: MembershipRole = "master_admin"
) {
  if (!canAssignRoles(actorRole) && !canAssignHrCommittees(actorRole)) {
    return { ok: false, error: "Unauthorized: cannot assign committee." };
  }

  try {
    await db
      .update(schema.rosterMemberships)
      .set({ committeeId: committeeId || null })
      .where(eq(schema.rosterMemberships.id, memberId));

    safeRevalidatePath("/hr/roster");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update member committee";
    return { ok: false, error: message };
  }
}
