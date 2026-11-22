import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canAssignTask,
  canCreateWorkType,
  canManageWorkItem,
  getDefaultWorkTypeForRole,
  getOperationalCommitteeScope,
  type WorkItemType,
} from "@/lib/permissions";
import {
  upsertScoreLedgerEntry,
  type LedgerPostingScope,
} from "@/db/ledger";
import {
  calculateRubricPoints,
  normalizeSeasonSettings,
  type TaskCompletionMode,
} from "@/lib/season-settings";
import { ensureHrCommitteeForSeason } from "./committees.service";
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
  | "all_hr_members"
  | "committee_all"
  | "committee_heads"
  | "committee_members";

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt: string;
  maxPoints?: number;
  workType?: WorkItemType;
  completionMode?: TaskCompletionMode;
  targetType: TaskTargetType;
  assignedToMembershipId?: string;
  targetGroup?: TaskTargetGroup;
  targetCommitteeId?: string | null;
  seasonId?: string;
}

/**
 * Pure check for whether a member is allowed to self-check a work item on their portal.
 * Only tasks explicitly configured with `completionMode === "self_report"` are self-checkable.
 */
export function isTaskSelfReportable(task: {
  workType: string;
  completionMode?: string | null;
}): boolean {
  if (task.workType !== "task") return false;
  return (task.completionMode ?? "self_report") === "self_report";
}

/**
 * Pure role + workType + group-target policy validation for task/assignment broadcasting.
 */
export function validateTaskGroupPermission(
  actorRole: MembershipRole,
  workType: WorkItemType,
  targetGroup: TaskTargetGroup
): { ok: true } | { ok: false; error: string } {
  if (!canCreateWorkType(actorRole, workType)) {
    const allowedLabel = actorRole === "hr_member" ? "tasks" : "assignments";
    return {
      ok: false,
      error: `Unauthorized: your role can only create ${allowedLabel}.`,
    };
  }

  if (actorRole === "master_admin") {
    return { ok: true };
  }

  if (actorRole === "director") {
    if (targetGroup === "all_hr_members") {
      return {
        ok: false,
        error: "Unauthorized: Directors cannot broadcast directly to all HR members.",
      };
    }
    return { ok: true };
  }

  if (actorRole === "hr_admin") {
    if (workType === "assignment") {
      if (targetGroup !== "all_hr_members") {
        return {
          ok: false,
          error:
            "Unauthorized: HR Admin can only issue Assignments to their own committee (Human Resources).",
        };
      }
      return { ok: true };
    }
    // HR Admin can issue Tasks to everyone, including heads-only groups
    return { ok: true };
  }

  if (actorRole === "committee_head" || actorRole === "hr_member") {
    if (targetGroup !== "committee_members") {
      return {
        ok: false,
        error:
          "Unauthorized: you can only assign group items to members of your operational committee.",
      };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unauthorized." };
}

export interface TaskActor {
  profile: {
    id: string;
    role: MembershipRole;
    committeeId: string | null;
    trackedCommitteeId?: string | null;
    managedTrackId?: string | null;
    email?: string;
    fullName?: string;
  };
}

const BROADCAST_ROLE_PRIORITY: Record<MembershipRole, number> = {
  committee_head: 1,
  hr_member: 2,
  member: 3,
  director: 4,
  hr_admin: 5,
  master_admin: 6,
  attendee: 7,
};

/**
 * Deduplicates global broadcast recipients by personId so a multi-hat member
 * receives and earns a global work item at most once.
 */
export function deduplicateRecipientsByPerson(
  memberships: readonly {
    id: string;
    personId: string;
    role: MembershipRole;
  }[]
): string[] {
  const bestByPerson = new Map<
    string,
    { id: string; personId: string; role: MembershipRole }
  >();

  for (const m of memberships) {
    const existing = bestByPerson.get(m.personId);
    if (!existing) {
      bestByPerson.set(m.personId, m);
      continue;
    }
    const curRank = BROADCAST_ROLE_PRIORITY[m.role] ?? 99;
    const prevRank = BROADCAST_ROLE_PRIORITY[existing.role] ?? 99;
    if (
      curRank < prevRank ||
      (curRank === prevRank && m.id.localeCompare(existing.id) < 0)
    ) {
      bestByPerson.set(m.personId, m);
    }
  }

  return Array.from(bestByPerson.values()).map((m) => m.id);
}

export function resolveLedgerSourceTypeForWorkItem(
  workType: string
): "task" | "assignment" {
  return workType === "task" ? "task" : "assignment";
}

export function resolveLedgerPostingScopeForWorkItem(
  taskCommitteeId: string | null
): { postingScope: LedgerPostingScope; committeeId: string | null } {
  return taskCommitteeId
    ? { postingScope: "committee", committeeId: taskCommitteeId }
    : { postingScope: "open", committeeId: null };
}

export function validateDeliverableSubmission(input: {
  workType: string;
  submissionText?: string;
  submissionUrl?: string;
}):
  | { ok: true; url: string; text: string | null }
  | { ok: false; error: string } {
  if (input.workType === "task") {
    return {
      ok: false,
      error:
        "Tasks are completed directly by checking them off rather than submitting a link.",
    };
  }

  const url = input.submissionUrl?.trim() || null;
  const text = input.submissionText?.trim() || null;

  if (!url || !isValidHttpUrl(url)) {
    return {
      ok: false,
      error:
        "Assignments require a valid http:// or https:// deliverable link.",
    };
  }

  return { ok: true, url, text };
}

export async function createTaskAsActor(input: CreateTaskInput, actor: TaskActor) {
  const actorRole = actor.profile.role;
  const actorCommitteeId = getOperationalCommitteeScope(actor.profile);

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
    const seasonSettings = normalizeSeasonSettings(seasonRes.season.settingsJson);
    const completionMode: TaskCompletionMode =
      workType === "task"
        ? input.completionMode === "hr_only" || input.completionMode === "self_report"
          ? input.completionMode
          : seasonSettings.tasks.defaultCompletionMode
        : "self_report";
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
        .select({
          id: schema.rosterMemberships.id,
          personId: schema.rosterMemberships.personId,
          email: schema.persons.email,
          role: schema.rosterMemberships.role,
          committeeId: schema.rosterMemberships.committeeId,
        })
        .from(schema.rosterMemberships)
        .innerJoin(
          schema.persons,
          eq(schema.rosterMemberships.personId, schema.persons.id)
        )
        .where(
          and(
            eq(schema.rosterMemberships.id, input.assignedToMembershipId),
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.isActive, true),
            eq(schema.persons.isActive, true)
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
          committeeId: actor.profile.committeeId,
          trackedCommitteeId: actor.profile.trackedCommitteeId,
        },
        {
          id: member.id,
          email: member.email,
          role: member.role as MembershipRole,
          committeeId: member.committeeId,
        },
        workType
      );

      if (!allowed) {
        return {
          ok: false,
          error:
            actorRole === "hr_admin" && workType === "assignment"
              ? "Unauthorized: HR Admin can only give Assignments to HR committee members."
              : "Unauthorized: your role cannot assign this work item to this recipient.",
        };
      }

      if (
        directorTrackCommitteeIds &&
        (!member.committeeId || !directorTrackCommitteeIds.has(member.committeeId))
      ) {
        return {
          ok: false,
          error:
            "Unauthorized: Track Directors can only assign within their assigned committee track.",
        };
      }

      targetMembershipIds = [member.id];
      taskCommitteeId = member.committeeId;
    } else if (input.targetType === "group") {
      if (!input.targetGroup) {
        return { ok: false, error: "Target group type is required." };
      }

      const groupPerm = validateTaskGroupPermission(
        actorRole,
        workType,
        input.targetGroup
      );
      if (!groupPerm.ok) {
        return { ok: false, error: groupPerm.error };
      }

      if (input.targetGroup === "all_hr_members") {
        const hrComm = await ensureHrCommitteeForSeason(seasonId);
        taskCommitteeId = hrComm.id;
        const hrMembers = await db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            role: schema.rosterMemberships.role,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.role, "hr_member"),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true)
            )
          );
        targetMembershipIds = deduplicateRecipientsByPerson(
          hrMembers.map((m) => ({
            id: m.id,
            personId: m.personId,
            role: m.role as MembershipRole,
          }))
        );
      } else if (
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
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            role: schema.rosterMemberships.role,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.committeeId, commId),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            )
          );

        const filteredComm =
          input.targetGroup === "committee_heads"
            ? commMembers.filter((m) => m.role === "committee_head")
            : input.targetGroup === "committee_members"
              ? commMembers.filter((m) => m.role === "member")
              : commMembers;

        targetMembershipIds = deduplicateRecipientsByPerson(
          filteredComm.map((m) => ({
            id: m.id,
            personId: m.personId,
            role: m.role as MembershipRole,
          }))
        );
      } else if (input.targetGroup === "everyone") {
        const allMembers = await db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            role: schema.rosterMemberships.role,
            committeeId: schema.rosterMemberships.committeeId,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            )
          );
        const scopedAll = directorTrackCommitteeIds
          ? allMembers.filter(
              (m) =>
                m.committeeId !== null &&
                directorTrackCommitteeIds.has(m.committeeId)
            )
          : allMembers;
        targetMembershipIds = deduplicateRecipientsByPerson(
          scopedAll.map((m) => ({
            id: m.id,
            personId: m.personId,
            role: m.role as MembershipRole,
          }))
        );
      } else if (input.targetGroup === "all_heads") {
        const allHeads = await db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            role: schema.rosterMemberships.role,
            committeeId: schema.rosterMemberships.committeeId,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.role, "committee_head"),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true)
            )
          );
        const scopedHeads = directorTrackCommitteeIds
          ? allHeads.filter(
              (h) => h.committeeId && directorTrackCommitteeIds.has(h.committeeId)
            )
          : allHeads;
        targetMembershipIds = deduplicateRecipientsByPerson(
          scopedHeads.map((m) => ({
            id: m.id,
            personId: m.personId,
            role: m.role as MembershipRole,
          }))
        );
      } else if (input.targetGroup === "all_members") {
        const allRegular = await db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            role: schema.rosterMemberships.role,
            committeeId: schema.rosterMemberships.committeeId,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.role, "member"),
              eq(schema.rosterMemberships.isActive, true),
              eq(schema.persons.isActive, true)
            )
          );
        const scopedRegular = directorTrackCommitteeIds
          ? allRegular.filter(
              (m) =>
                m.committeeId !== null &&
                directorTrackCommitteeIds.has(m.committeeId)
            )
          : allRegular;
        targetMembershipIds = deduplicateRecipientsByPerson(
          scopedRegular.map((m) => ({
            id: m.id,
            personId: m.personId,
            role: m.role as MembershipRole,
          }))
        );
      }
    }

    if (targetMembershipIds.length === 0) {
      return {
        ok: false,
        error: "No eligible recipients found for this task assignment.",
      };
    }

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedCreatedBy: string | null = null;
    if (actor.profile.id && UUID_RE.test(actor.profile.id)) {
      const [creatorRow] = await db
        .select({ id: schema.rosterMemberships.id })
        .from(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, actor.profile.id))
        .limit(1);
      if (creatorRow) {
        resolvedCreatedBy = creatorRow.id;
      }
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
        completionMode,
        targetType: input.targetType ?? null,
        targetGroup: input.targetGroup ?? null,
        createdBy: resolvedCreatedBy,
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
    if (task.workType === "task") {
      return {
        ok: false,
        error:
          "Tasks are completed via checklist rather than rubric grading.",
      };
    }

    const seasonRes = await resolveActiveSeason(task.seasonId);
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };

    const [member] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, submission.membershipId))
      .limit(1);
    if (!member) return { ok: false, error: "Assignee record not found." };

    const scopeCommitteeId = task.committeeId ?? member.committeeId;
    let effectiveActorCommitteeId = actor.profile.committeeId;
    if (actor.profile.role === "hr_admin" && !effectiveActorCommitteeId) {
      const hrComm = await ensureHrCommitteeForSeason(task.seasonId);
      effectiveActorCommitteeId = hrComm.id;
    }
    const permCtx = {
      id: actor.profile.id,
      email: actor.profile.email ?? "",
      role: actor.profile.role,
      committeeId: effectiveActorCommitteeId,
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageWorkItem(permCtx, "assignment", scopeCommitteeId)) {
      return {
        ok: false,
        error:
          actor.profile.role === "hr_admin"
            ? "Unauthorized: HR Admin can only grade Assignments for the HR committee."
            : "Unauthorized: you can only grade assignments for your assigned scope.",
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
      const sourceType = resolveLedgerSourceTypeForWorkItem(task.workType);
      const scope = resolveLedgerPostingScopeForWorkItem(task.committeeId);
      await upsertScoreLedgerEntry(db, {
        seasonId: task.seasonId,
        membershipId: submission.membershipId,
        month: monthKey,
        sourceType,
        sourceId: submission.id,
        postingScope: scope.postingScope,
        committeeId: scope.committeeId,
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

export async function toggleTaskCompletionAsActor(
  input: { submissionId: string; completed: boolean },
  actor: TaskActor
) {
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

    if (task.workType !== "task") {
      return {
        ok: false,
        error:
          "Assignments must be graded with the rubric rather than checked off.",
      };
    }

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
      trackedCommitteeId: actor.profile.trackedCommitteeId,
    };
    if (!canManageWorkItem(permCtx, "task", scopeCommitteeId)) {
      return {
        ok: false,
        error:
          actor.profile.role === "director"
            ? "Unauthorized: tasks remain HR's responsibility and cannot be graded or checked off by Directors."
            : "Unauthorized: you can only manage HR tasks for your assigned scope.",
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
          "Unauthorized: Track Directors can only manage deliverables within their assigned track.",
      };
    }

    const monthKey = formatMonthInCairo(
      submission.gradedAt ?? task.dueAt ?? new Date()
    );
    if (member.role !== "attendee") {
      const monthGuard = await assertMonthNotPublished(task.seasonId, monthKey);
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
    }

    const now = new Date();
    const totalPoints = input.completed ? task.maxPoints : 0;

    await db
      .update(schema.taskSubmissions)
      .set({
        submittedAt: input.completed ? submission.submittedAt ?? now : null,
        gradedAt: input.completed ? submission.gradedAt ?? now : null,
        gradedBy: input.completed ? actor.profile.id : null,
        totalPoints: input.completed ? task.maxPoints : null,
      })
      .where(eq(schema.taskSubmissions.id, submission.id));

    if (member.role !== "attendee") {
      const scope = resolveLedgerPostingScopeForWorkItem(task.committeeId);
      await upsertScoreLedgerEntry(db, {
        seasonId: task.seasonId,
        membershipId: submission.membershipId,
        month: monthKey,
        sourceType: "task",
        sourceId: submission.id,
        postingScope: scope.postingScope,
        committeeId: scope.committeeId,
        points: totalPoints,
        reason: input.completed
          ? `Task: ${task.title}`
          : `Task unchecked: ${task.title}`,
        createdBy: actor.profile.id,
      });
    }

    return { ok: true, completed: input.completed, totalPoints };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update task completion."),
    };
  }
}

export interface SubmissionMembershipCandidate {
  id: string;
  role: MembershipRole;
  committeeId: string | null;
}

function isMembershipEligibleForTaskTarget(
  membership: SubmissionMembershipCandidate,
  taskCommitteeId: string | null,
  taskTargetGroup?: string | null
): boolean {
  if (taskCommitteeId !== null && membership.committeeId !== taskCommitteeId) {
    return false;
  }
  switch (taskTargetGroup) {
    case "all_heads":
    case "committee_heads":
      return membership.role === "committee_head";
    case "all_members":
    case "committee_members":
      return membership.role === "member";
    case "everyone":
    case "committee_all":
      return membership.role !== "attendee";
    default:
      return true;
  }
}

/**
 * Resolves which active membership of a person owns a task submission:
 * 1. If a submission row already exists for the active hat, use it.
 * 2. Else if a submission row already exists for another active hat of this person, use that assigned hat.
 * 3. Else if the task is a `specific_person` assignment, return null (never let an unassigned person claim it).
 * 4. Else check committee + targetGroup eligibility on the active hat first, then other active hats.
 * 5. Otherwise return null (unauthorized).
 */
export function selectSubmissionMembershipForTask(input: {
  activeMembership: SubmissionMembershipCandidate;
  allPersonSeasonMemberships: readonly SubmissionMembershipCandidate[];
  existingSubmissionMembershipIds: readonly string[];
  taskCommitteeId: string | null;
  taskTargetType?: string | null;
  taskTargetGroup?: string | null;
}): string | null {
  const {
    activeMembership,
    allPersonSeasonMemberships,
    existingSubmissionMembershipIds,
    taskCommitteeId,
    taskTargetType,
    taskTargetGroup,
  } = input;

  if (existingSubmissionMembershipIds.includes(activeMembership.id)) {
    return activeMembership.id;
  }

  const assignedOtherHat = allPersonSeasonMemberships.find((m) =>
    existingSubmissionMembershipIds.includes(m.id)
  );
  if (assignedOtherHat) {
    return assignedOtherHat.id;
  }

  if (taskTargetType === "specific_person") {
    return null;
  }

  if (
    isMembershipEligibleForTaskTarget(
      activeMembership,
      taskCommitteeId,
      taskTargetGroup
    )
  ) {
    return activeMembership.id;
  }

  const matchingEligibleHat = allPersonSeasonMemberships.find((m) =>
    isMembershipEligibleForTaskTarget(m, taskCommitteeId, taskTargetGroup)
  );
  return matchingEligibleHat?.id ?? null;
}

export async function submitMemberTask(
  input: { taskId: string; submissionText?: string; submissionUrl?: string },
  membershipId: string
) {
  const rawUrl = input.submissionUrl?.trim() || null;
  if (rawUrl && !isValidHttpUrl(rawUrl)) {
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

    const validation = validateDeliverableSubmission({
      workType: task.workType,
      submissionText: input.submissionText,
      submissionUrl: input.submissionUrl,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    const { text, url } = validation;

    const seasonRes = await resolveActiveSeason(task.seasonId);
    if (!seasonRes.ok) {
      return { ok: false, error: "Submissions are closed for archived or draft seasons." };
    }

    const [activeMembership] = await db
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
    if (!activeMembership) {
      return { ok: false, error: "You are not an active member of this task's season." };
    }

    const personSeasonMemberships = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.personId, activeMembership.personId),
          eq(schema.rosterMemberships.seasonId, task.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      );

    const personMembershipIds = personSeasonMemberships.map((m) => m.id);
    const existingSubmissions = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, input.taskId),
          inArray(schema.taskSubmissions.membershipId, personMembershipIds)
        )
      );

    const targetMembershipId = selectSubmissionMembershipForTask({
      activeMembership: {
        id: activeMembership.id,
        role: activeMembership.role as MembershipRole,
        committeeId: activeMembership.committeeId,
      },
      allPersonSeasonMemberships: personSeasonMemberships.map((m) => ({
        id: m.id,
        role: m.role as MembershipRole,
        committeeId: m.committeeId,
      })),
      existingSubmissionMembershipIds: existingSubmissions.map(
        (s) => s.membershipId
      ),
      taskCommitteeId: task.committeeId,
      taskTargetType: task.targetType,
      taskTargetGroup: task.targetGroup,
    });

    if (!targetMembershipId) {
      return {
        ok: false,
        error: "Unauthorized: this task is not assigned to you or your committee.",
      };
    }

    const existing = existingSubmissions.find(
      (s) => s.membershipId === targetMembershipId
    );

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
      await db.insert(schema.taskSubmissions).values({
        taskId: input.taskId,
        membershipId: targetMembershipId,
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

export async function toggleMemberTaskCompletion(
  input: { taskId: string; completed: boolean },
  membershipId: string
): Promise<{
  ok: boolean;
  error?: string;
  completed?: boolean;
  totalPoints?: number;
}> {
  try {
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, input.taskId))
      .limit(1);
    if (!task) return { ok: false, error: "Task not found." };

    if (task.workType !== "task") {
      return {
        ok: false,
        error:
          "Assignments require submitting a link for grading and cannot be checked off directly.",
      };
    }

    if (!isTaskSelfReportable(task)) {
      return {
        ok: false,
        error:
          "This task is verified by HR only and cannot be self-checked from the member portal.",
      };
    }

    const seasonRes = await resolveActiveSeason(task.seasonId);
    if (!seasonRes.ok) {
      return {
        ok: false,
        error: "Task check-offs are closed for archived or draft seasons.",
      };
    }

    const [activeMembership] = await db
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
    if (!activeMembership) {
      return {
        ok: false,
        error: "You are not an active member of this task's season.",
      };
    }

    const personSeasonMemberships = await db
      .select()
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.personId, activeMembership.personId),
          eq(schema.rosterMemberships.seasonId, task.seasonId),
          eq(schema.rosterMemberships.isActive, true)
        )
      );

    const personMembershipIds = personSeasonMemberships.map((m) => m.id);
    const existingSubmissions = await db
      .select()
      .from(schema.taskSubmissions)
      .where(
        and(
          eq(schema.taskSubmissions.taskId, input.taskId),
          inArray(schema.taskSubmissions.membershipId, personMembershipIds)
        )
      );

    const targetMembershipId = selectSubmissionMembershipForTask({
      activeMembership: {
        id: activeMembership.id,
        role: activeMembership.role as MembershipRole,
        committeeId: activeMembership.committeeId,
      },
      allPersonSeasonMemberships: personSeasonMemberships.map((m) => ({
        id: m.id,
        role: m.role as MembershipRole,
        committeeId: m.committeeId,
      })),
      existingSubmissionMembershipIds: existingSubmissions.map(
        (s) => s.membershipId
      ),
      taskCommitteeId: task.committeeId,
      taskTargetType: task.targetType,
      taskTargetGroup: task.targetGroup,
    });

    if (!targetMembershipId) {
      return {
        ok: false,
        error: "Unauthorized: this task is not assigned to you or your committee.",
      };
    }

    const targetMembership = personSeasonMemberships.find(
      (m) => m.id === targetMembershipId
    );
    const isAttendee = targetMembership?.role === "attendee";

    const existing = existingSubmissions.find(
      (s) => s.membershipId === targetMembershipId
    );
    const monthKey = formatMonthInCairo(
      existing?.gradedAt ?? task.dueAt ?? new Date()
    );

    if (!isAttendee) {
      const monthGuard = await assertMonthNotPublished(task.seasonId, monthKey);
      if (!monthGuard.ok) return { ok: false, error: monthGuard.error };
    }

    const now = new Date();
    const totalPoints = input.completed ? task.maxPoints : 0;
    let submissionId: string | null = existing?.id ?? null;

    if (existing) {
      await db
        .update(schema.taskSubmissions)
        .set({
          submittedAt: input.completed ? existing.submittedAt ?? now : null,
          gradedAt: input.completed ? existing.gradedAt ?? now : null,
          totalPoints: input.completed ? task.maxPoints : null,
        })
        .where(eq(schema.taskSubmissions.id, existing.id));
    } else if (input.completed) {
      const [inserted] = await db
        .insert(schema.taskSubmissions)
        .values({
          taskId: input.taskId,
          membershipId: targetMembershipId,
          submittedAt: now,
          gradedAt: now,
          totalPoints: task.maxPoints,
        })
        .returning();
      submissionId = inserted.id;
    }

    if (!isAttendee && submissionId) {
      const scope = resolveLedgerPostingScopeForWorkItem(task.committeeId);
      await upsertScoreLedgerEntry(db, {
        seasonId: task.seasonId,
        membershipId: targetMembershipId,
        month: monthKey,
        sourceType: "task",
        sourceId: submissionId,
        postingScope: scope.postingScope,
        committeeId: scope.committeeId,
        points: totalPoints,
        reason: input.completed
          ? `Task: ${task.title}`
          : `Task unchecked: ${task.title}`,
        createdBy: targetMembershipId,
      });
    }

    return { ok: true, completed: input.completed, totalPoints };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to update task status."),
    };
  }
}
