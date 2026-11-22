import { describe, expect, it } from "vitest";
import {
  computeHrActionableWorkCount,
  computeMemberWorkBadgeCounts,
} from "@/services/notifications.service";

describe("notifications.service pure role-scoping & counting helpers", () => {
  it("counts member assignments due (unsubmitted & ungraded) and incomplete tasks separately", () => {
    const res = computeMemberWorkBadgeCounts([
      // Unsubmitted assignment -> counts for Assignments
      { workType: "assignment", submittedAt: null, gradedAt: null },
      // Submitted but awaiting grade assignment -> member already submitted, does NOT nag
      { workType: "assignment", submittedAt: new Date(), gradedAt: null },
      // Graded assignment -> done
      { workType: "assignment", submittedAt: new Date(), gradedAt: new Date() },
      // Incomplete task -> counts for Tasks
      { workType: "task", submittedAt: null, gradedAt: null },
      // Completed task -> done
      { workType: "task", submittedAt: new Date(), gradedAt: new Date() },
    ]);

    expect(res).toEqual({ assignmentsDue: 1, tasksDue: 1 });
  });

  it("scopes HR actionable work counts strictly by role authority (director=assignments only, hr_member=hr_only tasks only, hr_admin=all hr_only tasks + HR assignments)", () => {
    const submissions = [
      // Submitted AI assignment awaiting grade
      {
        submissionId: "sub-ai-asg",
        membershipId: "m-ai-1",
        workType: "assignment" as const,
        completionMode: "self_report" as const,
        taskCommitteeId: "comm-ai",
        memberCommitteeId: "comm-ai",
        submittedAt: new Date(),
        gradedAt: null,
      },
      // Unsubmitted AI assignment (not ready to grade yet)
      {
        submissionId: "sub-ai-asg-unsub",
        membershipId: "m-ai-2",
        workType: "assignment" as const,
        completionMode: "self_report" as const,
        taskCommitteeId: "comm-ai",
        memberCommitteeId: "comm-ai",
        submittedAt: null,
        gradedAt: null,
      },
      // Submitted HR committee assignment awaiting grade
      {
        submissionId: "sub-hr-asg",
        membershipId: "m-hr-1",
        workType: "assignment" as const,
        completionMode: "self_report" as const,
        taskCommitteeId: "comm-hr",
        memberCommitteeId: "comm-hr",
        submittedAt: new Date(),
        gradedAt: null,
      },
      // Pending HR-only task in AI committee (needs HR verification)
      {
        submissionId: "sub-ai-hronly",
        membershipId: "m-ai-1",
        workType: "task" as const,
        completionMode: "hr_only" as const,
        taskCommitteeId: "comm-ai",
        memberCommitteeId: "comm-ai",
        submittedAt: null,
        gradedAt: null,
      },
      // Pending self-report task in AI committee (member self-checks, does not nag HR)
      {
        submissionId: "sub-ai-self",
        membershipId: "m-ai-1",
        workType: "task" as const,
        completionMode: "self_report" as const,
        taskCommitteeId: "comm-ai",
        memberCommitteeId: "comm-ai",
        submittedAt: null,
        gradedAt: null,
      },
    ];

    // Director (Technical track = comm-ai): only sees sub-ai-asg (never HR tasks!)
    expect(
      computeHrActionableWorkCount({
        actor: {
          id: "dir-1",
          email: "dir@cu.edu.eg",
          role: "director",
          committeeId: null,
          trackedCommitteeId: null,
        },
        submissions,
        directorTrackCommitteeIds: new Set(["comm-ai"]),
      })
    ).toBe(1);

    // HR Admin (comm-hr): sees sub-hr-asg (HR assignment) + sub-ai-hronly (HR-only task) = 2
    expect(
      computeHrActionableWorkCount({
        actor: {
          id: "hra-1",
          email: "hra@cu.edu.eg",
          role: "hr_admin",
          committeeId: "comm-hr",
          trackedCommitteeId: null,
        },
        submissions,
        directorTrackCommitteeIds: null,
      })
    ).toBe(2);

    // HR Member tracking comm-ai: sees sub-ai-hronly = 1
    expect(
      computeHrActionableWorkCount({
        actor: {
          id: "hrm-1",
          email: "hrm@cu.edu.eg",
          role: "hr_member",
          committeeId: "comm-hr",
          trackedCommitteeId: "comm-ai",
        },
        submissions,
        directorTrackCommitteeIds: null,
      })
    ).toBe(1);

    // Unassigned HR Member (trackedCommitteeId=null): sees 0
    expect(
      computeHrActionableWorkCount({
        actor: {
          id: "hrm-2",
          email: "hrm2@cu.edu.eg",
          role: "hr_member",
          committeeId: "comm-hr",
          trackedCommitteeId: null,
        },
        submissions,
        directorTrackCommitteeIds: null,
      })
    ).toBe(0);

    // Master Admin: sees sub-ai-asg + sub-hr-asg + sub-ai-hronly = 3
    expect(
      computeHrActionableWorkCount({
        actor: {
          id: "master-1",
          email: "master@cu.edu.eg",
          role: "master_admin",
          committeeId: null,
          trackedCommitteeId: null,
        },
        submissions,
        directorTrackCommitteeIds: null,
      })
    ).toBe(3);
  });
});
