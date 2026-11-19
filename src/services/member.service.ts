import * as store from "@/db/store";
import {
  CHAPTER_COMMITTEES,
  STORED_MEMBERS,
  findCommitteeBySlug,
} from "@/db/seed-data";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import type {
  MemberActivity,
  MemberAttendanceRecord,
  MemberDashboardData,
  MemberEngagementMetrics,
  MemberProfile,
  MemberTask,
  MonthKey,
  MonthlyScoreRecord,
  PublishedFeedback,
  SeasonalEvaluation,
} from "@/types";

export async function getMemberProfile(
  memberId: string
): Promise<MemberProfile | null> {
  try {
    const memberRows = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.rosterMemberships.fullName,
        role: schema.rosterMemberships.role,
        committeeId: schema.committees.id,
        committeeSlug: schema.committees.slug,
        committeeName: schema.committees.name,
        committeeCategory: schema.committees.category,
      })
      .from(schema.rosterMemberships)
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .where(eq(schema.rosterMemberships.id, memberId));

    const member = memberRows[0];
    if (member) {
      const committee =
        member.committeeId && member.committeeSlug && member.committeeName
          ? {
              id: member.committeeId,
              slug: member.committeeSlug,
              name: member.committeeName,
              shortName: member.committeeName,
              track: member.committeeCategory as "technical" | "non_technical",
              description: "",
            }
          : {
              id: "leadership",
              slug: "leadership",
              name: "Chapter Leadership",
              shortName: "Leadership",
              track: "non_technical" as const,
              description: "Chapter Executive Leadership and Administration",
            };

      return {
        id: member.id,
        displayId: `EMBS-${member.id.slice(0, 6)}`,
        fullName: member.fullName,
        role: member.role === "committee_head" ? "Head" : "Member",
        seasonLabel: "Fall 2026",
        committee,
      };
    }
  } catch {
    // Fall back to store
  }
  return store.getMemberProfile(memberId);
}

export interface OperationalUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  committeeId: string | null;
  committeeName?: string;
  seasonId?: string;
}

export async function getOperationalUserProfile(
  memberId: string
): Promise<OperationalUserProfile | null> {
  try {
    const memberRows = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.rosterMemberships.fullName,
        email: schema.rosterMemberships.email,
        role: schema.rosterMemberships.role,
        committeeId: schema.rosterMemberships.committeeId,
        committeeName: schema.committees.name,
        seasonId: schema.rosterMemberships.seasonId,
      })
      .from(schema.rosterMemberships)
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .where(eq(schema.rosterMemberships.id, memberId));

    const member = memberRows[0];
    if (member) {
      return {
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        role: member.role as MembershipRole,
        committeeId: member.committeeId,
        committeeName: member.committeeName ?? undefined,
        seasonId: member.seasonId,
      };
    }
  } catch {
    // Fall back to store
  }

  const storedMember = STORED_MEMBERS[memberId];
  if (storedMember) {
    const committee =
      CHAPTER_COMMITTEES.find((c) => c.id === storedMember.committeeId) ??
      findCommitteeBySlug(storedMember.committeeId);
    const role: MembershipRole =
      storedMember.role === "Head"
        ? "committee_head"
        : storedMember.role === "Member"
        ? "member"
        : "member";
    return {
      id: storedMember.id,
      fullName: storedMember.fullName,
      email: storedMember.email,
      role,
      committeeId: storedMember.committeeId,
      committeeName: committee?.name ?? undefined,
      seasonId: "season-2026",
    };
  }

  return null;
}

export async function getMemberMonthlyScores(
  memberId: string
): Promise<MonthlyScoreRecord[]> {
  try {
    const ledger = await db
      .select()
      .from(schema.scoreLedger)
      .where(eq(schema.scoreLedger.membershipId, memberId))
      .orderBy(desc(schema.scoreLedger.createdAt));

    if (ledger.length > 0) {
      const totalScore = ledger.reduce((sum, item) => sum + item.points, 0);
      return [
        {
          month: "2026-10" as MonthKey,
          monthLabel: "October 2026",
          isPublished: true,
          totalScore,
          overallRank: 1,
          overallTotal: 10,
          committeeRank: 1,
          committeeTotal: 2,
          previousOverallRank: null,
          components: [
            {
              key: "attendance",
              label: "Attendance & Punctuality",
              points: ledger
                .filter((l) => l.sourceType === "attendance")
                .reduce((s, i) => s + i.points, 0),
              maxPoints: 20,
            },
            {
              key: "tasks",
              label: "Task Contribution",
              points: ledger
                .filter((l) => l.sourceType === "task")
                .reduce((s, i) => s + i.points, 0),
              maxPoints: 40,
            },
            {
              key: "bonuses",
              label: "HR Recognition & Bonuses",
              points: ledger
                .filter((l) => l.sourceType === "manual_override")
                .reduce((s, i) => s + i.points, 0),
              maxPoints: 10,
            },
          ],
        },
      ];
    }
  } catch {
    // Fall back to store
  }
  return store.getMemberMonthlyScores(memberId);
}

export async function getMemberAttendance(
  memberId: string
): Promise<MemberAttendanceRecord[]> {
  try {
    const records = await db
      .select({
        record: schema.attendanceRecords,
        session: schema.branchSessions,
      })
      .from(schema.attendanceRecords)
      .innerJoin(
        schema.branchSessions,
        eq(schema.attendanceRecords.sessionId, schema.branchSessions.id)
      )
      .where(eq(schema.attendanceRecords.membershipId, memberId));

    if (records.length > 0) {
      return records.map(({ record, session }) => ({
        id: record.id,
        month: "2026-10" as MonthKey,
        title: session.title,
        date: session.startsAt.toISOString().slice(0, 10),
        sessionType: "workshop" as const,
        status: "attended" as const,
        arrival: record.isPunctual ? ("on_time" as const) : ("late" as const),
      }));
    }
  } catch {
    // Fall back to store
  }
  return store.getMemberAttendance(memberId);
}

export async function getMemberTasks(memberId: string): Promise<MemberTask[]> {
  try {
    const tasks = await db
      .select({
        submission: schema.taskSubmissions,
        task: schema.tasks,
      })
      .from(schema.taskSubmissions)
      .innerJoin(
        schema.tasks,
        eq(schema.taskSubmissions.taskId, schema.tasks.id)
      )
      .where(eq(schema.taskSubmissions.membershipId, memberId));

    if (tasks.length > 0) {
      return tasks.map(({ submission, task }) => ({
        id: task.id,
        month: "2026-10" as MonthKey,
        title: task.title,
        status: "completed" as const,
        assignedDate: "2026-10-15",
        dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
        completedDate: submission.gradedAt
          ? submission.gradedAt.toISOString().slice(0, 10)
          : undefined,
        effort: submission.effortScore ?? 1,
        quality: submission.qualityScore,
        onTime:
          submission.timelinessScore !== null
            ? submission.timelinessScore > 0
            : null,
        taskPoints: submission.totalPoints,
      }));
    }
  } catch {
    // Fall back to store
  }
  return store.getMemberTasks(memberId);
}

export async function getMemberActivities(
  memberId: string
): Promise<MemberActivity[]> {
  return store.getMemberActivities(memberId);
}

export async function getMemberEvaluations(
  memberId: string
): Promise<SeasonalEvaluation[]> {
  return store.getMemberEvaluations(memberId);
}

export async function getMemberFeedback(
  memberId: string
): Promise<PublishedFeedback[]> {
  try {
    const feedbackRows = await db
      .select()
      .from(schema.hrFeedback)
      .where(
        and(
          eq(schema.hrFeedback.membershipId, memberId),
          eq(schema.hrFeedback.isPublished, true),
          eq(schema.hrFeedback.isWarning, false)
        )
      )
      .orderBy(desc(schema.hrFeedback.createdAt));

    if (feedbackRows.length > 0) {
      return feedbackRows.map((f) => ({
        id: f.id,
        month: "2026-10" as MonthKey,
        publishedAt: f.createdAt.toISOString().slice(0, 10),
        authorRole: "HR Team",
        reviewType: "recognition" as const,
        message: f.content,
        visibility: "published" as const,
      }));
    }
  } catch {
    // Fall back to store
  }
  return store.getMemberFeedback(memberId);
}

export async function getMemberDashboard(
  memberId: string,
  month?: MonthKey
): Promise<MemberDashboardData | null> {
  const profile = await getMemberProfile(memberId);
  if (!profile) return null;

  const [monthlyHistory, activities, feedback, attendance, tasks] =
    await Promise.all([
      getMemberMonthlyScores(memberId),
      getMemberActivities(memberId),
      getMemberFeedback(memberId),
      getMemberAttendance(memberId),
      getMemberTasks(memberId),
    ]);

  const currentMonthScore = month
    ? monthlyHistory.find((r) => r.month === month) ?? monthlyHistory[0] ?? null
    : monthlyHistory[0] ?? null;

  const livePoints = currentMonthScore?.totalScore ?? 0;
  const currentRank = currentMonthScore?.overallRank ?? 1;

  let pointsToNextRank: number | null = null;
  let targetRank: number | null = null;
  if (currentRank > 1) {
    targetRank = currentRank - 1;
    pointsToNextRank = 5;
  }

  let activityTier: MemberEngagementMetrics["activityTier"] = "Member";
  if (livePoints >= 90) activityTier = "Diamond";
  else if (livePoints >= 75) activityTier = "Gold";
  else if (livePoints >= 60) activityTier = "Silver";
  else if (livePoints >= 40) activityTier = "Bronze";

  const streak = attendance.filter((a) => a.status === "attended").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100;

  const engagement: MemberEngagementMetrics = {
    attendanceStreak: Math.max(1, streak),
    livePoints,
    currentRank,
    pointsToNextRank,
    targetRank,
    activityTier,
    committeeCompletionRate: taskCompletionRate,
  };

  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const totalSessionsCount = attendance.length;
  const onTimeCount = attendance.filter((a) => a.arrival === "on_time").length;
  const lateCount = attendance.filter((a) => a.arrival === "late").length;
  const excusedCount = attendance.filter((a) => a.status === "excused").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const attendanceSummary = {
    attendedCount,
    totalCount: totalSessionsCount,
    onTimeCount,
    lateCount,
    excusedCount,
    absentCount,
    punctualityRatePct:
      attendedCount > 0 ? Math.round((onTimeCount / attendedCount) * 100) : 100,
    summaryLabel: `${attendedCount}/${totalSessionsCount || 1} sessions attended`,
  };

  const totalTasksCount = tasks.length;
  const taskSummary = {
    completedCount: completedTasks,
    totalCount: totalTasksCount,
    onTimeCount: tasks.filter((t) => t.onTime === true).length,
    averageQualityScore:
      completedTasks > 0
        ? Math.round(
            (tasks.reduce((sum, t) => sum + (t.quality ?? 0), 0) /
              completedTasks) *
              10
          ) / 10
        : 5,
    summaryLabel: `${completedTasks}/${totalTasksCount || 1} tasks completed`,
  };

  const bonusComponent = currentMonthScore?.components.find(
    (c) => c.key === "bonuses"
  );
  const bonusesPoints = bonusComponent?.points ?? 0;
  const projectAndHackathonCount = activities.filter(
    (a) => a.category === "project" || a.category === "hackathon"
  ).length;
  const deliveredSessionsCount = activities.filter(
    (a) => a.category === "delivered_session"
  ).length;
  const bonusesCount = activities.filter((a) => a.category === "bonus").length;

  return {
    profile,
    currentMonthScore,
    monthlyHistory,
    attendanceSummary,
    taskSummary,
    projectAndHackathonCount,
    deliveredSessionsCount,
    bonusesPoints,
    bonusesCount,
    recentActivities: activities.slice(0, 5),
    recentFeedback: feedback.slice(0, 3),
    engagement,
  };
}

