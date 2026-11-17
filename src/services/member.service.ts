import { MOCK_MEMBERS } from "@/data/mock/members";
import type {
  MemberActivity,
  MemberAttendanceRecord,
  MemberDashboardData,
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
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return null;
  return {
    ...dataset.profile,
    committee: { ...dataset.profile.committee },
  };
}

export async function getMemberMonthlyScores(
  memberId: string
): Promise<MonthlyScoreRecord[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];
  return [...dataset.monthlyScores]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((record) => ({
      ...record,
      components: record.components.map((component) => ({ ...component })),
    }));
}

export async function getMemberAttendance(
  memberId: string
): Promise<MemberAttendanceRecord[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];
  return [...dataset.attendance]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => ({ ...item }));
}

export async function getMemberTasks(memberId: string): Promise<MemberTask[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];
  return [...dataset.tasks]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .map((task) => ({ ...task }));
}

export async function getMemberActivities(
  memberId: string
): Promise<MemberActivity[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];
  return [...dataset.activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((activity) => ({ ...activity }));
}

export async function getMemberEvaluations(
  memberId: string
): Promise<SeasonalEvaluation[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];
  return dataset.evaluations.map((evaluation) => ({
    ...evaluation,
    criteria: evaluation.criteria.map((criterion) => ({ ...criterion })),
  }));
}

export async function getMemberFeedback(
  memberId: string
): Promise<PublishedFeedback[]> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return [];

  return dataset.feedback
    .filter(
      (item): item is PublishedFeedback => item.visibility === "published"
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((item) => ({ ...item }));
}

export async function getMemberDashboard(
  memberId: string,
  month?: MonthKey
): Promise<MemberDashboardData | null> {
  const dataset = MOCK_MEMBERS[memberId];
  if (!dataset) return null;

  const [profile, monthlyHistory, activities, publishedFeedback] =
    await Promise.all([
      getMemberProfile(memberId),
      getMemberMonthlyScores(memberId),
      getMemberActivities(memberId),
      getMemberFeedback(memberId),
    ]);

  if (!profile) return null;

  const currentMonthScore = month
    ? (monthlyHistory.find((record) => record.month === month) ??
      monthlyHistory[0] ??
      null)
    : (monthlyHistory[0] ?? null);

  const bonusComponent = currentMonthScore?.components.find(
    (component) => component.key === "bonuses"
  );

  const projectAndHackathonCount = activities.filter(
    (item) => item.category === "project" || item.category === "hackathon"
  ).length;

  const deliveredSessionsCount = activities.filter(
    (item) => item.category === "delivered_session"
  ).length;

  const bonusesCount = activities.filter(
    (item) => item.category === "bonus"
  ).length;

  return {
    profile,
    currentMonthScore,
    monthlyHistory,
    attendanceSummary: { ...dataset.attendanceSummary },
    taskSummary: { ...dataset.taskSummary },
    projectAndHackathonCount,
    deliveredSessionsCount,
    bonusesPoints: bonusComponent?.points ?? 0,
    bonusesCount,
    recentActivities: activities.slice(0, 4),
    recentFeedback: publishedFeedback.slice(0, 2),
  };
}
