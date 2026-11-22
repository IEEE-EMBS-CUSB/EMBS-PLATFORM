import { describe, expect, it } from "vitest";
import {
  canAssignTask,
  canAwardBonus,
  canManageCommitteeAttendance,
  canManageCommitteeSessions,
  canManageCommitteeTasks,
  getOperationalCommitteeScope,
  type UserPermissionContext,
} from "@/lib/permissions";
import {
  HR_COMMITTEE_SLUG,
  isProtectedCoreCommittee,
} from "@/services/hr-ops/committees.service";

describe("HR Committee protection & hr_member trackedCommitteeId scoping", () => {
  it("protects the Human Resources core committee from deletion while allowing other committees", () => {
    expect(HR_COMMITTEE_SLUG).toBe("human-resources");
    expect(isProtectedCoreCommittee({ slug: "human-resources" })).toBe(true);
    expect(isProtectedCoreCommittee({ slug: "HUMAN-RESOURCES" })).toBe(true);
    expect(isProtectedCoreCommittee({ slug: "ai-and-machine-learning" })).toBe(
      false
    );
  });

  it("scopes hr_member operational permissions strictly to trackedCommitteeId, not their Human Resources home committee", () => {
    const hrMemberTrackingAi: UserPermissionContext = {
      id: "mem-laila",
      email: "hr.member@cu.edu.eg",
      role: "hr_member",
      committeeId: "comm-hr",
      trackedCommitteeId: "comm-ai",
    };

    expect(getOperationalCommitteeScope(hrMemberTrackingAi)).toBe("comm-ai");
    expect(canManageCommitteeAttendance(hrMemberTrackingAi, "comm-ai")).toBe(
      true
    );
    expect(canManageCommitteeAttendance(hrMemberTrackingAi, "comm-hr")).toBe(
      false
    );
    expect(canManageCommitteeSessions(hrMemberTrackingAi, "comm-ai")).toBe(true);
    expect(canManageCommitteeSessions(hrMemberTrackingAi, "comm-hr")).toBe(
      false
    );
    expect(canManageCommitteeTasks(hrMemberTrackingAi, "comm-ai")).toBe(true);
    expect(canManageCommitteeTasks(hrMemberTrackingAi, "comm-hr")).toBe(false);
    expect(canAwardBonus(hrMemberTrackingAi, "comm-ai")).toBe(true);
    expect(canAwardBonus(hrMemberTrackingAi, "comm-hr")).toBe(false);

    // Can assign tasks to AI members, NOT HR committee members
    expect(
      canAssignTask(hrMemberTrackingAi, {
        id: "mem-omar",
        email: "omar@cu.edu.eg",
        role: "member",
        committeeId: "comm-ai",
      })
    ).toBe(true);
    expect(
      canAssignTask(hrMemberTrackingAi, {
        id: "mem-hr-peer",
        email: "peer@cu.edu.eg",
        role: "member",
        committeeId: "comm-hr",
      })
    ).toBe(false);

    // An hr_member with trackedCommitteeId === null has NO committee operational scope yet
    const unassignedHrMember: UserPermissionContext = {
      id: "mem-new-hr",
      email: "new.hr@cu.edu.eg",
      role: "hr_member",
      committeeId: "comm-hr",
      trackedCommitteeId: null,
    };
    expect(getOperationalCommitteeScope(unassignedHrMember)).toBeNull();
    expect(canManageCommitteeAttendance(unassignedHrMember, "comm-hr")).toBe(
      false
    );
    expect(canManageCommitteeTasks(unassignedHrMember, "comm-ai")).toBe(false);
  });
});
