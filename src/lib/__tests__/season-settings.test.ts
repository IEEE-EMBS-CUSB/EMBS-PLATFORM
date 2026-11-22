import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  validateSeasonSettings,
} from "@/lib/season-settings";

describe("Season Settings — Attendance, Tasks, Assignments, Feedback Caps, and Leaderboard", () => {
  it("normalizes legacy settings without tasks or feedback sections using safe defaults", () => {
    const normalized = normalizeSeasonSettings({
      attendance: { defaultBasePoints: 12 },
      grading: { effortWeight: 10, qualityWeight: 8, timelinessWeight: 2, defaultMaxPoints: 100 },
    });

    expect(normalized.attendance.defaultBasePoints).toBe(12);
    expect(normalized.tasks.defaultTaskPoints).toBe(
      DEFAULT_SEASON_SETTINGS.tasks.defaultTaskPoints
    );
    expect(normalized.tasks.defaultCompletionMode).toBe("self_report");
    expect(normalized.feedback.maxBonusPoints).toBe(
      DEFAULT_SEASON_SETTINGS.feedback.maxBonusPoints
    );
    expect(normalized.feedback.maxDeductionPoints).toBe(
      DEFAULT_SEASON_SETTINGS.feedback.maxDeductionPoints
    );
  });

  it("normalizes custom task and feedback settings cleanly", () => {
    const normalized = normalizeSeasonSettings({
      tasks: { defaultTaskPoints: 25, defaultCompletionMode: "hr_only" },
      feedback: { maxBonusPoints: 40, maxDeductionPoints: 30 },
    });

    expect(normalized.tasks).toEqual({
      defaultTaskPoints: 25,
      defaultCompletionMode: "hr_only",
    });
    expect(normalized.feedback).toEqual({
      maxBonusPoints: 40,
      maxDeductionPoints: 30,
    });
  });

  it("rejects out-of-range task points and feedback bonus/deduction caps", () => {
    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        tasks: { defaultTaskPoints: 0, defaultCompletionMode: "self_report" },
      }).ok
    ).toBe(false);

    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        feedback: { maxBonusPoints: -5, maxDeductionPoints: 20 },
      }).ok
    ).toBe(false);

    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        feedback: { maxBonusPoints: 20, maxDeductionPoints: 600 },
      }).ok
    ).toBe(false);

    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        feedback: { maxBonusPoints: 0, maxDeductionPoints: 0 },
      }).ok
    ).toBe(true);
  });
});
