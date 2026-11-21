import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
  ScoreComponent,
  SeasonalEvaluation,
} from "@/types";

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function formatAuthorRoleLabel(role?: string | null): string {
  switch (role) {
    case "master_admin":
      return "Chapter Administration";
    case "director":
      return "Chapter Director";
    case "hr_admin":
      return "HR Lead";
    case "committee_head":
      return "Committee Head";
    default:
      return "HR Team";
  }
}

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
        seasonName: schema.seasons.name,
      })
      .from(schema.rosterMemberships)
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .leftJoin(
        schema.seasons,
        eq(schema.rosterMemberships.seasonId, schema.seasons.id)
      )
      .where(
        and(
          eq(schema.rosterMemberships.id, memberId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);

    const member = memberRows[0];
    if (member && member.role !== "attendee") {
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
        seasonLabel: member.seasonName ?? "Current Season",
        committee,
      };
    }
  } catch {
    // Database unreachable or invalid UUID
  }
  return null;
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
      .where(
        and(
          eq(schema.rosterMemberships.id, memberId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);

    const member = memberRows[0];
    if (member && member.role !== "attendee") {
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
    // Database unreachable or invalid UUID
  }
  return null;
}

export async function getMemberMonthlyScores(
  memberId: string
): Promise<MonthlyScoreRecord[]> {
  try {
    const [member] = await db
      .select({
        seasonId: schema.rosterMemberships.seasonId,
        committeeId: schema.rosterMemberships.committeeId,
      })
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.id, memberId),
          eq(schema.rosterMemberships.isActive, true)
        )
      )
      .limit(1);

    if (!member) return [];

    const [allSeasonLedger, publishedSnapshots, committeeMembers] =
      await Promise.all([
        db
          .select()
          .from(schema.scoreLedger)
          .where(eq(schema.scoreLedger.seasonId, member.seasonId)),
        db
          .select({ month: schema.monthlySnapshots.month })
          .from(schema.monthlySnapshots)
          .where(
            and(
              eq(schema.monthlySnapshots.seasonId, member.seasonId),
              eq(schema.monthlySnapshots.status, "published")
            )
          ),
        member.committeeId
          ? db
              .select({ id: schema.rosterMemberships.id })
              .from(schema.rosterMemberships)
              .where(
                and(
                  eq(schema.rosterMemberships.seasonId, member.seasonId),
                  eq(schema.rosterMemberships.committeeId, member.committeeId),
                  eq(schema.rosterMemberships.isActive, true)
                )
              )
          : Promise.resolve([]),
      ]);

    const memberLedger = allSeasonLedger.filter(
      (l) => l.membershipId === memberId
    );
    const months = Array.from(new Set(memberLedger.map((l) => l.month))).sort();
    if (months.length === 0) return [];

    const publishedMonthSet = new Set(publishedSnapshots.map((s) => s.month));
    const commIds = new Set(committeeMembers.map((c) => c.id));

    const results: MonthlyScoreRecord[] = [];
    let prevOverallRank: number | null = null;

    for (const month of months) {
      const monthEntries = memberLedger.filter((l) => l.month === month);
      const totalScore = monthEntries.reduce((sum, e) => sum + e.points, 0);

      const pointsMap = new Map<string, number>();
      for (const e of allSeasonLedger) {
        if (e.month !== month) continue;
        pointsMap.set(
          e.membershipId,
          (pointsMap.get(e.membershipId) ?? 0) + e.points
        );
      }

      const sortedOverall = Array.from(pointsMap.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      const overallIdx = sortedOverall.findIndex(([id]) => id === memberId);
      const overallRank = overallIdx >= 0 ? overallIdx + 1 : sortedOverall.length + 1;
      const overallTotal = Math.max(sortedOverall.length, 1);

      let committeeRank = 1;
      let committeeTotal = 1;
      if (member.committeeId && commIds.size > 0) {
        const sortedComm = Array.from(pointsMap.entries())
          .filter(([id]) => commIds.has(id))
          .sort((a, b) => b[1] - a[1]);
        const commIdx = sortedComm.findIndex(([id]) => id === memberId);
        committeeRank = commIdx >= 0 ? commIdx + 1 : sortedComm.length + 1;
        committeeTotal = Math.max(sortedComm.length, 1);
      }

      const components: ScoreComponent[] = [
        {
          key: "attendance",
          label: "Attendance & Punctuality",
          points: monthEntries
            .filter((l) => l.sourceType === "attendance")
            .reduce((s, i) => s + i.points, 0),
          maxPoints: 20,
        },
        {
          key: "tasks",
          label: "Task Contribution",
          points: monthEntries
            .filter((l) => l.sourceType === "task")
            .reduce((s, i) => s + i.points, 0),
          maxPoints: 40,
        },
        {
          key: "bonuses",
          label: "HR Recognition & Bonuses",
          points: monthEntries
            .filter(
              (l) =>
                l.sourceType === "manual_override" || l.sourceType === "event"
            )
            .reduce((s, i) => s + i.points, 0),
          maxPoints: 10,
        },
      ];

      results.push({
        month: month as MonthKey,
        monthLabel: formatMonthLabel(month),
        isPublished: publishedMonthSet.has(month),
        totalScore,
        overallRank,
        overallTotal,
        committeeRank,
        committeeTotal,
        previousOverallRank: prevOverallRank,
        components,
      });

      prevOverallRank = overallRank;
    }

    return results.sort((a, b) => b.month.localeCompare(a.month));
  } catch {
    // Graceful fallback
  }
  return [];
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
      .where(eq(schema.attendanceRecords.membershipId, memberId))
      .orderBy(desc(schema.branchSessions.startsAt));

    if (records.length > 0) {
      return records.map(({ record, session }) => ({
        id: record.id,
        month: session.startsAt.toISOString().slice(0, 7) as MonthKey,
        title: session.title,
        date: session.startsAt.toISOString().slice(0, 10),
        sessionType: "workshop" as const,
        status: "attended" as const,
        arrival: record.isPunctual ? ("on_time" as const) : ("late" as const),
        bonusPoints: record.pointsAwarded,
      }));
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getMemberTasks(memberId: string): Promise<MemberTask[]> {
  try {
    const tasks = await db
      .select({
        submission: schema.taskSubmissions,
        task: schema.tasks,
      })
      .from(schema.taskSubmissions)
      .innerJoin(schema.tasks, eq(schema.taskSubmissions.taskId, schema.tasks.id))
      .where(eq(schema.taskSubmissions.membershipId, memberId))
      .orderBy(desc(schema.tasks.dueAt));

    if (tasks.length > 0) {
      return tasks.map(({ submission, task }) => ({
        id: task.id,
        submissionId: submission.id,
        month: (task.dueAt
          ? task.dueAt.toISOString().slice(0, 7)
          : new Date().toISOString().slice(0, 7)) as MonthKey,
        title: task.title,
        workType: task.workType === "task" ? ("task" as const) : ("assignment" as const),
        status: submission.gradedAt
          ? ("completed" as const)
          : submission.submittedAt
          ? ("in_progress" as const)
          : ("not_started" as const),
        assignedDate: task.createdAt
          ? task.createdAt.toISOString().slice(0, 10)
          : "",
        dueDate: task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "",
        completedDate: submission.gradedAt
          ? submission.gradedAt.toISOString().slice(0, 10)
          : submission.submittedAt
          ? submission.submittedAt.toISOString().slice(0, 10)
          : undefined,
        effort: submission.effortScore ?? 1,
        quality: submission.qualityScore,
        onTime:
          submission.timelinessScore !== null
            ? submission.timelinessScore >= 3
            : null,
        taskPoints: submission.totalPoints,
        notes: submission.notes ?? undefined,
      }));
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getMemberActivities(
  memberId: string
): Promise<MemberActivity[]> {
  try {
    const rows = await db
      .select()
      .from(schema.memberActivities)
      .where(eq(schema.memberActivities.membershipId, memberId))
      .orderBy(desc(schema.memberActivities.date));

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        month: r.month as MonthKey,
        date: r.date,
        category: r.category as MemberActivity["category"],
        title: r.title,
        role: r.role,
        summary: r.summary,
        pointsAwarded: r.pointsAwarded,
      }));
    }
  } catch {
    // Fall through
  }
  return [];
}

export async function getMemberEvaluations(
  memberId: string
): Promise<SeasonalEvaluation[]> {
  try {
    const rows = await db
      .select()
      .from(schema.seasonalEvaluations)
      .where(eq(schema.seasonalEvaluations.membershipId, memberId))
      .orderBy(desc(schema.seasonalEvaluations.publishedAt));

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        seasonLabel: r.seasonLabel,
        publishedAt: r.publishedAt.toISOString(),
        status: r.status as "complete" | "pending",
        evaluatorRole: r.evaluatorRole,
        finalScore: r.finalScore,
        outOf: r.outOf,
        bonusPoints: r.bonusPoints,
        grade: r.grade as SeasonalEvaluation["grade"],
        criteria: (r.criteria as SeasonalEvaluation["criteria"]) ?? [],
      }));
    }
  } catch {
    // Fall through
  }
  return [];
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

    if (feedbackRows.length === 0) return [];

    const authorIds = Array.from(
      new Set(
        feedbackRows
          .map((f) => f.createdBy)
          .filter((id): id is string => Boolean(id))
      )
    );
    const authorRoleMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const authors = await db
        .select({
          id: schema.rosterMemberships.id,
          role: schema.rosterMemberships.role,
        })
        .from(schema.rosterMemberships)
        .where(inArray(schema.rosterMemberships.id, authorIds));
      for (const a of authors) {
        authorRoleMap.set(a.id, a.role);
      }
    }

    return feedbackRows.map((f) => ({
      id: f.id,
      month: f.createdAt.toISOString().slice(0, 7) as MonthKey,
      publishedAt: f.createdAt.toISOString().slice(0, 10),
      authorRole: formatAuthorRoleLabel(
        f.createdBy ? authorRoleMap.get(f.createdBy) : null
      ),
      reviewType: "recognition" as const,
      message: f.content,
      visibility: "published" as const,
    }));
  } catch {
    // Graceful fallback
  }
  return [];
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
  if (currentRank > 1 && currentMonthScore) {
    targetRank = currentRank - 1;
    // Compute exact gap to the rank immediately above from DB ledger if available
    try {
      const [memberRow] = await db
        .select({ seasonId: schema.rosterMemberships.seasonId })
        .from(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, memberId))
        .limit(1);
      if (memberRow) {
        const monthLedger = await db
          .select({
            membershipId: schema.scoreLedger.membershipId,
            points: schema.scoreLedger.points,
          })
          .from(schema.scoreLedger)
          .where(
            and(
              eq(schema.scoreLedger.seasonId, memberRow.seasonId),
              eq(schema.scoreLedger.month, currentMonthScore.month)
            )
          );
        const totals = new Map<string, number>();
        for (const e of monthLedger) {
          totals.set(e.membershipId, (totals.get(e.membershipId) ?? 0) + e.points);
        }
        const sortedScores = Array.from(totals.values()).sort((a, b) => b - a);
        const aboveScore = sortedScores[currentRank - 2];
        if (aboveScore !== undefined) {
          pointsToNextRank = Math.max(1, aboveScore - livePoints + 1);
        }
      }
    } catch {
      pointsToNextRank = null;
    }
  }

  let activityTier: MemberEngagementMetrics["activityTier"] = "Member";
  if (livePoints >= 90) activityTier = "Diamond";
  else if (livePoints >= 75) activityTier = "Gold";
  else if (livePoints >= 60) activityTier = "Silver";
  else if (livePoints >= 40) activityTier = "Bronze";

  const streak = attendance.filter((a) => a.status === "attended").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const engagement: MemberEngagementMetrics = {
    attendanceStreak: streak,
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
      attendedCount > 0 ? Math.round((onTimeCount / attendedCount) * 100) : 0,
    summaryLabel: `${attendedCount}/${totalSessionsCount} sessions attended`,
  };

  const totalTasksCount = tasks.length;
  const gradedTasks = tasks.filter((t) => t.quality !== null);
  const taskSummary = {
    completedCount: completedTasks,
    totalCount: totalTasksCount,
    onTimeCount: tasks.filter((t) => t.onTime === true).length,
    averageQualityScore:
      gradedTasks.length > 0
        ? Math.round(
            (gradedTasks.reduce((sum, t) => sum + (t.quality ?? 0), 0) /
              gradedTasks.length) *
              10
          ) / 10
        : 0,
    summaryLabel: `${completedTasks}/${totalTasksCount} tasks completed`,
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
