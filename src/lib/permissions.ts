import type { MembershipRole } from "./auth-helpers";

export interface UserPermissionContext {
  id: string;
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
 * Award bonus or point overrides in score_ledger.
 * Master, Director, and HR Admin can award across all committees.
 * HR Member and Committee Head can award only to members in their operational committee.
 */
export function canAwardBonus(
  user: UserPermissionContext,
  targetMemberCommitteeId: string | null
): boolean {
  if (
    user.role === "master_admin" ||
    user.role === "director" ||
    user.role === "hr_admin"
  ) {
    return true;
  }
  if (user.role === "hr_member" || user.role === "committee_head") {
    const scopeId = getOperationalCommitteeScope(user);
    return scopeId !== null && scopeId === targetMemberCommitteeId;
  }
  return false;
}

/**
 * Submit feedback and reviews for members.
 * Master, Director, and HR Admin can submit for all members (including private HR warnings).
 * Committee Head can submit for members of their committee.
 * HR Members do not submit feedback.
 */
export function canGiveFeedback(
  user: UserPermissionContext,
  targetMemberCommitteeId: string | null
): boolean {
  if (
    user.role === "master_admin" ||
    user.role === "director" ||
    user.role === "hr_admin"
  ) {
    return true;
  }
  if (user.role === "committee_head") {
    return (
      user.committeeId !== null && user.committeeId === targetMemberCommitteeId
    );
  }
  return false;
}

/**
 * Determine which top-level modules in the /hr navigation shell are visible.
 */
export function canAccessHrModule(
  role: MembershipRole,
  moduleName: HrModuleName
): boolean {
  switch (moduleName) {
    case "seasons":
      // Only master_admin can manage seasons
      return role === "master_admin";

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
        role === "committee_head"
      );

    default:
      return false;
  }
}

/**
 * Checks if a role is permitted to assign tasks/assignments to a target role.
 * Hierarchy:
 * - master_admin: can assign to anyone (director, committee_head, hr_admin, hr_member, member)
 * - director: sits above heads, can give assignments to committee_head and hr_admin
 * - hr_admin: can give tasks/assignments to hr_member
 * - committee_head: can give assignments to members in their committee
 * - hr_member: can give tasks to members in their committee
 */
export function canAssignTaskToRole(
  assignerRole: MembershipRole,
  targetRole: MembershipRole
): boolean {
  if (assignerRole === "master_admin") {
    return (
      targetRole === "director" ||
      targetRole === "committee_head" ||
      targetRole === "hr_admin" ||
      targetRole === "hr_member" ||
      targetRole === "member"
    );
  }

  if (assignerRole === "director") {
    return targetRole === "committee_head" || targetRole === "hr_admin";
  }

  if (assignerRole === "hr_admin") {
    return targetRole === "hr_member";
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
  assignerRole: MembershipRole
): boolean {
  return canAssignTaskToRole(assignerRole, targetRole);
}

/**
 * Validates whether an assigner user can assign a task/assignment to a specific target user.
 * Enforces role hierarchy and committee boundaries:
 * - master_admin: branch-wide
 * - director: to heads and HR admins
 * - hr_admin: to HR members
 * - committee_head & hr_member: to members in their committee
 */
export function canAssignTask(
  assigner: UserPermissionContext,
  target: UserPermissionContext
): boolean {
  if (!canAssignTaskToRole(assigner.role, target.role)) {
    return false;
  }

  if (assigner.role === "master_admin" || assigner.role === "director") {
    return true;
  }

  if (assigner.role === "hr_admin") {
    return target.role === "hr_member";
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
