export interface SeasonAttendanceSettings {
  defaultBasePoints: number;
  defaultPunctualityBonus: number;
  punctualityCutoffMinutes: number;
  defaultCheckinWindowMinutes: number;
  qrRotationSeconds: number;
}

export type TaskCompletionMode = "self_report" | "hr_only";

export interface SeasonTaskSettings {
  defaultTaskPoints: number;
  defaultCompletionMode: TaskCompletionMode;
}

export interface SeasonGradingSettings {
  effortWeight: number;
  qualityWeight: number;
  timelinessWeight: number;
  defaultMaxPoints: number;
}

export interface SeasonFeedbackSettings {
  maxBonusPoints: number;
  maxDeductionPoints: number;
}

export interface SeasonTierThresholds {
  bronze: number;
  silver: number;
  gold: number;
  diamond: number;
}

export interface SeasonLeaderboardSettings {
  publicTopN: number;
  tierThresholds: SeasonTierThresholds;
}

export interface SeasonSettings {
  attendance: SeasonAttendanceSettings;
  tasks: SeasonTaskSettings;
  grading: SeasonGradingSettings;
  feedback: SeasonFeedbackSettings;
  leaderboard: SeasonLeaderboardSettings;
}

export const DEFAULT_SEASON_SETTINGS: SeasonSettings = {
  attendance: {
    defaultBasePoints: 10,
    defaultPunctualityBonus: 5,
    punctualityCutoffMinutes: 15,
    defaultCheckinWindowMinutes: 30,
    qrRotationSeconds: 60,
  },
  tasks: {
    defaultTaskPoints: 15,
    defaultCompletionMode: "self_report",
  },
  grading: {
    effortWeight: 10,
    qualityWeight: 8,
    timelinessWeight: 2,
    defaultMaxPoints: 100,
  },
  feedback: {
    maxBonusPoints: 50,
    maxDeductionPoints: 50,
  },
  leaderboard: {
    publicTopN: 10,
    tierThresholds: {
      bronze: 50,
      silver: 150,
      gold: 300,
      diamond: 500,
    },
  },
};

export interface DefaultCommitteeTrackSeed {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export const DEFAULT_COMMITTEE_TRACKS: readonly DefaultCommitteeTrackSeed[] = [
  {
    name: "Technical",
    slug: "technical",
    description: "Engineering, biomedical hardware, software, AI, and robotics committees.",
    sortOrder: 1,
  },
  {
    name: "Creative",
    slug: "creative",
    description: "Design, media production, branding, and marketing committees.",
    sortOrder: 2,
  },
  {
    name: "Operations",
    slug: "operations",
    description: "HR, PR, logistics, fundraising, and chapter operations committees.",
    sortOrder: 3,
  },
];

function asFiniteInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  return fallback;
}

/**
 * Safely merges partial/legacy JSON from PostgreSQL with defaults so every field is defined.
 */
export function normalizeSeasonSettings(raw?: unknown): SeasonSettings {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const att =
    obj.attendance && typeof obj.attendance === "object"
      ? (obj.attendance as Record<string, unknown>)
      : {};
  const tsk =
    obj.tasks && typeof obj.tasks === "object"
      ? (obj.tasks as Record<string, unknown>)
      : {};
  const grd =
    obj.grading && typeof obj.grading === "object"
      ? (obj.grading as Record<string, unknown>)
      : {};
  const fbk =
    obj.feedback && typeof obj.feedback === "object"
      ? (obj.feedback as Record<string, unknown>)
      : {};
  const lb =
    obj.leaderboard && typeof obj.leaderboard === "object"
      ? (obj.leaderboard as Record<string, unknown>)
      : {};
  const tiers =
    lb.tierThresholds && typeof lb.tierThresholds === "object"
      ? (lb.tierThresholds as Record<string, unknown>)
      : {};

  return {
    attendance: {
      defaultBasePoints: asFiniteInt(
        att.defaultBasePoints,
        DEFAULT_SEASON_SETTINGS.attendance.defaultBasePoints
      ),
      defaultPunctualityBonus: asFiniteInt(
        att.defaultPunctualityBonus,
        DEFAULT_SEASON_SETTINGS.attendance.defaultPunctualityBonus
      ),
      punctualityCutoffMinutes: asFiniteInt(
        att.punctualityCutoffMinutes,
        DEFAULT_SEASON_SETTINGS.attendance.punctualityCutoffMinutes
      ),
      defaultCheckinWindowMinutes: asFiniteInt(
        att.defaultCheckinWindowMinutes,
        DEFAULT_SEASON_SETTINGS.attendance.defaultCheckinWindowMinutes
      ),
      qrRotationSeconds: asFiniteInt(
        att.qrRotationSeconds,
        DEFAULT_SEASON_SETTINGS.attendance.qrRotationSeconds
      ),
    },
    tasks: {
      defaultTaskPoints: asFiniteInt(
        tsk.defaultTaskPoints,
        DEFAULT_SEASON_SETTINGS.tasks.defaultTaskPoints
      ),
      defaultCompletionMode:
        tsk.defaultCompletionMode === "hr_only" ? "hr_only" : "self_report",
    },
    grading: {
      effortWeight: asFiniteInt(
        grd.effortWeight,
        DEFAULT_SEASON_SETTINGS.grading.effortWeight
      ),
      qualityWeight: asFiniteInt(
        grd.qualityWeight,
        DEFAULT_SEASON_SETTINGS.grading.qualityWeight
      ),
      timelinessWeight: asFiniteInt(
        grd.timelinessWeight,
        DEFAULT_SEASON_SETTINGS.grading.timelinessWeight
      ),
      defaultMaxPoints: asFiniteInt(
        grd.defaultMaxPoints,
        DEFAULT_SEASON_SETTINGS.grading.defaultMaxPoints
      ),
    },
    feedback: {
      maxBonusPoints: asFiniteInt(
        fbk.maxBonusPoints,
        DEFAULT_SEASON_SETTINGS.feedback.maxBonusPoints
      ),
      maxDeductionPoints: asFiniteInt(
        fbk.maxDeductionPoints,
        DEFAULT_SEASON_SETTINGS.feedback.maxDeductionPoints
      ),
    },
    leaderboard: {
      publicTopN: asFiniteInt(
        lb.publicTopN,
        DEFAULT_SEASON_SETTINGS.leaderboard.publicTopN
      ),
      tierThresholds: {
        bronze: asFiniteInt(
          tiers.bronze,
          DEFAULT_SEASON_SETTINGS.leaderboard.tierThresholds.bronze
        ),
        silver: asFiniteInt(
          tiers.silver,
          DEFAULT_SEASON_SETTINGS.leaderboard.tierThresholds.silver
        ),
        gold: asFiniteInt(
          tiers.gold,
          DEFAULT_SEASON_SETTINGS.leaderboard.tierThresholds.gold
        ),
        diamond: asFiniteInt(
          tiers.diamond,
          DEFAULT_SEASON_SETTINGS.leaderboard.tierThresholds.diamond
        ),
      },
    },
  };
}

export function validateSeasonSettings(
  settings: SeasonSettings
): { ok: true } | { ok: false; error: string } {
  const { attendance, tasks, grading, feedback, leaderboard } = settings;

  if (attendance.defaultBasePoints < 0 || attendance.defaultBasePoints > 500) {
    return { ok: false, error: "Session base points must be between 0 and 500." };
  }
  if (
    attendance.defaultPunctualityBonus < 0 ||
    attendance.defaultPunctualityBonus > 200
  ) {
    return {
      ok: false,
      error: "Punctuality bonus must be between 0 and 200.",
    };
  }
  if (
    attendance.punctualityCutoffMinutes < 0 ||
    attendance.punctualityCutoffMinutes > 180
  ) {
    return {
      ok: false,
      error: "Punctuality cutoff must be between 0 and 180 minutes.",
    };
  }
  if (
    attendance.defaultCheckinWindowMinutes < 5 ||
    attendance.defaultCheckinWindowMinutes > 360
  ) {
    return {
      ok: false,
      error: "Default check-in window must be between 5 and 360 minutes.",
    };
  }
  if (attendance.qrRotationSeconds < 15 || attendance.qrRotationSeconds > 300) {
    return {
      ok: false,
      error: "QR code rotation interval must be between 15 and 300 seconds.",
    };
  }

  if (tasks.defaultTaskPoints < 1 || tasks.defaultTaskPoints > 1000) {
    return {
      ok: false,
      error: "Default task points must be between 1 and 1000.",
    };
  }
  if (
    tasks.defaultCompletionMode !== "self_report" &&
    tasks.defaultCompletionMode !== "hr_only"
  ) {
    return {
      ok: false,
      error: "Default task completion mode must be self_report or hr_only.",
    };
  }

  if (
    grading.effortWeight < 0 ||
    grading.effortWeight > 100 ||
    grading.qualityWeight < 0 ||
    grading.qualityWeight > 100 ||
    grading.timelinessWeight < 0 ||
    grading.timelinessWeight > 100
  ) {
    return {
      ok: false,
      error: "Grading rubric weights must each be between 0 and 100.",
    };
  }
  if (
    grading.effortWeight + grading.qualityWeight + grading.timelinessWeight <= 0
  ) {
    return {
      ok: false,
      error: "At least one grading rubric weight must be greater than 0.",
    };
  }
  if (grading.defaultMaxPoints < 1 || grading.defaultMaxPoints > 1000) {
    return {
      ok: false,
      error: "Default max deliverable points must be between 1 and 1000.",
    };
  }

  if (feedback.maxBonusPoints < 0 || feedback.maxBonusPoints > 500) {
    return {
      ok: false,
      error: "Feedback max bonus cap must be between 0 and 500.",
    };
  }
  if (feedback.maxDeductionPoints < 0 || feedback.maxDeductionPoints > 500) {
    return {
      ok: false,
      error: "Feedback max deduction cap must be between 0 and 500.",
    };
  }

  if (leaderboard.publicTopN < 3 || leaderboard.publicTopN > 50) {
    return {
      ok: false,
      error: "Public leaderboard size must be between 3 and 50.",
    };
  }

  const { bronze, silver, gold, diamond } = leaderboard.tierThresholds;
  if (bronze < 0 || !(bronze < silver && silver < gold && gold < diamond)) {
    return {
      ok: false,
      error:
        "Tier thresholds must strictly increase: Bronze < Silver < Gold < Diamond.",
    };
  }

  return { ok: true };
}

export function calculateRubricPoints(params: {
  effortScore: number;
  qualityScore: number;
  timelinessScore: number;
  maxPoints: number;
  grading?: SeasonGradingSettings;
}): number {
  const weights = params.grading ?? DEFAULT_SEASON_SETTINGS.grading;
  const raw =
    params.effortScore * weights.effortWeight +
    params.qualityScore * weights.qualityWeight +
    params.timelinessScore * weights.timelinessWeight;
  return Math.min(params.maxPoints, Math.max(0, Math.round(raw)));
}

export function deriveActivityTier(
  points: number,
  thresholds: SeasonTierThresholds = DEFAULT_SEASON_SETTINGS.leaderboard
    .tierThresholds
): "Diamond" | "Gold" | "Silver" | "Bronze" | "Member" {
  if (points >= thresholds.diamond) return "Diamond";
  if (points >= thresholds.gold) return "Gold";
  if (points >= thresholds.silver) return "Silver";
  if (points >= thresholds.bronze) return "Bronze";
  return "Member";
}

/**
 * Maps legacy committee name/category to one of the 3 default track slugs:
 * `technical`, `creative`, or `operations`.
 */
export function inferDefaultTrackSlug(committee: {
  name: string;
  slug: string;
  category: string;
}): "technical" | "creative" | "operations" {
  if (committee.category === "technical") return "technical";
  const text = `${committee.name} ${committee.slug}`.toLowerCase();
  if (
    /media|marketing|design|creative|graphic|brand|video|photo|content/.test(
      text
    )
  ) {
    return "creative";
  }
  return "operations";
}
