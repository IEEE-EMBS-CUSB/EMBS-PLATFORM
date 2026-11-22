import { describe, expect, it } from "vitest";
import {
  isTaskSelfReportable,
  validateTaskGroupPermission,
} from "@/services/hr-ops/tasks.service";
import {
  resolveFeedbackSubmissionPolicy,
  validateFeedbackPointsDelta,
} from "@/services/hr-ops/feedback.service";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/season-settings";

describe("CP2 Service Guards — Task Modes, Target Groups, and Feedback Policy + Caps", () => {
  describe("Task completionMode & group target permissions", () => {
    it("allows member self-check only for self_report tasks, blocking hr_only tasks", () => {
      expect(isTaskSelfReportable({ workType: "task", completionMode: "self_report" })).toBe(true);
      expect(isTaskSelfReportable({ workType: "task", completionMode: "hr_only" })).toBe(false);
      expect(isTaskSelfReportable({ workType: "assignment", completionMode: "self_report" })).toBe(false);
    });

    it("lets directors broadcast assignments to heads OR members (and never tasks)", () => {
      expect(validateTaskGroupPermission("director", "assignment", "all_heads").ok).toBe(true);
      expect(validateTaskGroupPermission("director", "assignment", "all_members").ok).toBe(true);
      expect(validateTaskGroupPermission("director", "assignment", "committee_heads").ok).toBe(true);
      expect(validateTaskGroupPermission("director", "assignment", "committee_members").ok).toBe(true);
      expect(validateTaskGroupPermission("director", "assignment", "committee_all").ok).toBe(true);
      expect(validateTaskGroupPermission("director", "task", "all_heads").ok).toBe(false);
    });

    it("lets hr_admin broadcast tasks to everyone including heads-only, while restricting hr_admin assignments to HR committee only", () => {
      // Tasks: everyone + heads only + members + HR members + committee groups
      expect(validateTaskGroupPermission("hr_admin", "task", "everyone").ok).toBe(true);
      expect(validateTaskGroupPermission("hr_admin", "task", "all_heads").ok).toBe(true);
      expect(validateTaskGroupPermission("hr_admin", "task", "committee_heads").ok).toBe(true);
      expect(validateTaskGroupPermission("hr_admin", "task", "all_members").ok).toBe(true);
      expect(validateTaskGroupPermission("hr_admin", "task", "all_hr_members").ok).toBe(true);

      // Assignments: ONLY HR committee (all_hr_members)
      expect(validateTaskGroupPermission("hr_admin", "assignment", "all_hr_members").ok).toBe(true);
      expect(validateTaskGroupPermission("hr_admin", "assignment", "all_heads").ok).toBe(false);
      expect(validateTaskGroupPermission("hr_admin", "assignment", "all_members").ok).toBe(false);
      expect(validateTaskGroupPermission("hr_admin", "assignment", "everyone").ok).toBe(false);
      expect(validateTaskGroupPermission("hr_admin", "assignment", "committee_members").ok).toBe(false);
    });
  });

  describe("Feedback Categories, Visibility & Bonus/Deduction Caps", () => {
    it("allows hr_member and hr_admin to issue member-visible official warnings and hidden internal notes, while blocking committee_head from both", () => {
      const hrMemberWarning = resolveFeedbackSubmissionPolicy({
        actorRole: "hr_member",
        category: "warning",
      });
      expect(hrMemberWarning.ok).toBe(true);
      if (hrMemberWarning.ok) {
        expect(hrMemberWarning.isPublished).toBe(true);
        expect(hrMemberWarning.isWarning).toBe(true);
        expect(hrMemberWarning.category).toBe("warning");
      }

      const hrMemberHidden = resolveFeedbackSubmissionPolicy({
        actorRole: "hr_member",
        category: "internal_note",
      });
      expect(hrMemberHidden.ok).toBe(true);
      if (hrMemberHidden.ok) {
        expect(hrMemberHidden.isPublished).toBe(false);
        expect(hrMemberHidden.category).toBe("internal_note");
      }

      const headWarning = resolveFeedbackSubmissionPolicy({
        actorRole: "committee_head",
        category: "warning",
      });
      expect(headWarning.ok).toBe(false);

      const headHidden = resolveFeedbackSubmissionPolicy({
        actorRole: "committee_head",
        category: "internal_note",
      });
      expect(headHidden.ok).toBe(false);

      const headRecognition = resolveFeedbackSubmissionPolicy({
        actorRole: "committee_head",
        category: "recognition",
      });
      expect(headRecognition.ok).toBe(true);
    });

    it("enforces season feedback bonus/deduction caps and blocks directors from attaching point changes", () => {
      const caps = { maxBonusPoints: 25, maxDeductionPoints: 20 };

      expect(
        validateFeedbackPointsDelta({
          pointsDelta: 0,
          actor: { id: "d1", email: "d@e.com", role: "director", committeeId: null },
          targetCommitteeId: "c1",
          targetRole: "member",
          caps,
        }).ok
      ).toBe(true);

      // Director cannot attach non-zero bonus/deduction
      expect(
        validateFeedbackPointsDelta({
          pointsDelta: 10,
          actor: { id: "d1", email: "d@e.com", role: "director", committeeId: null },
          targetCommitteeId: "c1",
          targetRole: "member",
          caps,
        }).ok
      ).toBe(false);

      // HR Admin within cap succeeds; above cap fails
      expect(
        validateFeedbackPointsDelta({
          pointsDelta: 25,
          actor: { id: "h1", email: "h@e.com", role: "hr_admin", committeeId: "hr" },
          targetCommitteeId: "c1",
          targetRole: "member",
          caps,
        }).ok
      ).toBe(true);

      expect(
        validateFeedbackPointsDelta({
          pointsDelta: 26,
          actor: { id: "h1", email: "h@e.com", role: "hr_admin", committeeId: "hr" },
          targetCommitteeId: "c1",
          targetRole: "member",
          caps,
        }).ok
      ).toBe(false);

      expect(
        validateFeedbackPointsDelta({
          pointsDelta: -21,
          actor: { id: "h1", email: "h@e.com", role: "hr_admin", committeeId: "hr" },
          targetCommitteeId: "c1",
          targetRole: "member",
          caps,
        }).ok
      ).toBe(false);

      // Default caps allow 0 cleanly
      expect(DEFAULT_SEASON_SETTINGS.feedback.maxBonusPoints).toBeGreaterThanOrEqual(0);
    });
  });
});
