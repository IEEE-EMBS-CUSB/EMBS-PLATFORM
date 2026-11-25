import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEASON_SETTINGS,
  getAttendanceScoringForMode,
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

  it("normalizes, validates, and resolves separate online vs offline attendance scoring", () => {
    // Legacy season JSON without onlineBasePoints / onlinePunctualityBonus falls back safely
    const normalizedLegacy = normalizeSeasonSettings({
      attendance: {
        defaultBasePoints: 14,
        defaultPunctualityBonus: 6,
      },
    });
    expect(normalizedLegacy.attendance.defaultBasePoints).toBe(14);
    expect(normalizedLegacy.attendance.defaultPunctualityBonus).toBe(6);
    expect(normalizedLegacy.attendance.onlineBasePoints).toBe(
      DEFAULT_SEASON_SETTINGS.attendance.onlineBasePoints
    );
    expect(normalizedLegacy.attendance.onlinePunctualityBonus).toBe(
      DEFAULT_SEASON_SETTINGS.attendance.onlinePunctualityBonus
    );

    // Custom online and offline scoring
    const normalizedCustom = normalizeSeasonSettings({
      attendance: {
        defaultBasePoints: 15,
        defaultPunctualityBonus: 5,
        onlineBasePoints: 6,
        onlinePunctualityBonus: 2,
      },
    });
    expect(
      getAttendanceScoringForMode(normalizedCustom.attendance, "offline")
    ).toEqual({ basePoints: 15, punctualityBonus: 5 });
    expect(
      getAttendanceScoringForMode(normalizedCustom.attendance, "online")
    ).toEqual({ basePoints: 6, punctualityBonus: 2 });

    // Rejects out-of-range online scoring
    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        attendance: {
          ...DEFAULT_SEASON_SETTINGS.attendance,
          onlineBasePoints: -1,
        },
      }).ok
    ).toBe(false);
    expect(
      validateSeasonSettings({
        ...DEFAULT_SEASON_SETTINGS,
        attendance: {
          ...DEFAULT_SEASON_SETTINGS.attendance,
          onlinePunctualityBonus: 250,
        },
      }).ok
    ).toBe(false);
  });
});
