import type { MembershipRole } from "./auth-helpers";

export interface UserPermissionContext {
  id: string;
  personId?: string | null;
  email: string;
  role: MembershipRole;
  committeeId: string | null;
  trackedCommitteeId?: string | null;
}

/**
 * Returns the committee ID that bounds an operational user's committee-scoped actions.
 * - `hr_member`: always belongs to the Human Resources home committee (`committeeId`), while
 *   their operational HR duties (attendance, HR tasks, bonuses) scope to `trackedCommitteeId`.
 *   When `trackedCommitteeId` is explicitly present (including `null` when unassigned), it is
 *   authoritative so an HR member never gains HR-committee management scope by accident.
 * - Other committee-scoped roles (`committee_head`, etc.): scoped to `committeeId`.
 */
export function getOperationalCommitteeScope(
  user: Pick<UserPermissionContext, "role" | "committeeId" | "trackedCommitteeId">
): string | null {
  if (user.role === "hr_member") {
    return user.trackedCommitteeId !== undefined
      ? user.trackedCommitteeId
      : user.committeeId;
  }
  return user.committeeId;
}

export type HrModuleName =
  | "statistics"
  | "seasons"
  | "committees"
  | "roster"
  | "attendance"
  | "tasks"
  | "ledger"
  | "feedback"
  | "publishing";

export type WorkItemType = "assignment" | "task";

/**
 * Determines which work item types a role is allowed to create:
 * - director & committee_head: Assignments only
 * - hr_member: Tasks only
 * - master_admin & hr_admin: Both Assignments and Tasks
 */
export function getAllowedWorkTypesForRole(
  role: MembershipRole
): WorkItemType[] {
  switch (role) {
    case "master_admin":
    case "hr_admin":
      return ["assignment", "task"];
    case "director":
    case "committee_head":
      return ["assignment"];
    case "hr_member":
      return ["task"];
    default:
      return [];
  }
}

export function canCreateWorkType(
  role: MembershipRole,
  workType: WorkItemType
): boolean {
  return getAllowedWorkTypesForRole(role).includes(workType);
}

export function getDefaultWorkTypeForRole(role: MembershipRole): WorkItemType {
  if (role === "hr_member" || role === "hr_admin") {
    return "task";
  }
  return "assignment";
}

/**
 * Exclusive power to manage the global email whitelist.
 * Only master_admin can add or remove emails from whitelist access.
 */
export function canManageWhitelist(role: MembershipRole): boolean {
  return role === "master_admin";
}

/**
 * Exclusive power to assign roles across all users.
 * Only master_admin can assign Master, HR Admin, HR Member, Committee Head, etc.
 */
export function canAssignRoles(role: MembershipRole): boolean {
  return role === "master_admin";
}

/**
 * Assign HR members to specific committees.
 * Granted to master_admin and hr_admin.
 */
export function canAssignHrCommittees(role: MembershipRole): boolean {
  return role === "master_admin" || role === "hr_admin";
}

/**
 * View all committees across the chapter.
 * Granted to master_admin, director, and hr_admin.
 */
export function canViewAllCommittees(role: MembershipRole): boolean {
  return (
    role === "master_admin" ||
    role === "director" ||
    role === "hr_admin"
  );
}

/**
 * Manage committees (create, rename, deactivate, delete).
 * ONLY master_admin has exclusive authority to add or remove committees.
 */
export function canManageCommittees(role: MembershipRole): boolean {
  return role === "master_admin";
}

/**
 * Manage seasons (create, clone, activate, archive).
 * ONLY master_admin has exclusive power over seasons.
 */
export function canManageSeasons(role: MembershipRole): boolean {
  return role === "master_admin";
}

/**
 * Manage committees and seasonal scoring rubrics.
 */
export function canManageRubrics(role: MembershipRole): boolean {
  return role === "master_admin" || role === "hr_admin";
}

/**
 * Publish and freeze monthly leaderboard snapshots.
 */
export function canPublishLeaderboard(role: MembershipRole): boolean {
  return role === "master_admin" || role === "hr_admin";
}

/**
 * Manage sessions / events for a committee.
 * Master and HR Admin can manage for all committees.
 * HR Member (events) and Committee Head (making sessions) can manage only for their committee.
 */
export function canManageCommitteeSessions(
  user: UserPermissionContext,
  committeeId: string | null
): boolean {
  if (user.role === "master_admin" || user.role === "hr_admin") {
    return true;
  }
  if (user.role === "hr_member" || user.role === "committee_head") {
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === committeeId;
  }
  return false;
}

/**
 * Slide deck URLs are required when creating attendance sessions for committee heads
 * and HR members, and optional for HR Admin, Director, and Master Admin.
 */
export function isSlideDeckRequiredForRole(role: MembershipRole): boolean {
  return (
    role !== "hr_admin" && role !== "director" && role !== "master_admin"
  );
}

/**
 * Web conferencing links are required when creating an ONLINE attendance session
 * for non-admin operational roles (committee_head, hr_member), and optional for
 * HR Admin, Director, and Master Admin — matching slide deck requirements.
 */
export function isWebConferencingRequiredForRole(
  role: MembershipRole,
  sessionMode: "offline" | "online"
): boolean {
  if (sessionMode !== "online") return false;
  return isSlideDeckRequiredForRole(role);
}

export const BRANCH_WIDE_INSTRUCTOR_ROLES: readonly MembershipRole[] = [
  "master_admin",
  "director",
  "hr_admin",
];

/**
 * Determines whether a roster membership can be assigned as a session instructor:
 * - Committee session (`sessionCommitteeId !== null`): active `committee_head` of that exact committee,
 *   or active `hr_admin` (HR Head) when the session belongs to the Human Resources committee.
 * - Branch-wide session (`sessionCommitteeId === null`): active `master_admin`, `director`, or `hr_admin`.
 */
export function isEligibleSessionInstructor(
  candidate: {
    role: MembershipRole;
    committeeId: string | null;
    isActive?: boolean;
  },
  sessionCommitteeId: string | null,
  hrCommitteeId?: string | null
): boolean {
  if (candidate.isActive === false) return false;
  if (sessionCommitteeId === null) {
    return (
      candidate.role === "master_admin" ||
      candidate.role === "director" ||
      candidate.role === "hr_admin"
    );
  }
  if (candidate.role === "committee_head") {
    return (
      candidate.committeeId !== null &&
      candidate.committeeId === sessionCommitteeId
    );
  }
  if (candidate.role === "hr_admin") {
    if (hrCommitteeId) {
      return sessionCommitteeId === hrCommitteeId;
    }
    return (
      candidate.committeeId !== null &&
      candidate.committeeId === sessionCommitteeId
    );
  }
  return false;
}

/**
 * Manage attendance & live QR check-ins for a committee session.
 * Master and HR Admin can manage for all committees.
 * HR Member can manage only for their assigned tracked committee.
 * Committee Heads do NOT manage attendance (attendance is an HR duty).
 */
export function canManageCommitteeAttendance(
  user: UserPermissionContext,
  committeeId: string | null
): boolean {
  if (user.role === "master_admin" || user.role === "hr_admin") {
    return true;
  }
  if (user.role === "hr_member") {
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === committeeId;
  }
  return false;
}

/**
 * Create tasks/assignments and submit grades for a committee.
 * Master, Director, and HR Admin can manage across all committees.
 * Committee Head (assignments) and HR Member (tasks) can manage only for their operational committee.
 */
export function canManageCommitteeTasks(
  user: UserPermissionContext,
  committeeId: string | null
): boolean {
  if (
    user.role === "master_admin" ||
    user.role === "director" ||
    user.role === "hr_admin"
  ) {
    return true;
  }
  if (user.role === "committee_head" || user.role === "hr_member") {
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === committeeId;
  }
  return false;
}

/**
 * Checks whether a user can manage (grade/check-off) a specific work item kind for a committee:
 * - master_admin: both assignments and tasks chapter-wide
 * - director: assignments only (tasks remain HR's responsibility)
 * - hr_admin: tasks chapter-wide; assignments for HR committee only
 * - committee_head: assignments for their own committee only
 * - hr_member: tasks for their tracked committee only
 */
export function canManageWorkItem(
  user: UserPermissionContext,
  workType: WorkItemType,
  committeeId: string | null
): boolean {
  if (user.role === "master_admin") {
    return true;
  }

  if (user.role === "director") {
    return workType === "assignment";
  }

  if (user.role === "hr_admin") {
    if (workType === "task") {
      return true;
    }
    return (
      user.committeeId !== null &&
      committeeId !== null &&
      user.committeeId === committeeId
    );
  }

  if (user.role === "committee_head") {
    return (
      workType === "assignment" &&
      user.committeeId !== null &&
      user.committeeId === committeeId
    );
  }

  if (user.role === "hr_member") {
    const scopeId = getOperationalCommitteeScope(user);
    return (
      workType === "task" &&
      scopeId !== null &&
      scopeId === committeeId
    );
  }

  return false;
}

/**
 * Award bonus or point overrides in score_ledger.
 * Master and HR Admin can award across all committees.
 * HR Member can award only to regular members (`member`) in their tracked committee
 * (never to committee heads or leadership roles).
 * Committee Head can award to members in their committee.
 * Directors have read-only access to the points ledger and cannot edit points.
 */
export function canAwardBonus(
  user: UserPermissionContext,
  targetMemberCommitteeId: string | null,
  targetMemberRole?: MembershipRole
): boolean {
  if (user.role === "master_admin" || user.role === "hr_admin") {
    return true;
  }
  if (user.role === "hr_member") {
    if (targetMemberRole && targetMemberRole !== "member") {
      return false;
    }
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === targetMemberCommitteeId;
  }
  if (user.role === "committee_head") {
    if (targetMemberRole && targetMemberRole !== "member") {
      return false;
    }
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === targetMemberCommitteeId;
  }
  return false;
}

/**
 * Check whether a role can issue official member warnings or log hidden internal HR notes.
 */
export function canIssueFeedbackWarnings(role: MembershipRole): boolean {
  return (
    role === "master_admin" ||
    role === "director" ||
    role === "hr_admin" ||
    role === "hr_member"
  );
}

/**
 * Check whether a role can view hidden (unpublished) internal HR feedback notes
 * within their operational scope. Never granted to committee heads, members, or attendees.
 */
export function canViewHiddenFeedback(role: MembershipRole): boolean {
  return (
    role === "master_admin" ||
    role === "director" ||
    role === "hr_admin" ||
    role === "hr_member"
  );
}

/**
 * Submit feedback and reviews for members.
 * Master, Director (track-scoped in services), and HR Admin can submit across their scope.
 * HR Member can submit for members of their tracked committee.
 * Committee Head can submit member-visible non-warning feedback for members of their committee.
 */
export function canGiveFeedback(
  user: UserPermissionContext,
  targetMemberCommitteeId: string | null,
  targetMemberRole?: MembershipRole
): boolean {
  if (
    user.role === "master_admin" ||
    user.role === "director" ||
    user.role === "hr_admin"
  ) {
    return true;
  }
  if (user.role === "committee_head") {
    if (targetMemberRole && targetMemberRole !== "member") {
      return false;
    }
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === targetMemberCommitteeId;
  }
  if (user.role === "hr_member") {
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === targetMemberCommitteeId;
  }
  return false;
}

/**
 * Determine whether a role can switch between active/archived seasons on `/hr/statistics`.
 * Restricted to chapter-wide admin roles (`master_admin` and `hr_admin`).
 */
export function canSwitchStatisticsSeason(role: MembershipRole): boolean {
  return role === "master_admin" || role === "hr_admin";
}

/**
 * Determine which top-level modules in the /hr navigation shell are visible.
 */
export function canAccessHrModule(
  role: MembershipRole,
  moduleName: HrModuleName
): boolean {
  switch (moduleName) {
    case "statistics":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin" ||
        role === "hr_member" ||
        role === "committee_head"
      );

    case "seasons":
      // Master manages lifecycle + settings; HR Admin configures season settings
      return role === "master_admin" || role === "hr_admin";

    case "committees":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin"
      );

    case "roster":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin"
      );

    case "publishing":
      return role === "master_admin" || role === "hr_admin";

    case "attendance":
      return (
        role === "master_admin" ||
        role === "hr_admin" ||
        role === "hr_member" ||
        role === "committee_head"
      );

    case "tasks":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin" ||
        role === "hr_member" ||
        role === "committee_head"
      );

    case "ledger":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin" ||
        role === "hr_member" ||
        role === "committee_head"
      );

    case "feedback":
      return (
        role === "master_admin" ||
        role === "director" ||
        role === "hr_admin" ||
        role === "hr_member" ||
        role === "committee_head"
      );

    default:
      return false;
  }
}

/**
 * Checks if a role is permitted to assign tasks/assignments to a target role.
 * Admin-only roles (`master_admin`, `director`) are never assignable.
 * `hr_admin` is assignable only by an overseeing Director (whose track contains Human Resources) or Master Admin.
 * Hierarchy:
 * - master_admin: can assign both assignments and tasks to committee_head, hr_admin, hr_member, member
 * - director: can give assignments to committee_head, hr_admin (if HR is in their track), and member
 * - hr_admin: can give assignments ONLY to hr_member; can give tasks to committee_head, hr_member, member
 * - committee_head: can give assignments to members in their committee
 * - hr_member: can give tasks to members in their tracked committee
 */
export function canAssignTaskToRole(
  assignerRole: MembershipRole,
  targetRole: MembershipRole,
  workType?: WorkItemType
): boolean {
  if (workType && !canCreateWorkType(assignerRole, workType)) {
    return false;
  }

  if (assignerRole === "master_admin") {
    return (
      targetRole === "committee_head" ||
      targetRole === "hr_admin" ||
      targetRole === "hr_member" ||
      targetRole === "member"
    );
  }

  if (assignerRole === "director") {
    return (
      targetRole === "committee_head" ||
      targetRole === "hr_admin" ||
      targetRole === "member"
    );
  }

  if (assignerRole === "hr_admin") {
    if (workType === "assignment") {
      return targetRole === "hr_member";
    }
    if (workType === "task") {
      return (
        targetRole === "committee_head" ||
        targetRole === "hr_member" ||
        targetRole === "member"
      );
    }
    return (
      targetRole === "hr_member" ||
      targetRole === "committee_head" ||
      targetRole === "member"
    );
  }

  if (assignerRole === "committee_head" || assignerRole === "hr_member") {
    return targetRole === "member";
  }

  return false;
}

/**
 * Checks if a target role is eligible to receive tasks from an assigner role.
 */
export function canReceiveTasksFromRole(
  targetRole: MembershipRole,
  assignerRole: MembershipRole,
  workType?: WorkItemType
): boolean {
  return canAssignTaskToRole(assignerRole, targetRole, workType);
}

/**
 * Validates whether an assigner user can assign a task/assignment to a specific target user.
 */
export function canAssignTask(
  assigner: UserPermissionContext,
  target: UserPermissionContext,
  workType?: WorkItemType
): boolean {
  if (!canAssignTaskToRole(assigner.role, target.role, workType)) {
    return false;
  }

  if (assigner.role === "master_admin" || assigner.role === "director") {
    return true;
  }

  if (assigner.role === "hr_admin") {
    if (workType === "assignment") {
      return target.role === "hr_member";
    }
    return true;
  }

  if (assigner.role === "committee_head" || assigner.role === "hr_member") {
    const scopeId = getOperationalCommitteeScope(assigner);
    return (
      target.role === "member" &&
      scopeId !== null &&
      scopeId === target.committeeId
    );
  }

  return false;
}

/**
 * Resolves the authoritative committee scope for a work submission:
 * committee-bound tasks use `taskCommitteeId`; branch-wide tasks (`null`)
 * fall back to the assignee's committee (or the HR committee for `hr_admin`).
 */
export function resolveWorkScopeCommitteeId(input: {
  taskCommitteeId: string | null;
  memberCommitteeId: string | null;
  memberRole: MembershipRole;
  hrCommitteeId?: string | null;
}): string | null {
  let scopeCommitteeId = input.taskCommitteeId ?? input.memberCommitteeId;
  if (!scopeCommitteeId && input.memberRole === "hr_admin") {
    scopeCommitteeId = input.hrCommitteeId ?? null;
  }
  return scopeCommitteeId;
}

/**
 * Pre-filters tasks before loading submissions in `/hr/tasks`, eliminating any
 * task whose workType or explicit committeeId cannot possibly be graded/verified
 * by the actor (including out-of-track committee tasks for Track Directors).
 */
export function canTaskHaveGradeableSubmissions(input: {
  actor: UserPermissionContext;
  workType: WorkItemType;
  taskCommitteeId: string | null;
  directorTrackCommitteeIds?: ReadonlySet<string> | null;
  hrCommitteeId?: string | null;
}): boolean {
  const {
    actor,
    workType,
    taskCommitteeId,
    directorTrackCommitteeIds,
    hrCommitteeId,
  } = input;

  const effectiveActor: UserPermissionContext =
    actor.role === "hr_admin" && !actor.committeeId
      ? { ...actor, committeeId: hrCommitteeId ?? null }
      : actor;

  if (taskCommitteeId !== null) {
    if (!canManageWorkItem(effectiveActor, workType, taskCommitteeId)) {
      return false;
    }
    if (
      directorTrackCommitteeIds &&
      !directorTrackCommitteeIds.has(taskCommitteeId)
    ) {
      return false;
    }
    return true;
  }

  if (actor.role === "master_admin") return true;
  if (actor.role === "director") return workType === "assignment";
  if (actor.role === "hr_admin") {
    return workType === "task" || Boolean(effectiveActor.committeeId);
  }
  if (actor.role === "committee_head") {
    return workType === "assignment" && Boolean(actor.committeeId);
  }
  if (actor.role === "hr_member") {
    return workType === "task" && Boolean(getOperationalCommitteeScope(actor));
  }
  return false;
}

/**
 * Single source of truth for whether an operational actor can grade/verify a
 * specific work submission — matches server-side `gradeTaskSubmissionAsActor`
 * and `toggleTaskCompletionAsActor` guards so UI visibility never diverges.
 */
export function canGradeWorkSubmission(input: {
  actor: UserPermissionContext;
  workType: WorkItemType;
  taskCommitteeId: string | null;
  submissionMembershipId: string;
  submissionPersonId?: string | null;
  memberRole: MembershipRole;
  memberCommitteeId: string | null;
  directorTrackCommitteeIds?: ReadonlySet<string> | null;
  hrCommitteeId?: string | null;
}): boolean {
  const {
    actor,
    workType,
    taskCommitteeId,
    submissionMembershipId,
    submissionPersonId,
    memberRole,
    memberCommitteeId,
    directorTrackCommitteeIds,
    hrCommitteeId,
  } = input;

  if (submissionMembershipId === actor.id) {
    return false;
  }

  if (actor.personId && submissionPersonId && actor.personId === submissionPersonId) {
    return false;
  }

  if (actor.role === "hr_member" && memberRole !== "member") {
    return false;
  }

  const scopeCommitteeId = resolveWorkScopeCommitteeId({
    taskCommitteeId,
    memberCommitteeId,
    memberRole,
    hrCommitteeId,
  });

  const effectiveActor: UserPermissionContext =
    actor.role === "hr_admin" && !actor.committeeId
      ? { ...actor, committeeId: hrCommitteeId ?? null }
      : actor;

  if (!canManageWorkItem(effectiveActor, workType, scopeCommitteeId)) {
    return false;
  }

  if (
    directorTrackCommitteeIds &&
    (!scopeCommitteeId || !directorTrackCommitteeIds.has(scopeCommitteeId))
  ) {
    return false;
  }

  return true;
}

/**
 * Pre-filters tasks/assignments visible in `/hr/tasks`, including read-only
 * visibility for `hr_member` to inspect member assignments in their tracked committee
 * without granting assignment creation or grading authority.
 */
export function canTaskHaveVisibleSubmissions(input: {
  actor: UserPermissionContext;
  workType: WorkItemType;
  taskCommitteeId: string | null;
  directorTrackCommitteeIds?: ReadonlySet<string> | null;
  hrCommitteeId?: string | null;
}): boolean {
  if (canTaskHaveGradeableSubmissions(input)) {
    return true;
  }

  if (input.actor.role === "hr_member" && input.workType === "assignment") {
    const scopeId = getOperationalCommitteeScope(input.actor);
    if (!scopeId) return false;
    return input.taskCommitteeId === null || input.taskCommitteeId === scopeId;
  }

  return false;
}

/**
 * Determines whether an operational actor can view a work submission in `/hr/tasks`.
 * - Anyone who can grade/verify the submission can view it.
 * - `hr_member` can also view (read-only) `assignment` submissions belonging to
 *   regular `member`s in their active tracked committee (never their own hats,
 *   never committee heads' assignments, and never other committees).
 */
export function canViewWorkSubmission(input: {
  actor: UserPermissionContext;
  workType: WorkItemType;
  taskCommitteeId: string | null;
  submissionMembershipId: string;
  submissionPersonId?: string | null;
  memberRole: MembershipRole;
  memberCommitteeId: string | null;
  directorTrackCommitteeIds?: ReadonlySet<string> | null;
  hrCommitteeId?: string | null;
}): boolean {
  if (canGradeWorkSubmission(input)) {
    return true;
  }

  const {
    actor,
    workType,
    taskCommitteeId,
    submissionMembershipId,
    submissionPersonId,
    memberRole,
    memberCommitteeId,
    hrCommitteeId,
  } = input;

  if (actor.role !== "hr_member" || workType !== "assignment") {
    return false;
  }

  if (submissionMembershipId === actor.id) {
    return false;
  }

  if (actor.personId && submissionPersonId && actor.personId === submissionPersonId) {
    return false;
  }

  if (memberRole !== "member") {
    return false;
  }

  const scopeCommitteeId = resolveWorkScopeCommitteeId({
    taskCommitteeId,
    memberCommitteeId,
    memberRole,
    hrCommitteeId,
  });
  const trackedScopeId = getOperationalCommitteeScope(actor);

  return (
    trackedScopeId !== null &&
    scopeCommitteeId !== null &&
    scopeCommitteeId === trackedScopeId
  );
}
