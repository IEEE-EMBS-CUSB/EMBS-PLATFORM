import { describe, expect, it } from "vitest";
import {
  canManageWhitelist,
  canAssignRoles,
  canAssignHrCommittees,
  canManageSeasons,
  canManageRubrics,
  canPublishLeaderboard,
  canManageCommitteeAttendance,
  canManageCommitteeTasks,
  canAwardBonus,
  canGiveFeedback,
  canManageCommitteeSessions,
  canViewAllCommittees,
  canAccessHrModule,
  canAssignTaskToRole,
  canReceiveTasksFromRole,
  canAssignTask,
  getAllowedWorkTypesForRole,
  canCreateWorkType,
  type UserPermissionContext,
} from "@/lib/permissions";

describe("RBAC Permissions Engine", () => {
  const commAi = "comm-ai-ml";
  const commWeb = "comm-web-dev";

  const masterUser: UserPermissionContext = {
    id: "usr-master",
    email: "master@cu.edu.eg",
    role: "master_admin",
    committeeId: null,
  };

  const directorUser: UserPermissionContext = {
    id: "usr-director",
    email: "director@cu.edu.eg",
    role: "director",
    committeeId: null,
  };

  const hrAdminUser: UserPermissionContext = {
    id: "usr-hr-admin",
    email: "hr.lead@cu.edu.eg",
    role: "hr_admin",
    committeeId: "comm-hr",
  };

  const hrMemberAiUser: UserPermissionContext = {
    id: "usr-hr-member",
    email: "hr.member@cu.edu.eg",
    role: "hr_member",
    committeeId: commAi,
  };

  const headAiUser: UserPermissionContext = {
    id: "usr-head-ai",
    email: "salma@cu.edu.eg",
    role: "committee_head",
    committeeId: commAi,
  };

  const memberAiUser: UserPermissionContext = {
    id: "usr-member-ai",
    email: "omar@cu.edu.eg",
    role: "member",
    committeeId: commAi,
  };

  const attendeeUser: UserPermissionContext = {
    id: "usr-attendee",
    email: "mariam@gmail.com",
    role: "attendee",
    committeeId: null,
  };

  describe("Master Admin Exclusive Capabilities", () => {
    it("allows only master_admin to manage email whitelist, assign user roles, and manage seasons", () => {
      expect(canManageWhitelist("master_admin")).toBe(true);
      expect(canManageWhitelist("director")).toBe(false);
      expect(canManageWhitelist("hr_admin")).toBe(false);
      expect(canManageWhitelist("hr_member")).toBe(false);
      expect(canManageWhitelist("committee_head")).toBe(false);
      expect(canManageWhitelist("member")).toBe(false);
      expect(canManageWhitelist("attendee")).toBe(false);

      expect(canAssignRoles("master_admin")).toBe(true);
      expect(canAssignRoles("director")).toBe(false);
      expect(canAssignRoles("hr_admin")).toBe(false);
      expect(canAssignRoles("hr_member")).toBe(false);
      expect(canAssignRoles("committee_head")).toBe(false);

      // Only master can manage seasons
      expect(canManageSeasons("master_admin")).toBe(true);
      expect(canManageSeasons("director")).toBe(false);
      expect(canManageSeasons("hr_admin")).toBe(false);
      expect(canManageSeasons("hr_member")).toBe(false);
      expect(canManageSeasons("committee_head")).toBe(false);
    });
  });

  describe("HR Admin, Director, and Master Capabilities", () => {
    it("allows master_admin and hr_admin to assign HR members to committees", () => {
      expect(canAssignHrCommittees("master_admin")).toBe(true);
      expect(canAssignHrCommittees("hr_admin")).toBe(true);
      expect(canAssignHrCommittees("director")).toBe(false);
      expect(canAssignHrCommittees("hr_member")).toBe(false);
      expect(canAssignHrCommittees("committee_head")).toBe(false);
      expect(canAssignHrCommittees("member")).toBe(false);
    });

    it("allows master_admin, director, and hr_admin to view all committees", () => {
      expect(canViewAllCommittees("master_admin")).toBe(true);
      expect(canViewAllCommittees("director")).toBe(true);
      expect(canViewAllCommittees("hr_admin")).toBe(true);
      expect(canViewAllCommittees("hr_member")).toBe(false);
      expect(canViewAllCommittees("committee_head")).toBe(false);
    });

    it("allows master_admin and hr_admin to manage rubrics and publish leaderboard", () => {
      expect(canManageRubrics("master_admin")).toBe(true);
      expect(canManageRubrics("hr_admin")).toBe(true);
      expect(canManageRubrics("director")).toBe(false);
      expect(canManageRubrics("committee_head")).toBe(false);

      expect(canPublishLeaderboard("master_admin")).toBe(true);
      expect(canPublishLeaderboard("hr_admin")).toBe(true);
      expect(canPublishLeaderboard("director")).toBe(false);
      expect(canPublishLeaderboard("hr_member")).toBe(false);
    });
  });

  describe("Committee-Scoped Attendance Permissions", () => {
    it("allows HR admin across all committees, but restricts HR member to their committee", () => {
      expect(canManageCommitteeAttendance(hrAdminUser, commAi)).toBe(true);
      expect(canManageCommitteeAttendance(hrAdminUser, commWeb)).toBe(true);

      // HR member can only manage their assigned committee
      expect(canManageCommitteeAttendance(hrMemberAiUser, commAi)).toBe(true);
      expect(canManageCommitteeAttendance(hrMemberAiUser, commWeb)).toBe(false);

      // Committee heads, members, attendees cannot manage attendance
      expect(canManageCommitteeAttendance(headAiUser, commAi)).toBe(false);
      expect(canManageCommitteeAttendance(memberAiUser, commAi)).toBe(false);
      expect(canManageCommitteeAttendance(attendeeUser, commAi)).toBe(false);
    });
  });

  describe("Committee Head Tasks, Sessions, and Feedback Permissions", () => {
    it("allows committee heads to make sessions, give tasks, and give feedback for their committee only", () => {
      // Sessions
      expect(canManageCommitteeSessions(headAiUser, commAi)).toBe(true);
      expect(canManageCommitteeSessions(headAiUser, commWeb)).toBe(false);

      // Tasks / Assignments
      expect(canManageCommitteeTasks(headAiUser, commAi)).toBe(true);
      expect(canManageCommitteeTasks(headAiUser, commWeb)).toBe(false);
      expect(canManageCommitteeTasks(hrMemberAiUser, commAi)).toBe(true);
      expect(canManageCommitteeTasks(hrMemberAiUser, commWeb)).toBe(false);

      // Feedback
      expect(canGiveFeedback(headAiUser, commAi)).toBe(true);
      expect(canGiveFeedback(headAiUser, commWeb)).toBe(false);
      expect(canGiveFeedback(hrMemberAiUser, commAi)).toBe(false);
      expect(canGiveFeedback(memberAiUser, commAi)).toBe(false);
    });

    it("allows HR members to create events/sessions for their assigned committee", () => {
      expect(canManageCommitteeSessions(hrMemberAiUser, commAi)).toBe(true);
      expect(canManageCommitteeSessions(hrMemberAiUser, commWeb)).toBe(false);
    });
  });

  describe("Bonus / Points Override Permissions", () => {
    it("allows master and hr admin everywhere, and allows HR member and committee head for their committee", () => {
      expect(canAwardBonus(masterUser, commAi)).toBe(true);
      expect(canAwardBonus(hrAdminUser, commWeb)).toBe(true);

      // HR member can award bonus to members of their committee
      expect(canAwardBonus(hrMemberAiUser, commAi)).toBe(true);
      expect(canAwardBonus(hrMemberAiUser, commWeb)).toBe(false);

      // Committee head can award bonus to members of their committee
      expect(canAwardBonus(headAiUser, commAi)).toBe(true);
      expect(canAwardBonus(headAiUser, commWeb)).toBe(false);

      // Regular member cannot award bonus
      expect(canAwardBonus(memberAiUser, commAi)).toBe(false);
    });
  });

  describe("HR Operations Portal Access by Module", () => {
    it("determines module visibility for each role in /hr", () => {
      // Seasons module (ONLY master_admin)
      expect(canAccessHrModule("master_admin", "seasons")).toBe(true);
      expect(canAccessHrModule("director", "seasons")).toBe(false);
      expect(canAccessHrModule("hr_admin", "seasons")).toBe(false);
      expect(canAccessHrModule("hr_member", "seasons")).toBe(false);
      expect(canAccessHrModule("committee_head", "seasons")).toBe(false);

      // Attendance / Sessions module
      expect(canAccessHrModule("hr_admin", "attendance")).toBe(true);
      expect(canAccessHrModule("hr_member", "attendance")).toBe(true);
      expect(canAccessHrModule("committee_head", "attendance")).toBe(true);
      expect(canAccessHrModule("director", "attendance")).toBe(false);

      // Tasks & Assignments module
      expect(canAccessHrModule("master_admin", "tasks")).toBe(true);
      expect(canAccessHrModule("director", "tasks")).toBe(true);
      expect(canAccessHrModule("hr_admin", "tasks")).toBe(true);
      expect(canAccessHrModule("committee_head", "tasks")).toBe(true);
      expect(canAccessHrModule("hr_member", "tasks")).toBe(true);

      // Ledger / Bonus module
      expect(canAccessHrModule("director", "ledger")).toBe(true);
      expect(canAccessHrModule("hr_admin", "ledger")).toBe(true);
      expect(canAccessHrModule("hr_member", "ledger")).toBe(true);
      expect(canAccessHrModule("committee_head", "ledger")).toBe(true);

      // Feedback module
      expect(canAccessHrModule("director", "feedback")).toBe(true);
      expect(canAccessHrModule("hr_admin", "feedback")).toBe(true);
      expect(canAccessHrModule("committee_head", "feedback")).toBe(true);
      expect(canAccessHrModule("hr_member", "feedback")).toBe(false);

      // Publishing module
      expect(canAccessHrModule("master_admin", "publishing")).toBe(true);
      expect(canAccessHrModule("hr_admin", "publishing")).toBe(true);
      expect(canAccessHrModule("director", "publishing")).toBe(false);
      expect(canAccessHrModule("hr_member", "publishing")).toBe(false);
      expect(canAccessHrModule("committee_head", "publishing")).toBe(false);
    });
  });

  describe("Task Delegation Hierarchy (Director, Head, HR Admin, HR Member)", () => {
    it("allows directors to assign tasks to heads and HR admins, and heads to see them", () => {
      // Director assigning to Committee Head
      expect(canAssignTaskToRole("director", "committee_head")).toBe(true);
      expect(canAssignTask(directorUser, headAiUser)).toBe(true);
      expect(canReceiveTasksFromRole("committee_head", "director")).toBe(true);

      // Director assigning to HR Admin (HR Admin extends head)
      expect(canAssignTaskToRole("director", "hr_admin")).toBe(true);
      expect(canAssignTask(directorUser, hrAdminUser)).toBe(true);
      expect(canReceiveTasksFromRole("hr_admin", "director")).toBe(true);

      // Director cannot assign tasks directly to regular members
      expect(canAssignTaskToRole("director", "member")).toBe(false);
      expect(canAssignTask(directorUser, memberAiUser)).toBe(false);
    });

    it("allows HR admin to assign tasks to HR members, and HR members to receive them", () => {
      expect(canAssignTaskToRole("hr_admin", "hr_member")).toBe(true);
      expect(canAssignTask(hrAdminUser, hrMemberAiUser)).toBe(true);
      expect(canReceiveTasksFromRole("hr_member", "hr_admin")).toBe(true);

      // HR admin cannot assign tasks directly to regular members outside HR
      expect(canAssignTaskToRole("hr_admin", "member")).toBe(false);
    });

    it("allows committee head to assign tasks to members in their committee", () => {
      expect(canAssignTaskToRole("committee_head", "member")).toBe(true);
      expect(canAssignTask(headAiUser, memberAiUser)).toBe(true);
      expect(canReceiveTasksFromRole("member", "committee_head")).toBe(true);

      // Head cannot assign tasks to members in another committee
      const memberWebUser: UserPermissionContext = {
        id: "usr-web",
        email: "web@cu.edu.eg",
        role: "member",
        committeeId: commWeb,
      };
      expect(canAssignTask(headAiUser, memberWebUser)).toBe(false);
    });

    it("allows master admin to assign tasks to anyone", () => {
      expect(canAssignTaskToRole("master_admin", "director")).toBe(true);
      expect(canAssignTaskToRole("master_admin", "committee_head")).toBe(true);
      expect(canAssignTaskToRole("master_admin", "hr_admin")).toBe(true);
      expect(canAssignTaskToRole("master_admin", "hr_member")).toBe(true);
      expect(canAssignTaskToRole("master_admin", "member")).toBe(true);
    });

    it("enforces Assignments vs Tasks role rules (only master_admin and hr_admin can give both)", () => {
      expect(getAllowedWorkTypesForRole("director")).toEqual(["assignment"]);
      expect(getAllowedWorkTypesForRole("committee_head")).toEqual(["assignment"]);
      expect(getAllowedWorkTypesForRole("hr_member")).toEqual(["task"]);
      expect(getAllowedWorkTypesForRole("hr_admin")).toEqual(["assignment", "task"]);
      expect(getAllowedWorkTypesForRole("master_admin")).toEqual(["assignment", "task"]);

      expect(canCreateWorkType("director", "assignment")).toBe(true);
      expect(canCreateWorkType("director", "task")).toBe(false);
      expect(canCreateWorkType("committee_head", "assignment")).toBe(true);
      expect(canCreateWorkType("committee_head", "task")).toBe(false);
      expect(canCreateWorkType("hr_member", "task")).toBe(true);
      expect(canCreateWorkType("hr_member", "assignment")).toBe(false);
      expect(canCreateWorkType("hr_admin", "assignment")).toBe(true);
      expect(canCreateWorkType("hr_admin", "task")).toBe(true);
      expect(canCreateWorkType("master_admin", "assignment")).toBe(true);
      expect(canCreateWorkType("master_admin", "task")).toBe(true);

      // HR member can assign tasks to members of their own committee only
      expect(canAssignTask(hrMemberAiUser, memberAiUser)).toBe(true);
      expect(
        canAssignTask(hrMemberAiUser, {
          id: "usr-web",
          email: "web@cu.edu.eg",
          role: "member",
          committeeId: commWeb,
        })
      ).toBe(false);
    });
  });
});
