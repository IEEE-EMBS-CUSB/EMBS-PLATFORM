import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canAssignTask,
  canCreateWorkType,
  canManageCommitteeTasks,
  getDefaultWorkTypeForRole,
  type WorkItemType,
} from "@/lib/permissions";
import { upsertScoreLedgerEntry } from "@/db/ledger";
import {
  calculateRubricPoints,
  normalizeSeasonSettings,
} from "@/lib/season-settings";
import {
  assertMonthNotPublished,
  formatMonthInCairo,
  getDirectorTrackCommitteeIds,
  isValidDateString,
  isValidHttpUrl,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

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
  workType?: WorkItemType;
  targetType: TaskTargetType;
  assignedToMembershipId?: string;
  targetGroup?: TaskTargetGroup;
  targetCommitteeId?: string | null;
  seasonId?: string;
}

export interface TaskActor {
  profile: {
    id: string;
    role: MembershipRole;
    committeeId: string | null;
    managedTrackId?: string | null;
    email?: string;
    fullName?: string;
  };
}

export async function createTaskAsActor(input: CreateTaskInput, actor: TaskActor) {
  const actorRole = actor.profile.role;
  const actorCommitteeId = actor.profile.committeeId;

  if (
    actorRole !== "master_admin" &&
    actorRole !== "director" &&
    actorRole !== "hr_admin" &&
    actorRole !== "hr_member" &&
    actorRole !== "committee_head"
  ) {
    return {
      ok: false,
      error:
        "Unauthorized: your role does not have permission to create or assign work items.",
    };
  }

  const workType: WorkItemType =
    input.workType ?? getDefaultWorkTypeForRole(actorRole);

  if (workType !== "assignment" && workType !== "task") {
    return { ok: false, error: "Invalid work item type." };
  }

  if (!canCreateWorkType(actorRole, workType)) {
    const allowedLabel =
      actorRole === "hr_member" ? "tasks" : "assignments";
    return {
      ok: false,
      error: `Unauthorized: your role can only create ${allowedLabel}. Only Master Admin and HR Admin can create both assignments and tasks.`,
    };
  }

  const isCommitteeScopedCreator =
    actorRole === "committee_head" || actorRole === "hr_member";

  const trimmedTitle = input.title?.trim() ?? "";
  if (!trimmedTitle) {
    return { ok: false, error: "Task title is required." };
  }
  if (!isValidDateString(input.dueAt)) {
    return { ok: false, error: "A valid due date is required." };
  }
  const maxPoints = input.maxPoints ?? 100;
  if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > 1000) {
    return { ok: false, error: "Max points must be an integer between 1 and 1000." };
  }

  try {
    const seasonRes = await resolveActiveSeason(input.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
    const seasonId = seasonRes.season.id;
    const directorTrackCommitteeIds = await getDirectorTrackCommitteeIds(
      seasonId,
      actorRole,
      actor.profile.managedTrackId
    );

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
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.isActive, true)
          )
        )
        .limit(1);

      if (!member) {
        return { ok: false, error: "Target active member not found in active season." };
      }

      const allowed = canAssignTask(
        {
          id: actor.profile.id,
          email: actor.profile.email ?? "",
          role: actorRole,
          committeeId: actorCommitteeId,
        },
        {
          id: member.id,
          email: member.email,
          role: member.role as MembershipRole,
          committeeId: member.committeeId,
        }
      );

      if (!allowed) {
        return {
          ok: false,
          error:
            "Unauthorized: your role cannot assign tasks to this recipient.",
        };
      }

      if (
        directorTrackCommitteeIds &&
        (!member.committeeId || !directorTrackCommitteeIds.has(member.committeeId))
      ) {
        return {
          ok: false,
          error:
            "Unauthorized: Track Directors can only assign to heads within their assigned committee track.",
        };
      }

      targetMembershipIds = [member.id];
      taskCommitteeId = member.committeeId;
    } else if (input.targetType === "group") {
      if (!input.targetGroup) {
        return { ok: false, error: "Target group type is required." };
      }

      // Role-level group broadcast restrictions
      if (
        isCommitteeScopedCreator &&
        (input.targetGroup === "everyone" ||
          input.targetGroup === "all_heads" ||
          input.targetGroup === "all_members")
      ) {
        return {
          ok: false,
          error:
            "Unauthorized: committee-scoped roles cannot assign items across all committees.",
        };
      }

      if (isCommitteeScopedCreator && input.targetGroup !== "committee_members") {
        return {
          ok: false,
          error:
            "Unauthorized: you can only assign group items to members of your own committee.",
        };
      }

      if (actorRole === "director" && input.targetGroup !== "all_heads" && input.targetGroup !== "committee_heads") {
        return {
          ok: false,
          error:
            "Unauthorized: Directors can only broadcast group assignments to Committee Heads.",
        };
      }

      if (
        actorRole === "hr_admin" &&
        (input.targetGroup === "everyone" ||
          input.targetGroup === "all_heads" ||
          input.targetGroup === "committee_heads")
      ) {
        return {
          ok: false,
          error:
            "Unauthorized: HR Admin cannot broadcast to executive leadership or committee heads.",
        };
      }

      if (
        input.targetGroup === "committee_all" ||
        input.targetGroup === "committee_heads" ||
        input.targetGroup === "committee_members"
      ) {
        const commId = input.targetCommitteeId || actorCommitteeId;
        if (!commId) {
          return {
            ok: false,
            error: "A committee must be selected for committee-scoped groups.",
          };
        }

        if (isCommitteeScopedCreator && actorCommitteeId !== commId) {
          return {
            ok: false,
            error:
              "Unauthorized: you can only assign items within your own committee.",
          };
        }

        if (directorTrackCommitteeIds && !directorTrackCommitteeIds.has(commId)) {
          return {
            ok: false,
            error:
              "Unauthorized: Track Directors can only assign to committees within their assigned track.",
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
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
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
          targetMembershipIds = commMembers.map((m) => m.id);
        }
      } else if (input.targetGroup === "everyone") {
        const allMembers = await db
          .select()
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
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
        const scopedHeads = directorTrackCommitteeIds
          ? allHeads.filter(
              (h) => h.committeeId && directorTrackCommitteeIds.has(h.committeeId)
            )
          : allHeads;
        targetMembershipIds = scopedHeads.map((m) => m.id);
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
      return {
        ok: false,
        error: "No eligible recipients found for this task assignment.",
      };
    }

    const [task] = await db
      .insert(schema.tasks)
      .values({
        seasonId,
        committeeId: taskCommitteeId,
        title: trimmedTitle,
        description: input.description?.trim() || null,
        dueAt: new Date(input.dueAt),
        maxPoints,
        workType,
        targetType: input.targetType ?? null,
        targetGroup: input.targetGroup ?? null,
      })
      .returning();

    const submissions = targetMembershipIds.map((mId) => ({
      taskId: task.id,
      membershipId: mId,
    }));

    await db.insert(schema.taskSubmissions).values(submissions);

    return {
      ok: true,
      taskId: task.id,
      assignedCount: targetMembershipIds.length,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to create and assign task."),
    };
  }
}

export async function gradeTaskSubmissionAsActor(
  input: {
    submissionId: string;
    effortScore: number;
    qualityScore: number;
    timelinessScore: number;
    notes?: string;
  },
  actor: TaskActor
) {
  const scores = [input.effortScore, input.qualityScore, input.timelinessScore];
  if (scores.some((s) => !Number.isInteger(s) || s < 1 || s > 5)) {
    return {
      ok: false,
      error: "Effort, quality, and timeliness scores must be integers between 1 and 5.",
    };
  }

  try {
    const [submission] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(eq(schema.taskSubmissions.id, input.submissionId))
      .limit(1);
    if (!submission) return { ok: false, error: "Submission not found." };

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, submission.taskId))
      .limit(1);
    if (!task) return { ok: false, error: "Task not found." };

    const seasonRes = await resolveActiveSeason(task.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, submission.membershipId))
      .limit(1);
    if (!member) return { ok: false, error: "Assignee record not found." };

    const scopeCommitteeId = task.committeeId ?? member.committeeId;
    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: actor.profile.committeeId,
    };
    if (!canManageCommitteeTasks(permCtx, scopeCommitteeId)) {
      return {
        ok: false,
        error: "Unauthorized: you can only grade tasks for your assigned committee.",
      };
    }

    const directorTrackCommitteeIds = await getDirectorTrackCommitteeIds(
      task.seasonId,
      actor.profile.role,
      actor.profile.managedTrackId
    );
    if (
      directorTrackCommitteeIds &&
      (!scopeCommitteeId || !directorTrackCommitteeIds.has(scopeCommitteeId))
    ) {
      return {
        ok: false,
        error:
          "Unauthorized: Track Directors can only grade deliverables within their assigned track.",
      };
    }

    const monthKey = formatMonthInCairo(
      submission.gradedAt ?? task.dueAt ?? new Date()
    );
    if (member.role !== "attendee") {
      const monthGuard = await assertMonthNotPublished(task.seasonId, monthKey);
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
    }

    const seasonSettings = normalizeSeasonSettings(seasonRes.season.settingsJson);
    const totalPoints = calculateRubricPoints({
      effortScore: input.effortScore,
      qualityScore: input.qualityScore,
      timelinessScore: input.timelinessScore,
      maxPoints: task.maxPoints,
      grading: seasonSettings.grading,
    });

    await db
      .update(schema.taskSubmissions)
      .set({
        effortScore: input.effortScore,
        qualityScore: input.qualityScore,
        timelinessScore: input.timelinessScore,
        totalPoints,
        notes: input.notes?.trim() || null,
        gradedBy: actor.profile.id,
        gradedAt: submission.gradedAt ?? new Date(),
      })
      .where(eq(schema.taskSubmissions.id, input.submissionId));

    if (member.role !== "attendee") {
      const workLabel = task.workType === "task" ? "Task" : "Assignment";
      await upsertScoreLedgerEntry(db, {
        seasonId: task.seasonId,
        membershipId: submission.membershipId,
        month: monthKey,
        sourceType: "task",
        sourceId: submission.id,
        points: totalPoints,
        reason: `${workLabel}: ${task.title}`,
        createdBy: actor.profile.id,
      });
    }

    return { ok: true, totalPoints };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to save grade."),
    };
  }
}

export async function submitMemberTask(
  input: { taskId: string; submissionText?: string; submissionUrl?: string },
  membershipId: string
) {
  const text = input.submissionText?.trim() || null;
  const url = input.submissionUrl?.trim() || null;

  if (!text && !url) {
    return {
      ok: false,
      error: "Please provide a submission summary or a deliverable link.",
    };
  }
  if (url && !isValidHttpUrl(url)) {
    return {
      ok: false,
      error: "Submission link must be a valid http:// or https:// URL.",
    };
  }

  try {
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, input.taskId))
      .limit(1);
    if (!task) return { ok: false, error: "Task not found." };

    const seasonRes = await resolveActiveSeason(task.seasonId);
    if (!seasonRes.ok) {
      return { ok: false, error: "Submissions are closed for archived or draft seasons." };
    }

    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.id, membershipId),
          eq(schema.rosterMemberships.seasonId, task.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);
    if (!member) {
      return { ok: false, error: "You are not an active member of this task's season." };
    }

    const [existing] = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, input.taskId),
          eq(schema.taskSubmissions.membershipId, membershipId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.gradedAt) {
        return {
          ok: false,
          error: "This deliverable has already been graded and can no longer be edited.",
        };
      }
      await db
        .update(schema.taskSubmissions)
        .set({
          submissionText: text,
          submissionUrl: url,
          submittedAt: new Date(),
        })
        .where(eq(schema.taskSubmissions.id, existing.id));
    } else {
      // Only allow creating a submission if the task is branch-wide or belongs to the member's committee
      if (task.committeeId !== null && task.committeeId !== member.committeeId) {
        return {
          ok: false,
          error: "Unauthorized: this task is not assigned to you or your committee.",
        };
      }
      await db.insert(schema.taskSubmissions).values({
        taskId: input.taskId,
        membershipId,
        submissionText: text,
        submissionUrl: url,
        submittedAt: new Date(),
      });
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to submit deliverable."),
    };
  }
}
