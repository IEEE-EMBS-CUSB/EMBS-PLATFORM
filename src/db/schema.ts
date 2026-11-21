import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const seasonStatusEnum = pgEnum("season_status", [
  "draft",
  "active",
  "archived",
]);

export const committeeCategoryEnum = pgEnum("committee_category", [
  "technical",
  "non_technical",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "master_admin",
  "director",
  "hr_admin",
  "hr_member",
  "committee_head",
  "member",
  "attendee",
]);

export const ledgerSourceTypeEnum = pgEnum("ledger_source_type", [
  "attendance",
  "task",
  "event",
  "manual_override",
]);

export const snapshotStatusEnum = pgEnum("snapshot_status", [
  "draft",
  "published",
]);

// ============================================================================
// 1. Seasons
// Master anchor for all chapter data. Every operational record is scoped to a season.
// ============================================================================

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // e.g. "2026-2027" or "Fall 2026"
    status: seasonStatusEnum("status").notNull().default("draft"),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seasons_name_idx").on(table.name),
    index("seasons_status_idx").on(table.status),
  ]
);

// ============================================================================
// 2. Committees
// Scoped to a season. Strict unique constraint on (seasonId, slug).
// ============================================================================

export const committees = pgTable(
  "committees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "AI and Machine Learning"
    slug: text("slug").notNull(), // e.g. "ai-and-machine-learning"
    category: committeeCategoryEnum("category").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("committees_season_slug_idx").on(table.seasonId, table.slug),
    index("committees_season_id_idx").on(table.seasonId),
  ]
);

// ============================================================================
// 3. Roster Memberships (Whitelist-Only Access & Role Mapping)
// Strict unique constraint on (seasonId, email). Emails always normalized.
// ============================================================================

export const rosterMemberships = pgTable(
  "roster_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // Normalized lowercased & trimmed email
    fullName: text("full_name").notNull(),
    committeeId: uuid("committee_id").references(() => committees.id, {
      onDelete: "set null",
    }), // Nullable for branch-wide HR admins or general attendees
    role: membershipRoleEnum("role").notNull().default("member"),
    passwordHash: text("password_hash"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    passwordChangedAt: timestamp("password_changed_at", {
      withTimezone: true,
      mode: "date",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("roster_season_email_idx").on(table.seasonId, table.email),
    index("roster_season_id_idx").on(table.seasonId),
    index("roster_email_idx").on(table.email),
    index("roster_committee_id_idx").on(table.committeeId),
    index("roster_role_idx").on(table.role),
  ]
);

// ============================================================================
// 4. Scoring Rubrics
// Configurable seasonal rubric categories and weighting managed by HR.
// ============================================================================

export const scoringRubrics = pgTable(
  "scoring_rubrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Attendance & Punctuality", "Task Contribution"
    maxPoints: integer("max_points").notNull(),
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("1.0"),
    leadersOnly: boolean("leaders_only").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("scoring_rubrics_season_id_idx").on(table.seasonId),
    uniqueIndex("scoring_rubrics_season_name_idx").on(table.seasonId, table.name),
  ]
);

// ============================================================================
// 5. Branch Sessions (Named branch_sessions to avoid Better-Auth collision)
// Meetings, workshops, and events with rotating QR check-in codes.
// ============================================================================

export const branchSessions = pgTable(
  "branch_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id").references(() => committees.id, {
      onDelete: "set null",
    }), // Nullable = branch-wide session (All-Community, Opening, Closing)
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    checkinStartsAt: timestamp("checkin_starts_at", {
      withTimezone: true,
      mode: "date",
    }),
    checkinEndsAt: timestamp("checkin_ends_at", {
      withTimezone: true,
      mode: "date",
    }),
    checkinCode: text("checkin_code"), // Rotating 6-digit or crypto nonce for QR
    checkinExpiresAt: timestamp("checkin_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    checkinOpen: boolean("checkin_open").notNull().default(false),
    punctualityCutoffMinutes: integer("punctuality_cutoff_minutes")
      .notNull()
      .default(15),
    basePoints: integer("base_points").notNull().default(10),
    punctualityBonus: integer("punctuality_bonus").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("branch_sessions_season_id_idx").on(table.seasonId),
    index("branch_sessions_committee_id_idx").on(table.committeeId),
    index("branch_sessions_starts_at_idx").on(table.startsAt),
  ]
);

// ============================================================================
// 6. Attendance Records
// Strict unique constraint on (sessionId, membershipId) preventing double check-in exploits.
// ============================================================================

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => branchSessions.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    isPunctual: boolean("is_punctual").notNull().default(true),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    overrideReason: text("override_reason"), // Set if manually modified by HR
  },
  (table) => [
    uniqueIndex("attendance_session_member_idx").on(
      table.sessionId,
      table.membershipId
    ),
    index("attendance_membership_id_idx").on(table.membershipId),
    index("attendance_session_id_idx").on(table.sessionId),
  ]
);

// ============================================================================
// 7. Tasks & 8. Task Submissions (Keyboard-first bulk grading)
// Strict unique constraint on (taskId, membershipId).
// ============================================================================

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id").references(() => committees.id, {
      onDelete: "cascade",
    }), // Nullable if branch-wide
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    maxPoints: integer("max_points").notNull().default(100),
    targetType: text("target_type"), // individual | group
    targetGroup: text("target_group"), // everyone | all_heads | all_members | committee_all | committee_heads | committee_members
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tasks_season_id_idx").on(table.seasonId),
    index("tasks_committee_id_idx").on(table.committeeId),
  ]
);

export const taskSubmissions = pgTable(
  "task_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    // Discrete 1-5 HR rubric ratings
    effortScore: integer("effort_score"), // 1 (small) to 5 (huge)
    qualityScore: integer("quality_score"), // 1 (poor) to 5 (excellent)
    timelinessScore: integer("timeliness_score"), // 1 (very late) to 5 (early)
    totalPoints: integer("total_points"), // Derived or explicitly graded
    submissionText: text("submission_text"),
    submissionUrl: text("submission_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    gradedBy: uuid("graded_by").references(() => rosterMemberships.id, {
      onDelete: "set null",
    }),
    gradedAt: timestamp("graded_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("task_submissions_task_member_idx").on(
      table.taskId,
      table.membershipId
    ),
    index("task_submissions_membership_id_idx").on(table.membershipId),
    index("task_submissions_task_id_idx").on(table.taskId),
  ]
);

// ============================================================================
// 9. Score Ledger (Deterministic source of truth for all member points)
// Partial unique index on (membershipId, sourceType, sourceId) where sourceId is not null
// prevents double-counting on attendance and task grade edits.
// ============================================================================

export const scoreLedger = pgTable(
  "score_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // Format: "YYYY-MM"
    sourceType: ledgerSourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id"), // Reference to attendance_record id, task_submission id, etc.
    points: integer("points").notNull(), // Can be positive or negative
    reason: text("reason").notNull(),
    createdBy: uuid("created_by").references(() => rosterMemberships.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("score_ledger_season_month_idx").on(table.seasonId, table.month),
    index("score_ledger_membership_id_idx").on(table.membershipId),
    index("score_ledger_source_idx").on(table.sourceType, table.sourceId),
    uniqueIndex("score_ledger_source_unique_idx")
      .on(table.membershipId, table.sourceType, table.sourceId)
      .where(sql`${table.sourceId} IS NOT NULL`),
  ]
);

// ============================================================================
// 10. Monthly Snapshots (Permanent Historical Lock)
// Strict unique constraint on (seasonId, month).
// ============================================================================

export const monthlySnapshots = pgTable(
  "monthly_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "YYYY-MM"
    status: snapshotStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    publishedBy: uuid("published_by").references(() => rosterMemberships.id, {
      onDelete: "set null",
    }),
    // Preserves the frozen leaderboard state: overall top 10, committee top 10s, trends, and summary statistics
    snapshotJson: jsonb("snapshot_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("monthly_snapshots_season_month_idx").on(
      table.seasonId,
      table.month
    ),
    index("monthly_snapshots_status_idx").on(table.status),
  ]
);

// ============================================================================
// 11. HR Feedback & Warnings (Strict Data-Layer Privacy Guarded)
// Private notes and warnings are filtered at query-time and never sent to members.
// ============================================================================

export const hrFeedback = pgTable(
  "hr_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isPublished: boolean("is_published").notNull().default(false), // true = visible to member in portal
    isWarning: boolean("is_warning").notNull().default(false), // true = internal HR warning flag
    createdBy: uuid("created_by")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("hr_feedback_membership_id_idx").on(table.membershipId),
    index("hr_feedback_season_id_idx").on(table.seasonId),
    index("hr_feedback_published_idx").on(table.isPublished, table.isWarning),
  ]
);

// ============================================================================
// 11b. Events (Season-scoped chapter/committee events logged by HR)
// ============================================================================

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id").references(() => committees.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true, mode: "date" }).notNull(),
    points: integer("points").notNull().default(0),
    createdBy: uuid("created_by").references(() => rosterMemberships.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_season_id_idx").on(table.seasonId),
    index("events_committee_id_idx").on(table.committeeId),
  ]
);

// ============================================================================
// 11c. Member Activities & Seasonal Evaluations (Member portal data)
// ============================================================================

export const memberActivities = pgTable(
  "member_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    date: text("date").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    role: text("role").notNull(),
    summary: text("summary").notNull(),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("member_activities_membership_id_idx").on(table.membershipId),
    index("member_activities_season_id_idx").on(table.seasonId),
  ]
);

export const seasonalEvaluations = pgTable(
  "seasonal_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => rosterMemberships.id, { onDelete: "cascade" }),
    seasonLabel: text("season_label").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }).notNull(),
    status: text("status").notNull().default("complete"),
    evaluatorRole: text("evaluator_role").notNull(),
    finalScore: integer("final_score"),
    outOf: integer("out_of").notNull().default(100),
    bonusPoints: integer("bonus_points").notNull().default(0),
    grade: text("grade"),
    criteria: jsonb("criteria").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("seasonal_evaluations_membership_id_idx").on(table.membershipId),
    index("seasonal_evaluations_season_id_idx").on(table.seasonId),
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const seasonsRelations = relations(seasons, ({ many }) => ({
  committees: many(committees),
  memberships: many(rosterMemberships),
  scoringRubrics: many(scoringRubrics),
  branchSessions: many(branchSessions),
  tasks: many(tasks),
  scoreLedger: many(scoreLedger),
  monthlySnapshots: many(monthlySnapshots),
  feedback: many(hrFeedback),
}));

export const committeesRelations = relations(committees, ({ one, many }) => ({
  season: one(seasons, {
    fields: [committees.seasonId],
    references: [seasons.id],
  }),
  memberships: many(rosterMemberships),
  branchSessions: many(branchSessions),
  tasks: many(tasks),
}));

export const rosterMembershipsRelations = relations(
  rosterMemberships,
  ({ one, many }) => ({
    season: one(seasons, {
      fields: [rosterMemberships.seasonId],
      references: [seasons.id],
    }),
    committee: one(committees, {
      fields: [rosterMemberships.committeeId],
      references: [committees.id],
    }),
    attendance: many(attendanceRecords),
    taskSubmissions: many(taskSubmissions),
    ledgerEntries: many(scoreLedger),
    feedbackReceived: many(hrFeedback, { relationName: "feedbackRecipient" }),
    feedbackAuthored: many(hrFeedback, { relationName: "feedbackAuthor" }),
  })
);

export const scoringRubricsRelations = relations(scoringRubrics, ({ one }) => ({
  season: one(seasons, {
    fields: [scoringRubrics.seasonId],
    references: [seasons.id],
  }),
}));

export const branchSessionsRelations = relations(
  branchSessions,
  ({ one, many }) => ({
    season: one(seasons, {
      fields: [branchSessions.seasonId],
      references: [seasons.id],
    }),
    committee: one(committees, {
      fields: [branchSessions.committeeId],
      references: [committees.id],
    }),
    attendance: many(attendanceRecords),
  })
);

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    session: one(branchSessions, {
      fields: [attendanceRecords.sessionId],
      references: [branchSessions.id],
    }),
    membership: one(rosterMemberships, {
      fields: [attendanceRecords.membershipId],
      references: [rosterMemberships.id],
    }),
  })
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  season: one(seasons, {
    fields: [tasks.seasonId],
    references: [seasons.id],
  }),
  committee: one(committees, {
    fields: [tasks.committeeId],
    references: [committees.id],
  }),
  submissions: many(taskSubmissions),
}));

export const taskSubmissionsRelations = relations(
  taskSubmissions,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskSubmissions.taskId],
      references: [tasks.id],
    }),
    membership: one(rosterMemberships, {
      fields: [taskSubmissions.membershipId],
      references: [rosterMemberships.id],
    }),
    grader: one(rosterMemberships, {
      fields: [taskSubmissions.gradedBy],
      references: [rosterMemberships.id],
    }),
  })
);

export const scoreLedgerRelations = relations(scoreLedger, ({ one }) => ({
  season: one(seasons, {
    fields: [scoreLedger.seasonId],
    references: [seasons.id],
  }),
  membership: one(rosterMemberships, {
    fields: [scoreLedger.membershipId],
    references: [rosterMemberships.id],
  }),
  creator: one(rosterMemberships, {
    fields: [scoreLedger.createdBy],
    references: [rosterMemberships.id],
  }),
}));

export const monthlySnapshotsRelations = relations(
  monthlySnapshots,
  ({ one }) => ({
    season: one(seasons, {
      fields: [monthlySnapshots.seasonId],
      references: [seasons.id],
    }),
    publisher: one(rosterMemberships, {
      fields: [monthlySnapshots.publishedBy],
      references: [rosterMemberships.id],
    }),
  })
);

export const hrFeedbackRelations = relations(hrFeedback, ({ one }) => ({
  season: one(seasons, {
    fields: [hrFeedback.seasonId],
    references: [seasons.id],
  }),
  membership: one(rosterMemberships, {
    fields: [hrFeedback.membershipId],
    references: [rosterMemberships.id],
    relationName: "feedbackRecipient",
  }),
  author: one(rosterMemberships, {
    fields: [hrFeedback.createdBy],
    references: [rosterMemberships.id],
    relationName: "feedbackAuthor",
  }),
}));

