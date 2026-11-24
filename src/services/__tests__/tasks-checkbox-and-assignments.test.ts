import { describe, expect, it } from "vitest";
import {
  deduplicateRecipientsByPerson,
  resolveLedgerPostingScopeForWorkItem,
  resolveLedgerSourceTypeForWorkItem,
  selectSubmissionMembershipForTask,
  validateDeliverableSubmission,
} from "@/services/hr-ops/tasks.service";
import { resolveManualLedgerPostingScope } from "@/services/hr-ops/ledger.service";

describe("Checkable tasks, link assignments, and posting scope helpers", () => {
  it("deduplicates global broadcast recipients by personId using deterministic role precedence", () => {
    const memberships = [
      { id: "m-p1-member", personId: "p-1", role: "member" as const },
      { id: "m-p1-head", personId: "p-1", role: "committee_head" as const },
      { id: "m-p2-hr", personId: "p-2", role: "hr_member" as const },
      { id: "m-p2-member", personId: "p-2", role: "member" as const },
      { id: "m-p3-member-b", personId: "p-3", role: "member" as const },
      { id: "m-p3-member-a", personId: "p-3", role: "member" as const },
    ];

    const deduped = deduplicateRecipientsByPerson(memberships);
    expect(deduped).toHaveLength(3);
    expect(deduped).toContain("m-p1-head");
    expect(deduped).toContain("m-p2-hr");
    expect(deduped).toContain("m-p3-member-a");
  });

  it("maps workType to the correct ledger sourceType", () => {
    expect(resolveLedgerSourceTypeForWorkItem("task")).toBe("task");
    expect(resolveLedgerSourceTypeForWorkItem("assignment")).toBe("assignment");
  });

  it("resolves open vs committee posting scope from task committeeId", () => {
    expect(resolveLedgerPostingScopeForWorkItem(null)).toEqual({
      postingScope: "open",
      committeeId: null,
    });
    expect(resolveLedgerPostingScopeForWorkItem("comm-pr")).toEqual({
      postingScope: "committee",
      committeeId: "comm-pr",
    });
  });

  it("enforces link submission for assignments and checkbox completion for tasks", () => {
    const missingLink = validateDeliverableSubmission({
      workType: "assignment",
      submissionText: "Done!",
      submissionUrl: "",
    });
    expect(missingLink.ok).toBe(false);
    if (!missingLink.ok) {
      expect(missingLink.error).toMatch(/http/i);
    }

    const xssLink = validateDeliverableSubmission({
      workType: "assignment",
      submissionUrl: "javascript:alert(1)",
    });
    expect(xssLink.ok).toBe(false);
    if (!xssLink.ok) {
      expect(xssLink.error).toMatch(/http/i);
    }

    const validAssignment = validateDeliverableSubmission({
      workType: "assignment",
      submissionUrl: "https://github.com/ieee-embs/pcb-v1",
      submissionText: "Final layout",
    });
    expect(validAssignment).toEqual({
      ok: true,
      url: "https://github.com/ieee-embs/pcb-v1",
      text: "Final layout",
    });

    const taskLinkAttempt = validateDeliverableSubmission({
      workType: "task",
      submissionUrl: "https://example.com",
    });
    expect(taskLinkAttempt.ok).toBe(false);
    if (!taskLinkAttempt.ok) {
      expect(taskLinkAttempt.error).toMatch(/check/i);
    }
  });

  it("always resolves manual ledger posting scope to the member's committee board + global (falling back to open only when unassigned)", () => {
    expect(
      resolveManualLedgerPostingScope({
        actorRole: "hr_member",
        memberCommitteeId: "comm-pr",
      })
    ).toEqual({ postingScope: "committee", committeeId: "comm-pr" });

    expect(
      resolveManualLedgerPostingScope({
        actorRole: "committee_head",
        memberCommitteeId: "comm-ai",
      })
    ).toEqual({ postingScope: "committee", committeeId: "comm-ai" });

    // Even HR Admin and Master Admin always post to the member's committee board + global
    expect(
      resolveManualLedgerPostingScope({
        actorRole: "hr_admin",
        requestedScope: "open",
        memberCommitteeId: "comm-pr",
      })
    ).toEqual({ postingScope: "committee", committeeId: "comm-pr" });

    expect(
      resolveManualLedgerPostingScope({
        actorRole: "master_admin",
        requestedScope: "open",
        memberCommitteeId: "comm-pr",
      })
    ).toEqual({ postingScope: "committee", committeeId: "comm-pr" });

    // Unassigned member (no committee) falls back to open scope
    expect(
      resolveManualLedgerPostingScope({
        actorRole: "master_admin",
        memberCommitteeId: null,
      })
    ).toEqual({ postingScope: "open", committeeId: null });
  });

  it("blocks unassigned members from claiming specific_person or role-restricted group tasks", () => {
    const regularMember = {
      id: "m-bob",
      role: "member" as const,
      committeeId: "comm-pr",
    };

    // Bob in PR has no submission row on a specific_person task assigned to Alice in PR -> refused
    expect(
      selectSubmissionMembershipForTask({
        activeMembership: regularMember,
        allPersonSeasonMemberships: [regularMember],
        existingSubmissionMembershipIds: [],
        taskCommitteeId: "comm-pr",
        taskTargetType: "specific_person",
        taskTargetGroup: null,
      })
    ).toBeNull();

    // Bob (member) cannot claim a global all_heads task -> refused
    expect(
      selectSubmissionMembershipForTask({
        activeMembership: regularMember,
        allPersonSeasonMemberships: [regularMember],
        existingSubmissionMembershipIds: [],
        taskCommitteeId: null,
        taskTargetType: "group",
        taskTargetGroup: "all_heads",
      })
    ).toBeNull();

    // A committee head IS eligible for an all_heads task
    const headHat = {
      id: "m-head",
      role: "committee_head" as const,
      committeeId: "comm-pr",
    };
    expect(
      selectSubmissionMembershipForTask({
        activeMembership: regularMember,
        allPersonSeasonMemberships: [regularMember, headHat],
        existingSubmissionMembershipIds: [],
        taskCommitteeId: null,
        taskTargetType: "group",
        taskTargetGroup: "all_heads",
      })
    ).toBe("m-head");
  });
});
