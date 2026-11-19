import {
  CHAPTER_COMMITTEES,
  STORED_MEMBERS,
  STORED_ATTENDEES,
  findCommitteeBySlug,
} from "./seed-data";
import { MOCK_LEADERBOARD_SNAPSHOTS } from "./leaderboard-snapshots";
import type {
  Committee,
  MemberProfile,
  MonthlyScoreRecord,
  MemberAttendanceRecord,
  MemberTask,
  MemberActivity,
  SeasonalEvaluation,
  PublishedFeedback,
  MemberDashboardData,
  AttendeeProfile,
  AttendeeSessionRecord,
  AttendeeAssignment,
  AttendeeDashboardData,
  MonthlyLeaderboard,
  PublishedMonthOption,
  MonthKey,
  MemberEngagementMetrics,
  LeaderboardHistorySummary,
  CommitteeLeaderSpotlight,
} from "@/types";

export const LEADERBOARD_TOP_LIMIT = 10;

export function getCommittees(): Committee[] {
  return CHAPTER_COMMITTEES.map((c) => ({ ...c }));
}

export function getCommitteeBySlug(slug: string): Committee | null {
  const c = findCommitteeBySlug(slug);
  return c ? { ...c } : null;
}

export function getMemberProfile(memberId: string): MemberProfile | null {
  const member = STORED_MEMBERS[memberId];
  if (!member) return null;

  const committee = findCommitteeBySlug(member.committeeId) ??
    CHAPTER_COMMITTEES.find((c) => c.id === member.committeeId);
  if (!committee) return null;

  return {
    id: member.id,
    displayId: member.displayId,
    fullName: member.fullName,
    role: member.role,
    seasonLabel: member.seasonLabel,
    committee: { ...committee },
  };
}

export function getMemberMonthlyScores(memberId: string): MonthlyScoreRecord[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];
  return [...member.monthlyScores].sort((a, b) => b.month.localeCompare(a.month));
}

export function getMemberAttendance(memberId: string): MemberAttendanceRecord[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];
  return [...member.attendance].sort((a, b) => b.date.localeCompare(a.date));
}

export function getMemberTasks(memberId: string): MemberTask[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];
  return [...member.tasks].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export function getMemberActivities(memberId: string): MemberActivity[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];
  return [...member.activities].sort((a, b) => b.date.localeCompare(a.date));
}

export function getMemberEvaluations(memberId: string): SeasonalEvaluation[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];
  return member.evaluations.map((e) => ({
    ...e,
    criteria: e.criteria.map((c) => ({ ...c })),
  }));
}

export function getMemberFeedback(memberId: string): PublishedFeedback[] {
  const member = STORED_MEMBERS[memberId];
  if (!member) return [];

  return member.feedback
    .filter((item) => item.isPublished === true && item.isWarning === false)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((item) => ({
      id: item.id,
      month: item.month,
      publishedAt: item.publishedAt,
      authorRole: item.authorRole,
      reviewType: item.reviewType,
      message: item.message,
      decision: item.decision,
      visibility: "published" as const,
    }));
}

export function getMemberDashboard(
  memberId: string,
  month?: MonthKey
): MemberDashboardData | null {
  const member = STORED_MEMBERS[memberId];
  if (!member) return null;

  const profile = getMemberProfile(memberId);
  if (!profile) return null;

  const monthlyHistory = getMemberMonthlyScores(memberId);
  const activities = getMemberActivities(memberId);
  const publishedFeedback = getMemberFeedback(memberId);

  const currentMonthScore = month
    ? monthlyHistory.find((r) => r.month === month) ?? monthlyHistory[0] ?? null
    : monthlyHistory[0] ?? null;

  const bonusComponent = currentMonthScore?.components.find(
    (c) => c.key === "bonuses"
  );

  const projectAndHackathonCount = activities.filter(
    (a) => a.category === "project" || a.category === "hackathon"
  ).length;

  const deliveredSessionsCount = activities.filter(
    (a) => a.category === "delivered_session"
  ).length;

  const bonusesCount = activities.filter((a) => a.category === "bonus").length;

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

  const streak = member.attendance.filter((a) => a.status === "attended").length;
  const taskCompletionRate =
    member.taskSummary.totalCount > 0
      ? Math.round(
          (member.taskSummary.completedCount / member.taskSummary.totalCount) *
            100
        )
      : 100;

  const engagement: MemberEngagementMetrics = {
    attendanceStreak: Math.max(1, streak),
    livePoints,
    currentRank,
    pointsToNextRank,
    targetRank,
    activityTier,
    committeeCompletionRate: taskCompletionRate,
  };

  return {
    profile,
    currentMonthScore,
    monthlyHistory,
    attendanceSummary: { ...member.attendanceSummary },
    taskSummary: { ...member.taskSummary },
    projectAndHackathonCount,
    deliveredSessionsCount,
    bonusesPoints: bonusComponent?.points ?? 0,
    bonusesCount,
    recentActivities: activities.slice(0, 4),
    recentFeedback: publishedFeedback.slice(0, 2),
    engagement,
  };
}

export function getAttendeeProfile(attendeeId: string): AttendeeProfile | null {
  const attendee = STORED_ATTENDEES[attendeeId];
  if (!attendee) return null;
  return { ...attendee.profile };
}

export function getAttendeeAttendance(
  attendeeId: string
): AttendeeSessionRecord[] {
  const attendee = STORED_ATTENDEES[attendeeId];
  if (!attendee) return [];
  return [...attendee.sessions].sort((a, b) => b.date.localeCompare(a.date));
}

export function getAttendeeAssignments(
  attendeeId: string
): AttendeeAssignment[] {
  const attendee = STORED_ATTENDEES[attendeeId];
  if (!attendee) return [];
  return [...attendee.assignments].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export function getAttendeeDashboard(
  attendeeId: string
): AttendeeDashboardData | null {
  const attendee = STORED_ATTENDEES[attendeeId];
  if (!attendee) return null;

  return {
    profile: { ...attendee.profile },
    participation: { ...attendee.participation },
    recentSessions: attendee.sessions.slice(0, 4),
    recentAssignments: attendee.assignments.slice(0, 3),
  };
}

function getPublishedSnapshots() {
  return MOCK_LEADERBOARD_SNAPSHOTS.filter(
    (snapshot) => snapshot.status === "published"
  ).sort((a, b) => b.month.localeCompare(a.month));
}

export function getPublishedMonths(): PublishedMonthOption[] {
  return getPublishedSnapshots().map((s) => ({
    month: s.month,
    monthLabel: s.monthLabel,
    publishedAt: s.publishedAt,
  }));
}

export function getOverallLeaderboard(month?: MonthKey): MonthlyLeaderboard | null {
  const published = getPublishedSnapshots();
  if (published.length === 0) return null;

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return null;

  return {
    month: target.month,
    monthLabel: target.monthLabel,
    status: target.status,
    publishedAt: target.publishedAt,
    scope: "overall",
    entries: target.entries
      .slice(0, LEADERBOARD_TOP_LIMIT)
      .map((entry, index) => ({
        rank: index + 1,
        previousRank: entry.previousRank,
        memberId: entry.memberId,
        memberName: entry.memberName,
        committeeSlug: entry.committeeSlug,
        committeeName: entry.committeeName,
        role: entry.role,
        monthlyScore: entry.monthlyScore,
      })),
  };
}

export function getCommitteeLeaderboard(
  committeeSlug: string,
  month?: MonthKey
): MonthlyLeaderboard | null {
  const committee = findCommitteeBySlug(committeeSlug);
  if (!committee) return null;

  const published = getPublishedSnapshots();
  if (published.length === 0) return null;

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return null;

  const committeeEntries = target.entries
    .filter((entry) => entry.committeeSlug === committee.slug)
    .slice(0, LEADERBOARD_TOP_LIMIT)
    .map((entry, index) => ({
      rank: index + 1,
      previousRank: entry.previousCommitteeRank,
      memberId: entry.memberId,
      memberName: entry.memberName,
      committeeSlug: entry.committeeSlug,
      committeeName: entry.committeeName,
      role: entry.role,
      monthlyScore: entry.monthlyScore,
    }));

  return {
    month: target.month,
    monthLabel: target.monthLabel,
    status: target.status,
    publishedAt: target.publishedAt,
    scope: "committee",
    committee: { ...committee },
    entries: committeeEntries,
  };
}

export function getLeaderboardHistory(): LeaderboardHistorySummary[] {
  return getPublishedSnapshots().map((snapshot) => {
    const top = snapshot.entries[0] ?? null;
    const committeeSlugs = new Set(
      snapshot.entries.map((entry) => entry.committeeSlug)
    );

    return {
      month: snapshot.month,
      monthLabel: snapshot.monthLabel,
      publishedAt: snapshot.publishedAt,
      totalRankedMembers: snapshot.entries.length,
      topOverall: top
        ? {
            memberName: top.memberName,
            committeeName: top.committeeName,
            monthlyScore: top.monthlyScore,
          }
        : null,
      committeeCount: committeeSlugs.size,
    };
  });
}

export function getCommitteeLeaders(
  month?: MonthKey
): CommitteeLeaderSpotlight[] {
  const published = getPublishedSnapshots();
  if (published.length === 0) return [];

  const target = month
    ? published.find((snapshot) => snapshot.month === month)
    : published[0];

  if (!target) return [];

  return CHAPTER_COMMITTEES.map((committee) => {
    const topEntry = target.entries.find(
      (entry) => entry.committeeSlug === committee.slug
    );
    return {
      committee: { ...committee },
      month: target.month,
      monthLabel: target.monthLabel,
      leader: topEntry
        ? {
            memberName: topEntry.memberName,
            role: topEntry.role,
            monthlyScore: topEntry.monthlyScore,
          }
        : null,
    };
  });
}
