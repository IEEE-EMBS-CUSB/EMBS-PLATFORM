import type { MembershipRole } from "@/lib/auth-helpers";
import {
  deriveActivityTier,
  type SeasonSettings,
} from "@/lib/season-settings";

export type StatisticsScopeKind = "chapter" | "track" | "committee";
export type StatisticsStatusFilter = "active" | "all" | "inactive";
export type PersonStatusFlag = "on_track" | "inactive" | "needs_attention";

export interface StatisticsSeasonOption {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
}

export interface StatisticsTrackRef {
  id: string;
  name: string;
}

export interface StatisticsCommitteeRef {
  id: string;
  name: string;
  slug: string;
  trackId: string | null;
}

export interface StatisticsMemberRecord {
  id: string;
  personId: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: MembershipRole;
  committeeId: string | null;
  trackedCommitteeId: string | null;
  managedTrackId: string | null;
  isActive: boolean;
  mustChangePassword: boolean | null;
}

export interface StatisticsSessionRecord {
  id: string;
  committeeId: string | null;
  startsAt: string;
  month: string;
}

export interface StatisticsAttendanceRecord {
  sessionId: string;
  membershipId: string;
  personId: string;
  status: "present" | "excused" | "absent";
  isPunctual: boolean;
  pointsAwarded: number;
  hasOverride: boolean;
}

export interface StatisticsTaskRecord {
  id: string;
  committeeId: string | null;
  workType: "assignment" | "task";
  dueAt: string;
  month: string;
  maxPoints: number;
}

export interface StatisticsSubmissionRecord {
  taskId: string;
  membershipId: string;
  personId: string;
  effortScore: number | null;
  qualityScore: number | null;
  timelinessScore: number | null;
  totalPoints: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface StatisticsLedgerRecord {
  membershipId: string;
  personId: string;
  month: string;
  sourceType: "attendance" | "task" | "assignment" | "event" | "manual_override";
  postingScope: "committee" | "open";
  committeeId: string | null;
  points: number;
}

export interface StatisticsFeedbackRecord {
  membershipId: string;
  personId: string;
  month: string;
  category:
    | "recognition"
    | "excused_absence"
    | "warning"
    | "other"
    | "internal_note";
  pointsDelta: number;
  isPublished: boolean;
  isWarning: boolean;
}

export interface StatisticsSnapshotRef {
  month: string;
  status: "draft" | "published";
}

export interface AdminStatisticsDataset {
  viewerRole: MembershipRole;
  scopeKind: StatisticsScopeKind;
  scopeLabel: string;
  canViewHiddenFeedback: boolean;
  canViewPortalActivation: boolean;
  canViewManualOverrideRate: boolean;
  canViewHrHealth: boolean;
  canSwitchSeason: boolean;
  selectedSeason: StatisticsSeasonOption | null;
  availableSeasons: StatisticsSeasonOption[];
  seasonSettings: SeasonSettings;
  tracks: StatisticsTrackRef[];
  committees: StatisticsCommitteeRef[];
  members: StatisticsMemberRecord[];
  sessions: StatisticsSessionRecord[];
  attendance: StatisticsAttendanceRecord[];
  tasks: StatisticsTaskRecord[];
  submissions: StatisticsSubmissionRecord[];
  ledger: StatisticsLedgerRecord[];
  feedback: StatisticsFeedbackRecord[];
  snapshots: StatisticsSnapshotRef[];
  hrCoveredCommitteeIds: string[];
}

export interface AdminStatisticsFilters {
  search: string;
  role: "all" | MembershipRole;
  committeeId: "all" | "unassigned" | string;
  trackId: "all" | string;
  status: StatisticsStatusFilter;
  month: "all" | string;
}

export const DEFAULT_STATISTICS_FILTERS: AdminStatisticsFilters = {
  search: "",
  role: "all",
  committeeId: "all",
  trackId: "all",
  status: "active",
  month: "all",
};

export interface StatisticsSummary {
  managedPeopleCount: number;
  totalScopedPeopleCount: number;
  attendeeCount: number;
  participatingPeopleCount: number;
  activeParticipationRate: number;
  inactiveMembersCount: number;
  eligibleMemberCount: number;
  portalActivationRate: number | null;
  activatedPeopleCount: number | null;
  netPoints: number;
  avgMemberPoints: number;
  medianMemberPoints: number;
  sessionsHeldCount: number;
  branchWideSessionsCount: number;
  committeeSessionsCount: number;
  attendanceRate: number;
  punctualityRate: number;
  manualOverrideRate: number | null;
  needsAttentionCount: number;
}

export interface AttendanceStatusSlice {
  key: "on_time" | "late" | "excused" | "absent";
  label: string;
  count: number;
  color: string;
}

export interface PointsSourceSlice {
  key: "attendance" | "assignment" | "task" | "bonus" | "deduction" | "event";
  label: string;
  points: number;
  color: string;
}

export interface TierDistributionSlice {
  tier: "Diamond" | "Gold" | "Silver" | "Bronze" | "Member";
  count: number;
  percent: number;
  color: string;
}

export interface RoleDistributionSlice {
  role: MembershipRole;
  label: string;
  count: number;
  color: string;
}

export interface MonthlyTrendPoint {
  month: string;
  monthLabel: string;
  isPublished: boolean;
  totalPoints: number;
  avgMemberPoints: number;
  attendanceRate: number;
  sessionsCount: number;
}

export interface AssignmentPipelineMetrics {
  totalItems: number;
  totalSubmissions: number;
  submittedCount: number;
  gradedCount: number;
  submissionRate: number;
  gradedRate: number;
  onTimeRate: number;
  overdueCount: number;
  pendingGradingCount: number;
  upcomingCount: number;
  medianTurnaroundHours: number | null;
  avgEffort: number | null;
  avgQuality: number | null;
  avgTimeliness: number | null;
  avgScorePercent: number | null;
}

export interface TaskPipelineMetrics {
  totalItems: number;
  totalSubmissions: number;
  completedCount: number;
  selfReportedPendingCount: number;
  completionRate: number;
  onTimeRate: number;
  overdueCount: number;
  upcomingCount: number;
}

export interface FeedbackMetrics {
  recognition: number;
  excusedAbsence: number;
  other: number;
  warning: number;
  internalNote: number | null;
  bonusPoints: number;
  deductionPoints: number;
  totalCount: number;
}

export interface CommitteeStatRow {
  committeeId: string;
  committeeName: string;
  trackName: string | null;
  managedPeopleCount: number;
  eligibleMemberCount: number;
  participationRate: number;
  avgPoints: number;
  medianPoints: number;
  attendanceRate: number;
  punctualityRate: number;
  assignmentCompletionRate: number;
  taskCompletionRate: number;
  workCompletionRate: number;
  pendingGradingCount: number;
  warningsCount: number;
  needsAttentionCount: number;
}

export interface TrackRollupRow {
  trackId: string;
  trackName: string;
  committeesCount: number;
  managedPeopleCount: number;
  avgPoints: number;
  attendanceRate: number;
  workCompletionRate: number;
}

export interface HrHealthMetrics {
  totalCommittees: number;
  coveredCommittees: number;
  uncoveredCommittees: string[];
  activeMonthsCount: number;
  publishedMonthsCount: number;
  unpublishedMonths: string[];
}

export interface PersonStatRow {
  personId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roles: MembershipRole[];
  committeeNames: string[];
  isActive: boolean;
  isLeaderboardEligible: boolean;
  points: number;
  attendancePoints: number;
  assignmentPoints: number;
  taskPoints: number;
  bonusPoints: number;
  deductionPoints: number;
  tier: "Diamond" | "Gold" | "Silver" | "Bronze" | "Member";
  attendedCount: number;
  expectedSessionsCount: number;
  excusedCount: number;
  lateCount: number;
  attendanceRate: number;
  punctualityRate: number;
  completedWorkCount: number;
  assignedWorkCount: number;
  assignmentsCompletedCount: number;
  assignmentsAssignedCount: number;
  tasksCompletedCount: number;
  tasksAssignedCount: number;
  workCompletionRate: number;
  overdueCount: number;
  avgEffort: number | null;
  avgQuality: number | null;
  avgTimeliness: number | null;
  recognitionsCount: number;
  warningsCount: number;
  internalNotesCount: number | null;
  attentionReasons: string[];
  statusFlag: PersonStatusFlag;
}

export interface SeasonLeaderboardFilters {
  search: string;
  trackId: "all" | string;
  committeeId: "all" | string;
  role: "all" | "member" | "hr_member";
  tier: "all" | TierDistributionSlice["tier"];
  warnings: "all" | "with_warnings" | "no_warnings";
  status: "active" | "all";
}

export const DEFAULT_SEASON_LEADERBOARD_FILTERS: SeasonLeaderboardFilters = {
  search: "",
  trackId: "all",
  committeeId: "all",
  role: "all",
  tier: "all",
  warnings: "all",
  status: "active",
};

export interface SeasonLeaderboardEntry {
  rank: number;
  overallRank: number;
  personId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roles: MembershipRole[];
  committeeNames: string[];
  trackNames: string[];
  isActive: boolean;
  seasonPoints: number;
  tier: TierDistributionSlice["tier"];
  attendancePoints: number;
  assignmentPoints: number;
  taskPoints: number;
  manualNetPoints: number;
  attendanceRate: number;
  punctualityRate: number;
  workCompletionRate: number;
  overdueCount: number;
  warningsCount: number;
  recognitionsCount: number;
  internalNotesCount: number | null;
  activeMonthsCount: number;
}

export interface ComputedAdminStatistics {
  availableMonths: Array<{ month: string; label: string; isPublished: boolean }>;
  summary: StatisticsSummary;
  attendanceBreakdown: AttendanceStatusSlice[];
  pointsBySource: PointsSourceSlice[];
  tierDistribution: TierDistributionSlice[];
  roleDistribution: RoleDistributionSlice[];
  monthlyTrend: MonthlyTrendPoint[];
  assignments: AssignmentPipelineMetrics;
  tasks: TaskPipelineMetrics;
  feedback: FeedbackMetrics;
  committeeComparison: CommitteeStatRow[];
  trackRollup: TrackRollupRow[];
  hrHealth: HrHealthMetrics | null;
  people: PersonStatRow[];
}

const ROLE_LABELS: Record<MembershipRole, string> = {
  master_admin: "Master",
  director: "Director",
  hr_admin: "HR Admin",
  hr_member: "HR Member",
  committee_head: "Head",
  member: "Member",
  attendee: "Attendee",
};

const ROLE_COLORS: Record<MembershipRole, string> = {
  master_admin: "#002855",
  director: "#5a1b63",
  hr_admin: "#772583",
  hr_member: "#007377",
  committee_head: "#00629b",
  member: "#78be20",
  attendee: "#ffc627",
};

const TIER_COLORS: Record<TierDistributionSlice["tier"], string> = {
  Diamond: "#772583",
  Gold: "#ffc627",
  Silver: "#00629b",
  Bronze: "#007377",
  Member: "#64748b",
};

function isLeaderboardRole(role: MembershipRole): boolean {
  return role === "member" || role === "hr_member";
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function computeMedian(values: number[], decimals = 0): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  if (decimals <= 0) return Math.round(raw);
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

function roundDecimal(values: number[], decimals = 1): number | null {
  if (values.length === 0) return null;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const factor = 10 ** decimals;
  return Math.round(avg * factor) / factor;
}

export function formatShortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function getMemberDisplayCommitteeId(m: StatisticsMemberRecord): string | null {
  return m.role === "hr_member" ? m.trackedCommitteeId : m.committeeId;
}

function getMemberTrackId(
  m: StatisticsMemberRecord,
  committeeById: ReadonlyMap<string, StatisticsCommitteeRef>
): string | null {
  if (m.role === "director") {
    return m.managedTrackId;
  }
  const primaryCommId = getMemberDisplayCommitteeId(m) ?? m.committeeId;
  return primaryCommId ? (committeeById.get(primaryCommId)?.trackId ?? null) : null;
}

function matchesMemberFilters(
  m: StatisticsMemberRecord,
  filters: AdminStatisticsFilters,
  committeeById: ReadonlyMap<string, StatisticsCommitteeRef>
): boolean {
  if (filters.status === "active" && !m.isActive) return false;
  if (filters.status === "inactive" && m.isActive) return false;

  if (filters.role !== "all" && m.role !== filters.role) return false;

  if (filters.committeeId === "unassigned") {
    const displayComm = getMemberDisplayCommitteeId(m);
    if (displayComm !== null) return false;
  } else if (filters.committeeId !== "all") {
    const matchesHome = m.committeeId === filters.committeeId;
    const matchesTracked =
      m.role === "hr_member" && m.trackedCommitteeId === filters.committeeId;
    if (!matchesHome && !matchesTracked) return false;
  }

  if (filters.trackId !== "all") {
    const memberTrack = getMemberTrackId(m, committeeById);
    const homeTrack = m.committeeId
      ? (committeeById.get(m.committeeId)?.trackId ?? null)
      : null;
    if (memberTrack !== filters.trackId && homeTrack !== filters.trackId) {
      return false;
    }
  }

  const q = filters.search.trim().toLowerCase();
  if (q.length > 0) {
    const nameMatch = m.fullName.toLowerCase().includes(q);
    const emailMatch = m.email.toLowerCase().includes(q);
    const digitsQ = q.replace(/\D/g, "");
    const phoneMatch =
      digitsQ.length >= 3 &&
      (m.phoneNumber ?? "").replace(/\D/g, "").includes(digitsQ);
    if (!nameMatch && !emailMatch && !phoneMatch) return false;
  }

  return true;
}

function computePointBreakdownForPerson(
  personId: string,
  ledgerRows: readonly StatisticsLedgerRecord[],
  committeeFocusId: string | null,
  allowedMembershipIds: ReadonlySet<string>
): {
  total: number;
  attendancePoints: number;
  assignmentPoints: number;
  taskPoints: number;
  bonusPoints: number;
  deductionPoints: number;
  activeMonths: Set<string>;
} {
  let total = 0;
  let attendancePoints = 0;
  let assignmentPoints = 0;
  let taskPoints = 0;
  let bonusPoints = 0;
  let deductionPoints = 0;
  const activeMonths = new Set<string>();

  for (const row of ledgerRows) {
    if (row.personId !== personId) continue;
    let included = false;
    if (row.postingScope === "open") {
      included = true;
    } else if (committeeFocusId !== null) {
      if (
        row.committeeId === committeeFocusId ||
        (row.committeeId === null && allowedMembershipIds.has(row.membershipId))
      ) {
        included = true;
      }
    } else if (allowedMembershipIds.has(row.membershipId)) {
      included = true;
    }

    if (!included) continue;
    total += row.points;
    if (row.points !== 0) activeMonths.add(row.month);
    if (row.sourceType === "attendance") attendancePoints += row.points;
    else if (row.sourceType === "assignment") assignmentPoints += row.points;
    else if (row.sourceType === "task") taskPoints += row.points;
    else if (row.sourceType === "manual_override" || row.sourceType === "event") {
      if (row.points >= 0) bonusPoints += row.points;
      else deductionPoints += row.points;
    }
  }

  return {
    total,
    attendancePoints,
    assignmentPoints,
    taskPoints,
    bonusPoints,
    deductionPoints,
    activeMonths,
  };
}

function computePointsForPerson(
  personId: string,
  ledgerRows: readonly StatisticsLedgerRecord[],
  committeeFocusId: string | null,
  allowedMembershipIds: ReadonlySet<string>
): number {
  return computePointBreakdownForPerson(
    personId,
    ledgerRows,
    committeeFocusId,
    allowedMembershipIds
  ).total;
}

export function computeAdminStatistics(
  dataset: AdminStatisticsDataset,
  filters: AdminStatisticsFilters = DEFAULT_STATISTICS_FILTERS,
  now: Date = new Date()
): ComputedAdminStatistics {
  const nowMs = now.getTime();
  const committeeById = new Map(dataset.committees.map((c) => [c.id, c]));
  const trackById = new Map(dataset.tracks.map((t) => [t.id, t]));
  const publishedMonthSet = new Set(
    dataset.snapshots.filter((s) => s.status === "published").map((s) => s.month)
  );

  // Collect every month that has any activity in the season for the Month selector & trend chart
  const monthSet = new Set<string>();
  for (const l of dataset.ledger) monthSet.add(l.month);
  for (const s of dataset.sessions) {
    if (Date.parse(s.startsAt) <= nowMs) monthSet.add(s.month);
  }
  for (const t of dataset.tasks) monthSet.add(t.month);
  for (const sn of dataset.snapshots) monthSet.add(sn.month);
  const sortedMonths = Array.from(monthSet).sort();

  const availableMonths = sortedMonths
    .slice()
    .reverse()
    .map((m) => ({
      month: m,
      label: formatShortMonthLabel(m),
      isPublished: publishedMonthSet.has(m),
    }));

  // Total scoped distinct non-attendee people (for "Showing X of Y")
  const allScopedNonAttendeePersons = new Set(
    dataset.members
      .filter((m) =>
        filters.status === "active"
          ? m.isActive
          : filters.status === "inactive"
            ? !m.isActive
            : true
      )
      .filter((m) => filters.role === "attendee" || m.role !== "attendee")
      .map((m) => m.personId)
  );

  // Apply Roster-matching filters
  const filteredMemberships = dataset.members.filter((m) =>
    matchesMemberFilters(m, filters, committeeById)
  );

  // Separate attendees from operational/member roster unless explicitly filtered to attendee
  const includeAttendeesInPrimary = filters.role === "attendee";
  const attendeePersons = new Set(
    filteredMemberships
      .filter((m) => m.role === "attendee")
      .map((m) => m.personId)
  );
  const primaryMemberships = includeAttendeesInPrimary
    ? filteredMemberships
    : filteredMemberships.filter((m) => m.role !== "attendee");

  const primaryMembershipIds = new Set(primaryMemberships.map((m) => m.id));
  const primaryPersonIds = new Set(primaryMemberships.map((m) => m.personId));

  // Resolve committee focus for scoring attribution & session/task scoping
  const activeCommitteeFocusId =
    filters.committeeId !== "all" && filters.committeeId !== "unassigned"
      ? filters.committeeId
      : dataset.scopeKind === "committee" && dataset.committees.length === 1
        ? dataset.committees[0].id
        : null;

  const trackCommitteeIds =
    filters.trackId !== "all"
      ? new Set(
          dataset.committees
            .filter((c) => c.trackId === filters.trackId)
            .map((c) => c.id)
        )
      : null;

  // Determine eligible members (member & hr_member hats in the filtered set)
  // When focused on a specific committee C, an HR officer tracking C (whose home committee is HR)
  // is not counted in C's member score average unless C IS their home committee.
  const eligibleMemberships = primaryMemberships.filter((m) => {
    if (!isLeaderboardRole(m.role)) return false;
    if (activeCommitteeFocusId && m.role === "hr_member") {
      return m.committeeId === activeCommitteeFocusId;
    }
    return true;
  });
  const eligiblePersonIds = new Set(eligibleMemberships.map((m) => m.personId));

  // Filter ledger rows by month & filtered people/scope
  const periodLedgerAll = dataset.ledger.filter(
    (l) => filters.month === "all" || l.month === filters.month
  );

  const scopedLedgerRows = periodLedgerAll.filter((l) => {
    if (!primaryPersonIds.has(l.personId)) return false;
    if (l.postingScope === "open") return true;
    if (activeCommitteeFocusId !== null) {
      return (
        l.committeeId === activeCommitteeFocusId ||
        (l.committeeId === null && primaryMembershipIds.has(l.membershipId))
      );
    }
    return primaryMembershipIds.has(l.membershipId);
  });

  // Per-person points (deduplicated once per person)
  const pointsByPerson = new Map<string, number>();
  for (const personId of primaryPersonIds) {
    pointsByPerson.set(
      personId,
      computePointsForPerson(
        personId,
        periodLedgerAll,
        activeCommitteeFocusId,
        primaryMembershipIds
      )
    );
  }

  const eligiblePointValues = Array.from(eligiblePersonIds).map(
    (pid) => pointsByPerson.get(pid) ?? 0
  );
  const netPoints = Array.from(primaryPersonIds).reduce(
    (sum, pid) => sum + (pointsByPerson.get(pid) ?? 0),
    0
  );
  const eligiblePointsSum = eligiblePointValues.reduce((s, p) => s + p, 0);
  const avgMemberPoints =
    eligiblePointValues.length > 0
      ? Math.round(eligiblePointsSum / eligiblePointValues.length)
      : 0;
  const medianMemberPoints = computeMedian(eligiblePointValues, 0);

  // Points by source breakdown (deduplicated per ledger row in scopedLedgerRows)
  const sourceTotals = {
    attendance: 0,
    assignment: 0,
    task: 0,
    bonus: 0,
    deduction: 0,
    event: 0,
  };
  for (const row of scopedLedgerRows) {
    if (row.sourceType === "attendance") sourceTotals.attendance += row.points;
    else if (row.sourceType === "assignment") sourceTotals.assignment += row.points;
    else if (row.sourceType === "task") sourceTotals.task += row.points;
    else if (row.sourceType === "event") sourceTotals.event += row.points;
    else if (row.sourceType === "manual_override") {
      if (row.points >= 0) sourceTotals.bonus += row.points;
      else sourceTotals.deduction += row.points;
    }
  }

  const pointsBySource: PointsSourceSlice[] = [
    { key: "attendance", label: "Attendance", points: sourceTotals.attendance, color: "#00629b" },
    { key: "assignment", label: "Assignments", points: sourceTotals.assignment, color: "#772583" },
    { key: "task", label: "HR Tasks", points: sourceTotals.task, color: "#007377" },
    { key: "bonus", label: "Bonuses", points: sourceTotals.bonus, color: "#78be20" },
    { key: "deduction", label: "Deductions", points: sourceTotals.deduction, color: "#ba0c2f" },
    ...(sourceTotals.event !== 0
      ? [{ key: "event" as const, label: "Events", points: sourceTotals.event, color: "#ffc627" }]
      : []),
  ];

  // Activity tier distribution (eligible leaderboard members)
  const tierThresholds = dataset.seasonSettings.leaderboard.tierThresholds;
  const tierOrder: TierDistributionSlice["tier"][] = [
    "Diamond",
    "Gold",
    "Silver",
    "Bronze",
    "Member",
  ];
  const tierCounts = new Map<TierDistributionSlice["tier"], number>(
    tierOrder.map((t) => [t, 0])
  );
  for (const pid of eligiblePersonIds) {
    const tier = deriveActivityTier(pointsByPerson.get(pid) ?? 0, tierThresholds);
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
  }
  const tierDistribution: TierDistributionSlice[] = tierOrder.map((tier) => {
    const count = tierCounts.get(tier) ?? 0;
    return {
      tier,
      count,
      percent: roundPercent(count, eligiblePersonIds.size),
      color: TIER_COLORS[tier],
    };
  });

  // Role distribution (distinct persons per role in filtered set)
  const roleOrder: MembershipRole[] = [
    "member",
    "committee_head",
    "hr_member",
    "hr_admin",
    "director",
    "master_admin",
    "attendee",
  ];
  const rolePersonsMap = new Map<MembershipRole, Set<string>>();
  for (const m of filteredMemberships) {
    const set = rolePersonsMap.get(m.role) ?? new Set<string>();
    set.add(m.personId);
    rolePersonsMap.set(m.role, set);
  }
  const roleDistribution: RoleDistributionSlice[] = roleOrder
    .filter((r) => (rolePersonsMap.get(r)?.size ?? 0) > 0)
    .map((role) => ({
      role,
      label: ROLE_LABELS[role],
      count: rolePersonsMap.get(role)?.size ?? 0,
      color: ROLE_COLORS[role],
    }));

  // Sessions & attendance (past sessions only!)
  const matchesSessionScope = (s: StatisticsSessionRecord) => {
    if (Date.parse(s.startsAt) > nowMs) return false;
    if (filters.month !== "all" && s.month !== filters.month) return false;
    if (activeCommitteeFocusId !== null) {
      return s.committeeId === activeCommitteeFocusId;
    }
    if (filters.committeeId === "unassigned") {
      return s.committeeId === null;
    }
    if (trackCommitteeIds !== null) {
      return s.committeeId !== null && trackCommitteeIds.has(s.committeeId);
    }
    return true;
  };

  const scopedPastSessions = dataset.sessions.filter(matchesSessionScope);
  const scopedSessionIds = new Set(scopedPastSessions.map((s) => s.id));
  const branchWideSessionsCount = scopedPastSessions.filter(
    (s) => s.committeeId === null
  ).length;
  const committeeSessionsCount =
    scopedPastSessions.length - branchWideSessionsCount;

  // Filter attendance to scoped past sessions & filtered people
  const scopedAttendance = dataset.attendance.filter(
    (a) => scopedSessionIds.has(a.sessionId) && primaryPersonIds.has(a.personId)
  );

  // Deduplicate attendance per (sessionId, personId) so multi-hat people aren't double-counted
  const dedupAttendanceBySessionPerson = new Map<string, StatisticsAttendanceRecord>();
  const statusRank = { present: 3, excused: 2, absent: 1 };
  for (const a of scopedAttendance) {
    const key = `${a.sessionId}::${a.personId}`;
    const existing = dedupAttendanceBySessionPerson.get(key);
    if (
      !existing ||
      statusRank[a.status] > statusRank[existing.status] ||
      (a.status === "present" && a.isPunctual && !existing.isPunctual)
    ) {
      dedupAttendanceBySessionPerson.set(key, a);
    }
  }
  const dedupAttendance = Array.from(dedupAttendanceBySessionPerson.values());

  // Expected audience per past session
  const membersByCommitteePersons = new Map<string, Set<string>>();
  for (const m of primaryMemberships) {
    if (!m.committeeId) continue;
    const set = membersByCommitteePersons.get(m.committeeId) ?? new Set<string>();
    set.add(m.personId);
    membersByCommitteePersons.set(m.committeeId, set);
  }

  let totalPresent = 0;
  let totalOnTime = 0;
  let totalLate = 0;
  let totalExcused = 0;
  let totalAbsent = 0;
  let totalAdjustedExpected = 0;

  const expectedSessionsByPerson = new Map<string, number>();
  const attendedByPerson = new Map<string, number>();
  const onTimeByPerson = new Map<string, number>();
  const excusedByPerson = new Map<string, number>();

  for (const session of scopedPastSessions) {
    const sessionRecords = dedupAttendance.filter((a) => a.sessionId === session.id);
    const present = sessionRecords.filter((a) => a.status === "present");
    const excused = sessionRecords.filter((a) => a.status === "excused");
    const explicitAbsent = sessionRecords.filter((a) => a.status === "absent");

    const audiencePersons =
      session.committeeId !== null
        ? (membersByCommitteePersons.get(session.committeeId) ?? new Set<string>())
        : primaryPersonIds;

    const unionAudience = new Set<string>(audiencePersons);
    for (const r of sessionRecords) unionAudience.add(r.personId);

    for (const pid of unionAudience) {
      expectedSessionsByPerson.set(
        pid,
        (expectedSessionsByPerson.get(pid) ?? 0) + 1
      );
    }
    for (const r of present) {
      attendedByPerson.set(r.personId, (attendedByPerson.get(r.personId) ?? 0) + 1);
      if (r.isPunctual) {
        onTimeByPerson.set(r.personId, (onTimeByPerson.get(r.personId) ?? 0) + 1);
      }
    }
    for (const r of excused) {
      excusedByPerson.set(r.personId, (excusedByPerson.get(r.personId) ?? 0) + 1);
    }

    const expectedCount = unionAudience.size;
    const adjustedDenom =
      expectedCount > 0 ? Math.max(1, expectedCount - excused.length) : 0;

    const onTimeCount = present.filter((a) => a.isPunctual).length;
    const lateCount = present.length - onTimeCount;
    const unrecordedNoShows = Math.max(
      0,
      expectedCount - (present.length + excused.length + explicitAbsent.length)
    );

    totalPresent += present.length;
    totalOnTime += onTimeCount;
    totalLate += lateCount;
    totalExcused += excused.length;
    totalAbsent += explicitAbsent.length + unrecordedNoShows;
    totalAdjustedExpected += adjustedDenom;
  }

  const attendanceRate = roundPercent(totalPresent, totalAdjustedExpected);
  const punctualityRate = roundPercent(totalOnTime, totalPresent);
  const overrideCount = scopedAttendance.filter((a) => a.hasOverride).length;
  const manualOverrideRate = dataset.canViewManualOverrideRate
    ? roundPercent(overrideCount, scopedAttendance.length)
    : null;

  const attendanceBreakdown: AttendanceStatusSlice[] = [
    { key: "on_time", label: "On Time", count: totalOnTime, color: "#78be20" },
    { key: "late", label: "Late", count: totalLate, color: "#ffc627" },
    { key: "excused", label: "Excused", count: totalExcused, color: "#00629b" },
    { key: "absent", label: "Absent", count: totalAbsent, color: "#ba0c2f" },
  ];

  // Tasks & Assignments pipeline (both visible to committee heads & HR members!)
  const taskById = new Map(dataset.tasks.map((t) => [t.id, t]));
  const periodTasks = dataset.tasks.filter((t) => {
    if (filters.month !== "all" && t.month !== filters.month) return false;
    if (activeCommitteeFocusId !== null) {
      return t.committeeId === activeCommitteeFocusId || t.committeeId === null;
    }
    if (filters.committeeId === "unassigned") {
      return t.committeeId === null;
    }
    if (trackCommitteeIds !== null) {
      return t.committeeId === null || trackCommitteeIds.has(t.committeeId);
    }
    return true;
  });
  const periodTaskIds = new Set(periodTasks.map((t) => t.id));

  const scopedSubmissionsRaw = dataset.submissions.filter(
    (s) =>
      periodTaskIds.has(s.taskId) &&
      primaryPersonIds.has(s.personId) &&
      (activeCommitteeFocusId === null ||
        taskById.get(s.taskId)?.committeeId === activeCommitteeFocusId ||
        primaryMembershipIds.has(s.membershipId))
  );

  // Deduplicate submissions per (taskId, personId)
  const dedupSubsMap = new Map<string, StatisticsSubmissionRecord>();
  for (const s of scopedSubmissionsRaw) {
    const key = `${s.taskId}::${s.personId}`;
    const existing = dedupSubsMap.get(key);
    if (
      !existing ||
      (s.gradedAt && !existing.gradedAt) ||
      (s.submittedAt && !existing.submittedAt)
    ) {
      dedupSubsMap.set(key, s);
    }
  }
  const scopedSubmissions = Array.from(dedupSubsMap.values());

  const assignmentSubs: StatisticsSubmissionRecord[] = [];
  const taskSubs: StatisticsSubmissionRecord[] = [];
  const assignmentTaskIdsSeen = new Set<string>();
  const hrTaskIdsSeen = new Set<string>();

  for (const t of periodTasks) {
    if (t.committeeId !== null) {
      if (t.workType === "assignment") assignmentTaskIdsSeen.add(t.id);
      else hrTaskIdsSeen.add(t.id);
    }
  }
  for (const s of scopedSubmissions) {
    const t = taskById.get(s.taskId);
    if (!t) continue;
    if (t.workType === "assignment") {
      assignmentSubs.push(s);
      assignmentTaskIdsSeen.add(t.id);
    } else {
      taskSubs.push(s);
      hrTaskIdsSeen.add(t.id);
    }
  }

  // Assignment pipeline calculations
  const assignSubmitted = assignmentSubs.filter(
    (s) => s.submittedAt !== null || s.gradedAt !== null
  );
  const assignGraded = assignmentSubs.filter((s) => s.gradedAt !== null);
  const assignWithTimestamp = assignmentSubs.filter((s) => s.submittedAt !== null);
  const assignOnTime = assignWithTimestamp.filter((s) => {
    const t = taskById.get(s.taskId);
    return t ? Date.parse(s.submittedAt!) <= Date.parse(t.dueAt) : false;
  });
  const assignOverdue = assignmentSubs.filter((s) => {
    if (s.submittedAt !== null || s.gradedAt !== null) return false;
    const t = taskById.get(s.taskId);
    return t ? Date.parse(t.dueAt) < nowMs : false;
  });
  const assignPendingGrading = assignmentSubs.filter(
    (s) => s.submittedAt !== null && s.gradedAt === null
  );
  const assignUpcoming = Math.max(
    0,
    assignmentSubs.length - assignSubmitted.length - assignOverdue.length
  );

  const turnaroundHours: number[] = [];
  const effortScores: number[] = [];
  const qualityScores: number[] = [];
  const timelinessScores: number[] = [];
  const scorePercents: number[] = [];

  for (const s of assignGraded) {
    if (s.submittedAt && s.gradedAt) {
      const diffMs = Date.parse(s.gradedAt) - Date.parse(s.submittedAt);
      if (diffMs >= 0) {
        turnaroundHours.push(diffMs / 3_600_000);
      }
    }
    if (s.effortScore !== null) effortScores.push(s.effortScore);
    if (s.qualityScore !== null) qualityScores.push(s.qualityScore);
    if (s.timelinessScore !== null) timelinessScores.push(s.timelinessScore);
    const t = taskById.get(s.taskId);
    if (t && t.maxPoints > 0 && s.totalPoints !== null) {
      scorePercents.push((s.totalPoints / t.maxPoints) * 100);
    }
  }

  const assignments: AssignmentPipelineMetrics = {
    totalItems: assignmentTaskIdsSeen.size,
    totalSubmissions: assignmentSubs.length,
    submittedCount: assignSubmitted.length,
    gradedCount: assignGraded.length,
    submissionRate: roundPercent(assignSubmitted.length, assignmentSubs.length),
    gradedRate: roundPercent(assignGraded.length, assignmentSubs.length),
    onTimeRate: roundPercent(assignOnTime.length, assignWithTimestamp.length),
    overdueCount: assignOverdue.length,
    pendingGradingCount: assignPendingGrading.length,
    upcomingCount: assignUpcoming,
    medianTurnaroundHours:
      turnaroundHours.length > 0 ? computeMedian(turnaroundHours, 1) : null,
    avgEffort: roundDecimal(effortScores, 1),
    avgQuality: roundDecimal(qualityScores, 1),
    avgTimeliness: roundDecimal(timelinessScores, 1),
    avgScorePercent:
      scorePercents.length > 0
        ? Math.round(
            scorePercents.reduce((s, v) => s + v, 0) / scorePercents.length
          )
        : null,
  };

  // HR Task pipeline calculations
  const taskCompleted = taskSubs.filter((s) => s.gradedAt !== null);
  const taskPendingSelfReport = taskSubs.filter(
    (s) => s.submittedAt !== null && s.gradedAt === null
  );
  const taskWithTimestamp = taskSubs.filter((s) => s.submittedAt !== null);
  const taskOnTime = taskWithTimestamp.filter((s) => {
    const t = taskById.get(s.taskId);
    return t ? Date.parse(s.submittedAt!) <= Date.parse(t.dueAt) : false;
  });
  const taskOverdue = taskSubs.filter((s) => {
    if (s.submittedAt !== null || s.gradedAt !== null) return false;
    const t = taskById.get(s.taskId);
    return t ? Date.parse(t.dueAt) < nowMs : false;
  });
  const taskUpcoming = Math.max(
    0,
    taskSubs.length -
      taskCompleted.length -
      taskPendingSelfReport.length -
      taskOverdue.length
  );

  const tasks: TaskPipelineMetrics = {
    totalItems: hrTaskIdsSeen.size,
    totalSubmissions: taskSubs.length,
    completedCount: taskCompleted.length,
    selfReportedPendingCount: taskPendingSelfReport.length,
    completionRate: roundPercent(taskCompleted.length, taskSubs.length),
    onTimeRate: roundPercent(taskOnTime.length, taskWithTimestamp.length),
    overdueCount: taskOverdue.length,
    upcomingCount: taskUpcoming,
  };

  // Feedback metrics (defense-in-depth: also filter isPublished=true here if !canViewHiddenFeedback)
  const scopedFeedback = dataset.feedback.filter((f) => {
    if (!dataset.canViewHiddenFeedback && !f.isPublished) return false;
    if (filters.month !== "all" && f.month !== filters.month) return false;
    return primaryPersonIds.has(f.personId);
  });

  const feedback: FeedbackMetrics = {
    recognition: 0,
    excusedAbsence: 0,
    other: 0,
    warning: 0,
    internalNote: dataset.canViewHiddenFeedback ? 0 : null,
    bonusPoints: 0,
    deductionPoints: 0,
    totalCount: scopedFeedback.length,
  };

  const recognitionsByPerson = new Map<string, number>();
  const warningsByPerson = new Map<string, number>();
  const internalNotesByPerson = new Map<string, number>();

  for (const f of scopedFeedback) {
    if (!f.isPublished) {
      if (feedback.internalNote !== null) {
        feedback.internalNote += 1;
      }
      internalNotesByPerson.set(
        f.personId,
        (internalNotesByPerson.get(f.personId) ?? 0) + 1
      );
    } else if (f.category === "warning" || f.isWarning) {
      feedback.warning += 1;
      warningsByPerson.set(f.personId, (warningsByPerson.get(f.personId) ?? 0) + 1);
    } else if (f.category === "excused_absence") {
      feedback.excusedAbsence += 1;
    } else if (f.category === "other") {
      feedback.other += 1;
    } else {
      feedback.recognition += 1;
      recognitionsByPerson.set(
        f.personId,
        (recognitionsByPerson.get(f.personId) ?? 0) + 1
      );
    }

    if (f.pointsDelta > 0) feedback.bonusPoints += f.pointsDelta;
    else if (f.pointsDelta < 0) feedback.deductionPoints += f.pointsDelta;
  }

  // Per-person drill-down aggregation
  const personGroups = new Map<string, StatisticsMemberRecord[]>();
  for (const m of primaryMemberships) {
    const list = personGroups.get(m.personId) ?? [];
    list.push(m);
    personGroups.set(m.personId, list);
  }

  const subsByPerson = new Map<string, StatisticsSubmissionRecord[]>();
  for (const s of scopedSubmissions) {
    const list = subsByPerson.get(s.personId) ?? [];
    list.push(s);
    subsByPerson.set(s.personId, list);
  }

  const ledgerPresenceByPerson = new Set(
    scopedLedgerRows.filter((l) => l.points !== 0).map((l) => l.personId)
  );

  const hasAnyPeriodActivityOpportunities =
    scopedPastSessions.length > 0 ||
    assignments.totalSubmissions > 0 ||
    tasks.totalSubmissions > 0;

  const people: PersonStatRow[] = [];
  let participatingPeopleCount = 0;
  let inactiveMembersCount = 0;
  let needsAttentionCount = 0;
  let activatedPeopleCount = 0;

  for (const [personId, hats] of personGroups.entries()) {
    const first = hats[0];
    const roles = Array.from(new Set(hats.map((h) => h.role)));
    const isActive = hats.some((h) => h.isActive);
    const isEligible = eligiblePersonIds.has(personId);
    const committeeNames = Array.from(
      new Set(
        hats.map((h) => {
          if (h.role === "hr_member") {
            const tracked = h.trackedCommitteeId
              ? committeeById.get(h.trackedCommitteeId)?.name
              : null;
            return tracked ? `Tracks ${tracked}` : "Human Resources";
          }
          if (h.role === "director") {
            const trackName = h.managedTrackId
              ? trackById.get(h.managedTrackId)?.name
              : null;
            return trackName ? `${trackName} Track` : "Chapter Leadership";
          }
          return h.committeeId
            ? (committeeById.get(h.committeeId)?.name ?? "Unassigned")
            : "Unassigned";
        })
      )
    );

    if (dataset.canViewPortalActivation && first.mustChangePassword === false) {
      activatedPeopleCount += 1;
    }

    const pointsBreakdown = computePointBreakdownForPerson(
      personId,
      periodLedgerAll,
      activeCommitteeFocusId,
      primaryMembershipIds
    );
    const points = pointsBreakdown.total;
    const tier = deriveActivityTier(points, tierThresholds);
    const attendedCount = attendedByPerson.get(personId) ?? 0;
    const onTimeCount = onTimeByPerson.get(personId) ?? 0;
    const lateCount = Math.max(0, attendedCount - onTimeCount);
    const expectedCount = expectedSessionsByPerson.get(personId) ?? 0;
    const excusedCount = excusedByPerson.get(personId) ?? 0;
    const adjustedExpected =
      expectedCount > 0 ? Math.max(1, expectedCount - excusedCount) : 0;
    const personAttendanceRate = roundPercent(attendedCount, adjustedExpected);
    const personPunctualityRate = roundPercent(onTimeCount, attendedCount);

    const pSubs = subsByPerson.get(personId) ?? [];
    const pAssignSubs = pSubs.filter(
      (s) => taskById.get(s.taskId)?.workType === "assignment"
    );
    const pTaskSubs = pSubs.filter(
      (s) => taskById.get(s.taskId)?.workType === "task"
    );
    const assignmentsCompletedCount = pAssignSubs.filter(
      (s) => s.gradedAt !== null
    ).length;
    const tasksCompletedCount = pTaskSubs.filter(
      (s) => s.gradedAt !== null
    ).length;
    const completedWorkCount = pSubs.filter((s) => s.gradedAt !== null).length;
    const submittedAnyCount = pSubs.filter(
      (s) => s.submittedAt !== null || s.gradedAt !== null
    ).length;
    const overdueCount = pSubs.filter((s) => {
      if (s.submittedAt !== null || s.gradedAt !== null) return false;
      const t = taskById.get(s.taskId);
      return t ? Date.parse(t.dueAt) < nowMs : false;
    }).length;
    const workCompletionRate = roundPercent(completedWorkCount, pSubs.length);

    const pEfforts = pSubs
      .map((s) => s.effortScore)
      .filter((v): v is number => v !== null);
    const pQualities = pSubs
      .map((s) => s.qualityScore)
      .filter((v): v is number => v !== null);
    const pTimeliness = pSubs
      .map((s) => s.timelinessScore)
      .filter((v): v is number => v !== null);

    const recognitionsCount = recognitionsByPerson.get(personId) ?? 0;
    const warningsCount = warningsByPerson.get(personId) ?? 0;
    const internalNotesCount = dataset.canViewHiddenFeedback
      ? (internalNotesByPerson.get(personId) ?? 0)
      : null;

    const hasActivity =
      attendedCount > 0 ||
      submittedAnyCount > 0 ||
      ledgerPresenceByPerson.has(personId);
    if (hasActivity) participatingPeopleCount += 1;

    const isInactiveMember =
      isEligible && points === 0 && attendedCount === 0 && submittedAnyCount === 0;
    if (isInactiveMember) inactiveMembersCount += 1;

    const attentionReasons: string[] = [];
    if (expectedCount >= 2 && personAttendanceRate < 50) {
      attentionReasons.push(`Low attendance (${personAttendanceRate}%)`);
    }
    if (overdueCount >= 2) {
      attentionReasons.push(`${overdueCount} overdue items`);
    }
    if (warningsCount >= 1) {
      attentionReasons.push(
        `${warningsCount} official warning${warningsCount === 1 ? "" : "s"}`
      );
    }
    if (
      isEligible &&
      points === 0 &&
      hasAnyPeriodActivityOpportunities &&
      attendedCount === 0
    ) {
      attentionReasons.push("Zero activity in period");
    }

    const statusFlag: PersonStatusFlag =
      attentionReasons.length > 0
        ? "needs_attention"
        : isInactiveMember
          ? "inactive"
          : "on_track";

    if (statusFlag === "needs_attention") needsAttentionCount += 1;

    people.push({
      personId,
      fullName: first.fullName,
      email: first.email,
      phoneNumber: first.phoneNumber ?? null,
      roles,
      committeeNames,
      isActive,
      isLeaderboardEligible: isEligible,
      points,
      attendancePoints: pointsBreakdown.attendancePoints,
      assignmentPoints: pointsBreakdown.assignmentPoints,
      taskPoints: pointsBreakdown.taskPoints,
      bonusPoints: pointsBreakdown.bonusPoints,
      deductionPoints: pointsBreakdown.deductionPoints,
      tier,
      attendedCount,
      expectedSessionsCount: expectedCount,
      excusedCount,
      lateCount,
      attendanceRate: personAttendanceRate,
      punctualityRate: personPunctualityRate,
      completedWorkCount,
      assignedWorkCount: pSubs.length,
      assignmentsCompletedCount,
      assignmentsAssignedCount: pAssignSubs.length,
      tasksCompletedCount,
      tasksAssignedCount: pTaskSubs.length,
      workCompletionRate,
      overdueCount,
      avgEffort: roundDecimal(pEfforts, 1),
      avgQuality: roundDecimal(pQualities, 1),
      avgTimeliness: roundDecimal(pTimeliness, 1),
      recognitionsCount,
      warningsCount,
      internalNotesCount,
      attentionReasons,
      statusFlag,
    });
  }

  people.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.fullName.localeCompare(b.fullName);
  });

  // Monthly trend chart (chronological across the season, respecting non-month filters)
  const monthlyTrend: MonthlyTrendPoint[] = sortedMonths.map((month) => {
    const mLedger = dataset.ledger.filter((l) => l.month === month);
    let mTotalPts = 0;
    let mEligibleSum = 0;
    for (const pid of primaryPersonIds) {
      const pts = computePointsForPerson(
        pid,
        mLedger,
        activeCommitteeFocusId,
        primaryMembershipIds
      );
      mTotalPts += pts;
      if (eligiblePersonIds.has(pid)) mEligibleSum += pts;
    }

    const mSessions = dataset.sessions.filter((s) => {
      if (s.month !== month) return false;
      if (Date.parse(s.startsAt) > nowMs) return false;
      if (activeCommitteeFocusId !== null) {
        return s.committeeId === activeCommitteeFocusId;
      }
      if (trackCommitteeIds !== null) {
        return s.committeeId !== null && trackCommitteeIds.has(s.committeeId);
      }
      return true;
    });
    const mSessionIds = new Set(mSessions.map((s) => s.id));
    let mPresent = 0;
    let mDenom = 0;
    for (const s of mSessions) {
      const sAtt = dataset.attendance.filter(
        (a) => a.sessionId === s.id && primaryPersonIds.has(a.personId)
      );
      const uniquePresent = new Set(
        sAtt.filter((a) => a.status === "present").map((a) => a.personId)
      ).size;
      const uniqueExcused = new Set(
        sAtt.filter((a) => a.status === "excused").map((a) => a.personId)
      ).size;
      const audience =
        s.committeeId !== null
          ? (membersByCommitteePersons.get(s.committeeId)?.size ?? 0)
          : primaryPersonIds.size;
      const expected = Math.max(audience, new Set(sAtt.map((a) => a.personId)).size);
      mPresent += uniquePresent;
      mDenom += expected > 0 ? Math.max(1, expected - uniqueExcused) : 0;
    }

    return {
      month,
      monthLabel: formatShortMonthLabel(month),
      isPublished: publishedMonthSet.has(month),
      totalPoints: mTotalPts,
      avgMemberPoints:
        eligiblePersonIds.size > 0
          ? Math.round(mEligibleSum / eligiblePersonIds.size)
          : 0,
      attendanceRate: roundPercent(mPresent, mDenom),
      sessionsCount: mSessionIds.size,
    };
  });

  // Committee comparison table & chart (for multi-committee scopes)
  const visibleCommittees = dataset.committees.filter((c) => {
    if (filters.trackId !== "all" && c.trackId !== filters.trackId) return false;
    if (
      filters.committeeId !== "all" &&
      filters.committeeId !== "unassigned" &&
      c.id !== filters.committeeId
    ) {
      return false;
    }
    return true;
  });

  const committeeComparison: CommitteeStatRow[] =
    dataset.committees.length > 1
      ? visibleCommittees
          .map((comm) => {
            const commMemberships = primaryMemberships.filter(
              (m) => m.committeeId === comm.id
            );
            const commMembershipIds = new Set(commMemberships.map((m) => m.id));
            const commPersonIds = new Set(commMemberships.map((m) => m.personId));
            const commEligibleIds = new Set(
              commMemberships
                .filter((m) => isLeaderboardRole(m.role))
                .map((m) => m.personId)
            );

            const commPointsList = Array.from(commEligibleIds).map((pid) =>
              computePointsForPerson(
                pid,
                periodLedgerAll,
                comm.id,
                commMembershipIds
              )
            );
            const commAvgPts =
              commPointsList.length > 0
                ? Math.round(
                    commPointsList.reduce((s, v) => s + v, 0) /
                      commPointsList.length
                  )
                : 0;
            const commMedianPts = computeMedian(commPointsList, 0);

            const commSessions = scopedPastSessions.filter(
              (s) => s.committeeId === comm.id
            );
            let cPresent = 0;
            let cOnTime = 0;
            let cDenom = 0;
            for (const s of commSessions) {
              const sRecs = dedupAttendance.filter(
                (a) => a.sessionId === s.id && commPersonIds.has(a.personId)
              );
              const pres = sRecs.filter((a) => a.status === "present");
              const exc = sRecs.filter((a) => a.status === "excused");
              const expected = Math.max(commPersonIds.size, sRecs.length);
              cPresent += pres.length;
              cOnTime += pres.filter((a) => a.isPunctual).length;
              cDenom += expected > 0 ? Math.max(1, expected - exc.length) : 0;
            }

            const commSubs = scopedSubmissions.filter((s) => {
              const t = taskById.get(s.taskId);
              if (!t) return false;
              return (
                t.committeeId === comm.id ||
                (t.committeeId === null && commMembershipIds.has(s.membershipId))
              );
            });
            const commAssignSubs = commSubs.filter(
              (s) => taskById.get(s.taskId)?.workType === "assignment"
            );
            const commTaskSubs = commSubs.filter(
              (s) => taskById.get(s.taskId)?.workType === "task"
            );
            const commCompleted = commSubs.filter(
              (s) => s.gradedAt !== null
            ).length;
            const commAssignCompleted = commAssignSubs.filter(
              (s) => s.gradedAt !== null
            ).length;
            const commTaskCompleted = commTaskSubs.filter(
              (s) => s.gradedAt !== null
            ).length;
            const commPendingGrading = commSubs.filter(
              (s) => s.submittedAt !== null && s.gradedAt === null
            ).length;

            const commWarnings = scopedFeedback.filter(
              (f) =>
                commPersonIds.has(f.personId) &&
                f.isPublished &&
                (f.category === "warning" || f.isWarning)
            ).length;

            const commPeopleRows = people.filter((p) =>
              commPersonIds.has(p.personId)
            );
            const commParticipating = commPeopleRows.filter(
              (p) =>
                p.attendedCount > 0 ||
                p.completedWorkCount > 0 ||
                p.points !== 0
            ).length;
            const commNeedsAttention = commPeopleRows.filter(
              (p) => p.statusFlag === "needs_attention"
            ).length;

            return {
              committeeId: comm.id,
              committeeName: comm.name,
              trackName: comm.trackId
                ? (trackById.get(comm.trackId)?.name ?? null)
                : null,
              managedPeopleCount: commPersonIds.size,
              eligibleMemberCount: commEligibleIds.size,
              participationRate: roundPercent(
                commParticipating,
                commPersonIds.size
              ),
              avgPoints: commAvgPts,
              medianPoints: commMedianPts,
              attendanceRate: roundPercent(cPresent, cDenom),
              punctualityRate: roundPercent(cOnTime, cPresent),
              assignmentCompletionRate: roundPercent(
                commAssignCompleted,
                commAssignSubs.length
              ),
              taskCompletionRate: roundPercent(
                commTaskCompleted,
                commTaskSubs.length
              ),
              workCompletionRate: roundPercent(commCompleted, commSubs.length),
              pendingGradingCount: commPendingGrading,
              warningsCount: commWarnings,
              needsAttentionCount: commNeedsAttention,
            };
          })
          .sort((a, b) => {
            if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
            return a.committeeName.localeCompare(b.committeeName);
          })
      : [];

  // Track rollup (chapter roles with >1 track)
  const trackRollup: TrackRollupRow[] =
    dataset.tracks.length > 1 && committeeComparison.length > 0
      ? dataset.tracks
          .map((track) => {
            const trackComms = committeeComparison.filter(
              (c) => c.trackName === track.name
            );
            const totalMembers = trackComms.reduce(
              (s, c) => s + c.managedPeopleCount,
              0
            );
            const weightedPts = trackComms.reduce(
              (s, c) => s + c.avgPoints * Math.max(1, c.eligibleMemberCount),
              0
            );
            const totalEligible = trackComms.reduce(
              (s, c) => s + c.eligibleMemberCount,
              0
            );
            const avgAtt =
              trackComms.length > 0
                ? Math.round(
                    trackComms.reduce((s, c) => s + c.attendanceRate, 0) /
                      trackComms.length
                  )
                : 0;
            const avgWork =
              trackComms.length > 0
                ? Math.round(
                    trackComms.reduce((s, c) => s + c.workCompletionRate, 0) /
                      trackComms.length
                  )
                : 0;

            return {
              trackId: track.id,
              trackName: track.name,
              committeesCount: trackComms.length,
              managedPeopleCount: totalMembers,
              avgPoints:
                totalEligible > 0 ? Math.round(weightedPts / totalEligible) : 0,
              attendanceRate: avgAtt,
              workCompletionRate: avgWork,
            };
          })
          .filter((t) => t.committeesCount > 0)
      : [];

  // HR Health strip (master_admin and hr_admin only)
  let hrHealth: HrHealthMetrics | null = null;
  if (dataset.canViewHrHealth) {
    const trackableCommittees = dataset.committees.filter(
      (c) => c.slug !== "human-resources"
    );
    const coveredSet = new Set(dataset.hrCoveredCommitteeIds);
    const uncoveredCommittees = trackableCommittees
      .filter((c) => !coveredSet.has(c.id))
      .map((c) => c.name);
    const activeLedgerMonths = Array.from(
      new Set(dataset.ledger.map((l) => l.month))
    ).sort();
    const unpublishedMonths = activeLedgerMonths.filter(
      (m) => !publishedMonthSet.has(m)
    );

    hrHealth = {
      totalCommittees: trackableCommittees.length,
      coveredCommittees: trackableCommittees.length - uncoveredCommittees.length,
      uncoveredCommittees,
      activeMonthsCount: activeLedgerMonths.length,
      publishedMonthsCount: activeLedgerMonths.length - unpublishedMonths.length,
      unpublishedMonths,
    };
  }

  return {
    availableMonths,
    summary: {
      managedPeopleCount: primaryPersonIds.size,
      totalScopedPeopleCount: allScopedNonAttendeePersons.size,
      attendeeCount: attendeePersons.size,
      participatingPeopleCount,
      activeParticipationRate: roundPercent(
        participatingPeopleCount,
        primaryPersonIds.size
      ),
      inactiveMembersCount,
      eligibleMemberCount: eligiblePersonIds.size,
      portalActivationRate: dataset.canViewPortalActivation
        ? roundPercent(activatedPeopleCount, primaryPersonIds.size)
        : null,
      activatedPeopleCount: dataset.canViewPortalActivation
        ? activatedPeopleCount
        : null,
      netPoints,
      avgMemberPoints,
      medianMemberPoints,
      sessionsHeldCount: scopedPastSessions.length,
      branchWideSessionsCount,
      committeeSessionsCount,
      attendanceRate,
      punctualityRate,
      manualOverrideRate,
      needsAttentionCount,
    },
    attendanceBreakdown,
    pointsBySource,
    tierDistribution,
    roleDistribution,
    monthlyTrend,
    assignments,
    tasks,
    feedback,
    committeeComparison,
    trackRollup,
    hrHealth,
    people,
  };
}

/**
 * Computes the admin-only (hidden from public/members) cumulative season-wide leaderboard.
 * - Always spans the full selected season across all months.
 * - Ranks leaderboard-eligible roles only (`member` and `hr_member`), deduplicated by `personId`.
 * - Preserves `overallRank` from the actor's full scope even when filters narrow the view.
 * - When filtered to a specific committee C, applies the Spec §4 committee-board rule:
 *   only eligible people whose home committee is C (`hr_member` on `human-resources` only),
 *   scored by committee-C ledger entries + open ledger entries counted once.
 */
export function computeSeasonLeaderboard(
  dataset: AdminStatisticsDataset,
  filters: SeasonLeaderboardFilters = DEFAULT_SEASON_LEADERBOARD_FILTERS,
  now: Date = new Date()
): SeasonLeaderboardEntry[] {
  const committeeById = new Map(dataset.committees.map((c) => [c.id, c]));
  const trackById = new Map(dataset.tracks.map((t) => [t.id, t]));
  const tierThresholds = dataset.seasonSettings.leaderboard.tierThresholds;

  // 1. Compute baseline full-season overall ranks across the actor's entire scope
  const baselineStats = computeAdminStatistics(
    dataset,
    {
      ...DEFAULT_STATISTICS_FILTERS,
      status: filters.status === "all" ? "all" : "active",
      month: "all",
    },
    now
  );

  const baselineEligible = baselineStats.people
    .filter((p) => p.isLeaderboardEligible)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.attendanceRate !== a.attendanceRate) {
        return b.attendanceRate - a.attendanceRate;
      }
      return a.fullName.localeCompare(b.fullName);
    });

  const overallRankByPerson = new Map<string, number>();
  const baselinePersonMap = new Map<string, PersonStatRow>();
  baselineEligible.forEach((p, idx) => {
    overallRankByPerson.set(p.personId, idx + 1);
    baselinePersonMap.set(p.personId, p);
  });

  // 2. Resolve eligible memberships matching the leaderboard's status/committee/track/role filters
  const committeeFocusId =
    filters.committeeId !== "all"
      ? filters.committeeId
      : dataset.scopeKind === "committee" && dataset.committees.length === 1
        ? dataset.committees[0].id
        : null;

  const eligibleMemberships = dataset.members.filter((m) => {
    if (!isLeaderboardRole(m.role)) return false;
    if (filters.status === "active" && !m.isActive) return false;
    if (filters.role !== "all" && m.role !== filters.role) return false;

    if (committeeFocusId !== null) {
      // Strictly home committee (matches Spec §4: hr_member only ranks on human-resources)
      if (m.committeeId !== committeeFocusId) return false;
    }

    if (filters.trackId !== "all") {
      const homeTrackId = m.committeeId
        ? (committeeById.get(m.committeeId)?.trackId ?? null)
        : null;
      if (homeTrackId !== filters.trackId) return false;
    }

    return true;
  });

  const allowedMembershipIds = new Set(eligibleMemberships.map((m) => m.id));
  const hatsByPerson = new Map<string, StatisticsMemberRecord[]>();
  for (const m of eligibleMemberships) {
    const list = hatsByPerson.get(m.personId) ?? [];
    list.push(m);
    hatsByPerson.set(m.personId, list);
  }

  const q = filters.search.trim().toLowerCase();
  const entries: Array<Omit<SeasonLeaderboardEntry, "rank">> = [];

  for (const [personId, hats] of hatsByPerson.entries()) {
    const first = hats[0];
    const digitsQ = q.replace(/\D/g, "");
    const phoneMatch =
      digitsQ.length >= 3 &&
      (first.phoneNumber ?? "").replace(/\D/g, "").includes(digitsQ);
    if (
      q.length > 0 &&
      !first.fullName.toLowerCase().includes(q) &&
      !first.email.toLowerCase().includes(q) &&
      !phoneMatch
    ) {
      continue;
    }

    const breakdown = computePointBreakdownForPerson(
      personId,
      dataset.ledger,
      committeeFocusId,
      allowedMembershipIds
    );
    const tier = deriveActivityTier(breakdown.total, tierThresholds);
    if (filters.tier !== "all" && tier !== filters.tier) continue;

    const baseRow = baselinePersonMap.get(personId);
    const warningsCount = baseRow?.warningsCount ?? 0;
    if (filters.warnings === "with_warnings" && warningsCount === 0) continue;
    if (filters.warnings === "no_warnings" && warningsCount > 0) continue;

    const committeeNames = Array.from(
      new Set(
        hats
          .map((h) =>
            h.committeeId
              ? (committeeById.get(h.committeeId)?.name ?? "Unassigned")
              : "Unassigned"
          )
      )
    );
    const trackNames = Array.from(
      new Set(
        hats
          .map((h) => {
            const c = h.committeeId ? committeeById.get(h.committeeId) : null;
            return c?.trackId ? (trackById.get(c.trackId)?.name ?? null) : null;
          })
          .filter((n): n is string => Boolean(n))
      )
    );

    entries.push({
      overallRank: overallRankByPerson.get(personId) ?? 0,
      personId,
      fullName: first.fullName,
      email: first.email,
      phoneNumber: first.phoneNumber ?? null,
      roles: Array.from(new Set(hats.map((h) => h.role))),
      committeeNames,
      trackNames,
      isActive: hats.some((h) => h.isActive),
      seasonPoints: breakdown.total,
      tier,
      attendancePoints: breakdown.attendancePoints,
      assignmentPoints: breakdown.assignmentPoints,
      taskPoints: breakdown.taskPoints,
      manualNetPoints: breakdown.bonusPoints + breakdown.deductionPoints,
      attendanceRate: baseRow?.attendanceRate ?? 0,
      punctualityRate: baseRow?.punctualityRate ?? 0,
      workCompletionRate: baseRow?.workCompletionRate ?? 0,
      overdueCount: baseRow?.overdueCount ?? 0,
      warningsCount,
      recognitionsCount: baseRow?.recognitionsCount ?? 0,
      internalNotesCount: dataset.canViewHiddenFeedback
        ? (baseRow?.internalNotesCount ?? 0)
        : null,
      activeMonthsCount: breakdown.activeMonths.size,
    });
  }

  entries.sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) {
      return b.seasonPoints - a.seasonPoints;
    }
    if (b.attendanceRate !== a.attendanceRate) {
      return b.attendanceRate - a.attendanceRate;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    overallRank: entry.overallRank || idx + 1,
  }));
}
