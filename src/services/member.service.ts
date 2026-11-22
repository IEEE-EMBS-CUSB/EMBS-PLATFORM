import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  DEFAULT_SEASON_SETTINGS,
  deriveActivityTier,
  normalizeSeasonSettings,
} from "@/lib/season-settings";
import type {
  MemberActivity,
  MemberAttendanceRecord,
  MemberDashboardData,
  MemberEngagementMetrics,
  MemberProfile,
  MemberRole,
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

export function formatMemberProfileRoleLabel(role: MembershipRole): MemberRole {
  switch (role) {
    case "master_admin":
      return "Master Admin";
    case "director":
      return "Director";
    case "hr_admin":
      return "HR Admin";
    case "hr_member":
      return "HR Member";
    case "committee_head":
      return "Head";
    case "attendee":
      return "Attendee";
    case "member":
    default:
      return "Member";
  }
}

export interface SeasonLedgerPointRow {
  membershipId: string;
  personId: string;
  month: string;
  sourceType: "attendance" | "task" | "assignment" | "event" | "manual_override";
  postingScope?: "committee" | "open";
  committeeId?: string | null;
  points: number;
}

/**
 * Deterministically derives a person's monthly score history across ALL of their
 * memberships in the season so switching active hats never hides or reattributes scores.
 * Overall rank aggregates once per person; committee rank reflects the active committee
 * (committee-scoped points for that committee + open/global points counted once).
 */
export function computePersonMonthlyScores(input: {
  personId: string;
  activeCommitteeId: string | null;
  allSeasonLedger: readonly SeasonLedgerPointRow[];
  publishedMonths: ReadonlySet<string>;
  activeCommitteeMembershipIds: ReadonlySet<string>;
  activeCommitteePersonIds?: ReadonlySet<string>;
}): MonthlyScoreRecord[] {
  const {
    personId,
    activeCommitteeId,
    allSeasonLedger,
    publishedMonths,
    activeCommitteeMembershipIds,
    activeCommitteePersonIds,
  } = input;

  const personLedger = allSeasonLedger.filter((l) => l.personId === personId);
  const months = Array.from(new Set(personLedger.map((l) => l.month))).sort();
  if (months.length === 0) return [];

  const results: MonthlyScoreRecord[] = [];
  let prevOverallRank: number | null = null;

  for (const month of months) {
    const monthEntries = personLedger.filter((l) => l.month === month);
    const totalScore = monthEntries.reduce((sum, e) => sum + e.points, 0);

    // Overall rank: sum points once per person across all their memberships in the season
    const overallPointsByPerson = new Map<string, number>();
    for (const e of allSeasonLedger) {
      if (e.month !== month) continue;
      overallPointsByPerson.set(
        e.personId,
        (overallPointsByPerson.get(e.personId) ?? 0) + e.points
      );
    }

    const sortedOverall = Array.from(overallPointsByPerson.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const overallIdx = sortedOverall.findIndex(([pid]) => pid === personId);
    const overallRank =
      overallIdx >= 0 ? overallIdx + 1 : sortedOverall.length + 1;
    const overallTotal = Math.max(sortedOverall.length, 1);

    // Committee rank: committee-scoped entries for activeCommitteeId + open entries (counted once per eligible person)
    let committeeRank = 1;
    let committeeTotal = 1;
    if (activeCommitteeId && activeCommitteeMembershipIds.size > 0) {
      const commEligiblePersons = new Set<string>(activeCommitteePersonIds ?? []);
      if (commEligiblePersons.size === 0) {
        for (const e of allSeasonLedger) {
          if (activeCommitteeMembershipIds.has(e.membershipId)) {
            commEligiblePersons.add(e.personId);
          }
        }
        commEligiblePersons.add(personId);
      }

      const commPointsByPerson = new Map<string, number>();
      for (const pid of commEligiblePersons) {
        commPointsByPerson.set(pid, 0);
      }
      for (const e of allSeasonLedger) {
        if (e.month !== month) continue;
        if (!commEligiblePersons.has(e.personId)) continue;
        const isOpen = e.postingScope === "open";
        const isThisCommittee =
          e.postingScope !== "open" &&
          (e.committeeId !== undefined
            ? e.committeeId === activeCommitteeId
            : activeCommitteeMembershipIds.has(e.membershipId));
        if (isOpen || isThisCommittee) {
          commPointsByPerson.set(
            e.personId,
            (commPointsByPerson.get(e.personId) ?? 0) + e.points
          );
        }
      }
      const sortedComm = Array.from(commPointsByPerson.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      const commIdx = sortedComm.findIndex(([pid]) => pid === personId);
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
        label: "Tasks & Assignments",
        points: monthEntries
          .filter(
            (l) => l.sourceType === "task" || l.sourceType === "assignment"
          )
          .reduce((s, i) => s + i.points, 0),
        maxPoints: 40,
      },
      {
        key: "bonuses",
        label: "HR Recognition & Bonuses",
        points: monthEntries
          .filter(
            (l) => l.sourceType === "manual_override" || l.sourceType === "event"
          )
          .reduce((s, i) => s + i.points, 0),
        maxPoints: 10,
      },
    ];

    results.push({
      month: month as MonthKey,
      monthLabel: formatMonthLabel(month),
      isPublished: publishedMonths.has(month),
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
}

async function resolvePersonSeasonScope(memberId: string): Promise<{
  personId: string;
  seasonId: string;
  committeeId: string | null;
  membershipIds: string[];
} | null> {
  const [member] = await db
    .select({
      personId: schema.rosterMemberships.personId,
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

  if (!member) return null;

  const seasonHats = await db
    .select({ id: schema.rosterMemberships.id })
    .from(schema.rosterMemberships)
    .where(
      and(
        eq(schema.rosterMemberships.personId, member.personId),
        eq(schema.rosterMemberships.seasonId, member.seasonId),
        ne(schema.rosterMemberships.role, "attendee")
      )
    );

  const membershipIds = Array.from(
    new Set([memberId, ...seasonHats.map((h) => h.id)])
  );

  return {
    personId: member.personId,
    seasonId: member.seasonId,
    committeeId: member.committeeId,
    membershipIds,
  };
}

export async function getMemberProfile(
  memberId: string
): Promise<MemberProfile | null> {
  try {
    const memberRows = await db
      .select({
        id: schema.rosterMemberships.id,
        fullName: schema.persons.fullName,
        role: schema.rosterMemberships.role,
        committeeId: schema.committees.id,
        committeeSlug: schema.committees.slug,
        committeeName: schema.committees.name,
        committeeCategory: schema.committees.category,
        seasonName: schema.seasons.name,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
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
          eq(schema.rosterMemberships.isActive, true),
          eq(schema.persons.isActive, true)
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
        role: formatMemberProfileRoleLabel(member.role as MembershipRole),
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
  personId: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  committeeId: string | null;
  committeeName?: string;
  trackedCommitteeId?: string | null;
  trackedCommitteeName?: string;
  managedTrackId: string | null;
  managedTrackName?: string;
  seasonId?: string;
}

export async function getOperationalUserProfile(
  memberId: string
): Promise<OperationalUserProfile | null> {
  try {
    const memberRows = await db
      .select({
        id: schema.rosterMemberships.id,
        personId: schema.persons.id,
        fullName: schema.persons.fullName,
        email: schema.persons.email,
        role: schema.rosterMemberships.role,
        committeeId: schema.rosterMemberships.committeeId,
        committeeName: schema.committees.name,
        trackedCommitteeId: schema.rosterMemberships.trackedCommitteeId,
        managedTrackId: schema.rosterMemberships.managedTrackId,
        managedTrackName: schema.committeeTracks.name,
        seasonId: schema.rosterMemberships.seasonId,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .leftJoin(
        schema.committeeTracks,
        eq(schema.rosterMemberships.managedTrackId, schema.committeeTracks.id)
      )
      .where(
        and(
          eq(schema.rosterMemberships.id, memberId),
          eq(schema.rosterMemberships.isActive, true),
          eq(schema.persons.isActive, true)
        )
      )
      .limit(1);

    const member = memberRows[0];
    if (member && member.role !== "attendee") {
      let trackedCommitteeName: string | undefined;
      if (member.trackedCommitteeId) {
        const [tracked] = await db
          .select({ name: schema.committees.name })
          .from(schema.committees)
          .where(eq(schema.committees.id, member.trackedCommitteeId))
          .limit(1);
        trackedCommitteeName = tracked?.name;
      }

      return {
        id: member.id,
        personId: member.personId,
        fullName: member.fullName,
        email: member.email,
        role: member.role as MembershipRole,
        committeeId: member.committeeId,
        committeeName: member.committeeName ?? undefined,
        trackedCommitteeId: member.trackedCommitteeId ?? null,
        trackedCommitteeName,
        managedTrackId: member.managedTrackId ?? null,
        managedTrackName: member.managedTrackName ?? undefined,
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
    const scope = await resolvePersonSeasonScope(memberId);
    if (!scope) return [];

    const [allSeasonLedger, publishedSnapshots, committeeMembers] =
      await Promise.all([
        db
          .select({
            membershipId: schema.scoreLedger.membershipId,
            personId: schema.rosterMemberships.personId,
            month: schema.scoreLedger.month,
            sourceType: schema.scoreLedger.sourceType,
            postingScope: schema.scoreLedger.postingScope,
            committeeId: schema.scoreLedger.committeeId,
            points: schema.scoreLedger.points,
          })
          .from(schema.scoreLedger)
          .innerJoin(
            schema.rosterMemberships,
            eq(schema.scoreLedger.membershipId, schema.rosterMemberships.id)
          )
          .where(eq(schema.scoreLedger.seasonId, scope.seasonId)),
        db
          .select({ month: schema.monthlySnapshots.month })
          .from(schema.monthlySnapshots)
          .where(
            and(
              eq(schema.monthlySnapshots.seasonId, scope.seasonId),
              eq(schema.monthlySnapshots.status, "published")
            )
          ),
        scope.committeeId
          ? db
              .select({
                id: schema.rosterMemberships.id,
                personId: schema.rosterMemberships.personId,
              })
              .from(schema.rosterMemberships)
              .where(
                and(
                  eq(schema.rosterMemberships.seasonId, scope.seasonId),
                  eq(schema.rosterMemberships.committeeId, scope.committeeId),
                  eq(schema.rosterMemberships.isActive, true),
                  ne(schema.rosterMemberships.role, "attendee")
                )
              )
          : Promise.resolve([]),
      ]);

    return computePersonMonthlyScores({
      personId: scope.personId,
      activeCommitteeId: scope.committeeId,
      allSeasonLedger,
      publishedMonths: new Set(publishedSnapshots.map((s) => s.month)),
      activeCommitteeMembershipIds: new Set(committeeMembers.map((c) => c.id)),
      activeCommitteePersonIds: new Set(committeeMembers.map((c) => c.personId)),
    });
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function getMemberAttendance(
  memberId: string
): Promise<MemberAttendanceRecord[]> {
  try {
    const scope = await resolvePersonSeasonScope(memberId);
    const membershipIds = scope?.membershipIds ?? [memberId];

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
      .where(inArray(schema.attendanceRecords.membershipId, membershipIds))
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
    const scope = await resolvePersonSeasonScope(memberId);
    const membershipIds = scope?.membershipIds ?? [memberId];

    const tasks = await db
      .select({
        submission: schema.taskSubmissions,
        task: schema.tasks,
      })
      .from(schema.taskSubmissions)
      .innerJoin(schema.tasks, eq(schema.taskSubmissions.taskId, schema.tasks.id))
      .where(inArray(schema.taskSubmissions.membershipId, membershipIds))
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
        maxPoints: task.maxPoints,
        submissionUrl: submission.submissionUrl,
        submissionText: submission.submissionText,
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
    const scope = await resolvePersonSeasonScope(memberId);
    const membershipIds = scope?.membershipIds ?? [memberId];

    const rows = await db
      .select()
      .from(schema.memberActivities)
      .where(inArray(schema.memberActivities.membershipId, membershipIds))
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
    const scope = await resolvePersonSeasonScope(memberId);
    const membershipIds = scope?.membershipIds ?? [memberId];

    const rows = await db
      .select()
      .from(schema.seasonalEvaluations)
      .where(inArray(schema.seasonalEvaluations.membershipId, membershipIds))
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
    const scope = await resolvePersonSeasonScope(memberId);
    const membershipIds = scope?.membershipIds ?? [memberId];

    const feedbackRows = await db
      .select()
      .from(schema.hrFeedback)
      .where(
        and(
          inArray(schema.hrFeedback.membershipId, membershipIds),
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
            personId: schema.rosterMemberships.personId,
            points: schema.scoreLedger.points,
          })
          .from(schema.scoreLedger)
          .innerJoin(
            schema.rosterMemberships,
            eq(schema.scoreLedger.membershipId, schema.rosterMemberships.id)
          )
          .where(
            and(
              eq(schema.scoreLedger.seasonId, memberRow.seasonId),
              eq(schema.scoreLedger.month, currentMonthScore.month)
            )
          );
        const totals = new Map<string, number>();
        for (const e of monthLedger) {
          totals.set(e.personId, (totals.get(e.personId) ?? 0) + e.points);
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

  let tierThresholds = DEFAULT_SEASON_SETTINGS.leaderboard.tierThresholds;
  try {
    const [seasonRow] = await db
      .select({ settingsJson: schema.seasons.settingsJson })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.seasons,
        eq(schema.rosterMemberships.seasonId, schema.seasons.id)
      )
      .where(eq(schema.rosterMemberships.id, memberId))
      .limit(1);
    if (seasonRow) {
      tierThresholds = normalizeSeasonSettings(seasonRow.settingsJson)
        .leaderboard.tierThresholds;
    }
  } catch {
    // Use default thresholds
  }

  const activityTier = deriveActivityTier(livePoints, tierThresholds);

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
