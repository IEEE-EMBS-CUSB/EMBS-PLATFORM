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

export type TaskTargetType = "group" | "specific_person";

export type TaskTargetGroup =
  | "everyone"
  | "all_heads"
  | "all_members"
  | "committee_all"
  | "committee_heads"
  | "committee_members";

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt: string;
  maxPoints?: number;
  targetType: TaskTargetType;
  assignedToMembershipId?: string;
  targetGroup?: TaskTargetGroup;
  targetCommitteeId?: string | null;
  seasonId?: string;
}

export async function createTaskAction(
  input: CreateTaskInput,
  actorRole: MembershipRole = "committee_head",
  actorCommitteeId?: string | null
) {
  // Authorization checks
  if (
    actorRole !== "master_admin" &&
    actorRole !== "director" &&
    actorRole !== "hr_admin" &&
    actorRole !== "committee_head"
  ) {
    return {
      ok: false,
      error: "Unauthorized: your role does not have permission to create or assign tasks.",
    };
  }

  if (!input.title || !input.title.trim()) {
    return { ok: false, error: "Task title is required." };
  }

  try {
    // 1. Resolve active season
    let seasonId = input.seasonId;
    if (!seasonId) {
      const activeSeasons = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.status, "active"));
      if (activeSeasons.length === 0) {
        return { ok: false, error: "No active season found for task assignment." };
      }
      seasonId = activeSeasons[0].id;
    }

    let targetMembershipIds: string[] = [];
    let taskCommitteeId: string | null = null;

    if (input.targetType === "specific_person") {
      if (!input.assignedToMembershipId) {
        return { ok: false, error: "Specific recipient ID is required." };
      }

      const [member] = await db
        .select()
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.id, input.assignedToMembershipId),
            eq(schema.rosterMemberships.seasonId, seasonId)
          )
        );

      if (!member) {
        return { ok: false, error: "Target member not found in active season." };
      }

      // Committee head restriction
      if (
        actorRole === "committee_head" &&
        (!actorCommitteeId || member.committeeId !== actorCommitteeId)
      ) {
        return {
          ok: false,
          error: "Unauthorized: Committee Heads can only assign tasks to their own committee members.",
        };
      }

      targetMembershipIds = [member.id];
      taskCommitteeId = member.committeeId;
    } else if (input.targetType === "group") {
      if (!input.targetGroup) {
        return { ok: false, error: "Target group type is required." };
      }

      // Committee heads cannot assign cross-chapter groups
      if (
        actorRole === "committee_head" &&
        (input.targetGroup === "everyone" ||
          input.targetGroup === "all_heads" ||
          input.targetGroup === "all_members")
      ) {
        return {
          ok: false,
          error: "Unauthorized: Committee Heads cannot assign tasks across all committees.",
        };
      }

      // If committee group, validate committeeId
      if (
        input.targetGroup === "committee_all" ||
        input.targetGroup === "committee_heads" ||
        input.targetGroup === "committee_members"
      ) {
        const commId = input.targetCommitteeId || actorCommitteeId;
        if (!commId) {
          return { ok: false, error: "A committee must be selected for committee-scoped groups." };
        }

        if (actorRole === "committee_head" && actorCommitteeId !== commId) {
          return {
            ok: false,
            error: "Unauthorized: Committee Heads can only assign tasks within their own committee.",
          };
        }

        taskCommitteeId = commId;

        const commMembers = await db
          .select()
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.committeeId, commId),
              eq(schema.rosterMemberships.isActive, true)
            )
          );

        if (input.targetGroup === "committee_heads") {
          targetMembershipIds = commMembers
            .filter((m) => m.role === "committee_head")
            .map((m) => m.id);
        } else if (input.targetGroup === "committee_members") {
          targetMembershipIds = commMembers
            .filter((m) => m.role === "member")
            .map((m) => m.id);
        } else {
          // committee_all
          targetMembershipIds = commMembers.map((m) => m.id);
        }
      } else if (input.targetGroup === "everyone") {
        const allMembers = await db
          .select()
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true)
            )
          );
        targetMembershipIds = allMembers.map((m) => m.id);
      } else if (input.targetGroup === "all_heads") {
        const allHeads = await db
          .select()
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.role, "committee_head"),
              eq(schema.rosterMemberships.isActive, true)
            )
          );
        targetMembershipIds = allHeads.map((m) => m.id);
      } else if (input.targetGroup === "all_members") {
        const allRegular = await db
          .select()
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.role, "member"),
              eq(schema.rosterMemberships.isActive, true)
            )
          );
        targetMembershipIds = allRegular.map((m) => m.id);
      }
    }

    if (targetMembershipIds.length === 0) {
      return { ok: false, error: "No eligible recipients found for this task assignment." };
    }

    // 2. Insert into tasks
    const [task] = await db
      .insert(schema.tasks)
      .values({
        seasonId,
        committeeId: taskCommitteeId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueAt: new Date(input.dueAt),
        maxPoints: input.maxPoints ?? 100,
      })
      .returning();

    // 3. Bulk insert taskSubmissions
    const submissions = targetMembershipIds.map((mId) => ({
      taskId: task.id,
      membershipId: mId,
    }));

    await db.insert(schema.taskSubmissions).values(submissions);

    safeRevalidatePath("/hr/tasks");
    safeRevalidatePath("/member/tasks");

    return {
      ok: true,
      taskId: task.id,
      assignedCount: targetMembershipIds.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create and assign task";
    return { ok: false, error: message };
  }
}
