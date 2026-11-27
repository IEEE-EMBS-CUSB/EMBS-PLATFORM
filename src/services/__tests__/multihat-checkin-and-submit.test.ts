import { describe, expect, it } from "vitest";
import {
  selectCheckinMembershipForSession,
  type CheckinMembershipCandidate,
} from "@/services/hr-ops/attendance.service";
import {
  selectSubmissionMembershipForTask,
  type SubmissionMembershipCandidate,
} from "@/services/hr-ops/tasks.service";

describe("Multi-hat check-in & task submission membership resolution", () => {
  const prHead: CheckinMembershipCandidate = {
    id: "mem-pr-head",
    role: "committee_head",
    committeeId: "comm-pr",
  };
  const aiMember: CheckinMembershipCandidate = {
    id: "mem-ai-member",
    role: "member",
    committeeId: "comm-ai",
  };
  const webAttendee: CheckinMembershipCandidate = {
    id: "mem-web-attendee",
    role: "attendee",
    committeeId: "comm-web",
  };

  it("resolves matching committee hat for QR check-in when active hat is in another committee", () => {
    // Active hat is PR Head, scanning an AI committee session -> resolves to AI Member hat
    const resolved = selectCheckinMembershipForSession({
      activeMembership: prHead,
      allPersonSeasonMemberships: [prHead, aiMember, webAttendee],
      sessionCommitteeId: "comm-ai",
    });
    expect(resolved?.id).toBe("mem-ai-member");

    // Branch-wide session -> always stamps the active hat
    const branchWide = selectCheckinMembershipForSession({
      activeMembership: prHead,
      allPersonSeasonMemberships: [prHead, aiMember],
      sessionCommitteeId: null,
    });
    expect(branchWide?.id).toBe("mem-pr-head");

    // Unrelated committee -> rejected (returns null)
    const denied = selectCheckinMembershipForSession({
      activeMembership: prHead,
      allPersonSeasonMemberships: [prHead, aiMember],
      sessionCommitteeId: "comm-robotics",
    });
    expect(denied).toBeNull();

    // Committee head scanning their OWN committee's session -> rejected (heads attend branch-wide sessions only)
    const ownCommitteeAsHead = selectCheckinMembershipForSession({
      activeMembership: prHead,
      allPersonSeasonMemberships: [prHead, aiMember],
      sessionCommitteeId: "comm-pr",
    });
    expect(ownCommitteeAsHead).toBeNull();

    // HR Admin (HR Head) scanning an HR meeting -> rejected; HR Member scanning an HR meeting -> allowed
    const hrHead: CheckinMembershipCandidate = {
      id: "mem-hr-head",
      role: "hr_admin",
      committeeId: "comm-hr",
    };
    const hrMem: CheckinMembershipCandidate = {
      id: "mem-hr-member",
      role: "hr_member",
      committeeId: "comm-hr",
    };
    expect(
      selectCheckinMembershipForSession({
        activeMembership: hrHead,
        allPersonSeasonMemberships: [hrHead],
        sessionCommitteeId: "comm-hr",
      })
    ).toBeNull();
    expect(
      selectCheckinMembershipForSession({
        activeMembership: hrMem,
        allPersonSeasonMemberships: [hrMem],
        sessionCommitteeId: "comm-hr",
      })?.id
    ).toBe("mem-hr-member");
    expect(
      selectCheckinMembershipForSession({
        activeMembership: hrHead,
        allPersonSeasonMemberships: [hrHead],
        sessionCommitteeId: null,
      })?.id
    ).toBe("mem-hr-head");
  });

  it("resolves assigned hat for task submission across a person's hats and stamps active hat for global tasks", () => {
    const hats: SubmissionMembershipCandidate[] = [prHead, aiMember];

    // Task already assigned to AI Member hat while user is viewing under PR Head hat
    const assignedOtherHat = selectSubmissionMembershipForTask({
      activeMembership: prHead,
      allPersonSeasonMemberships: hats,
      existingSubmissionMembershipIds: ["mem-ai-member"],
      taskCommitteeId: "comm-ai",
    });
    expect(assignedOtherHat).toBe("mem-ai-member");

    // Global task with no pre-created submission -> stamps active hat
    const globalTask = selectSubmissionMembershipForTask({
      activeMembership: prHead,
      allPersonSeasonMemberships: hats,
      existingSubmissionMembershipIds: [],
      taskCommitteeId: null,
    });
    expect(globalTask).toBe("mem-pr-head");

    // Unrelated committee task -> rejected
    const unrelated = selectSubmissionMembershipForTask({
      activeMembership: prHead,
      allPersonSeasonMemberships: hats,
      existingSubmissionMembershipIds: [],
      taskCommitteeId: "comm-robotics",
    });
    expect(unrelated).toBeNull();
  });
});
