import { describe, expect, it } from "vitest";
import {
  computeAdminStatistics,
  computeSeasonLeaderboard,
  DEFAULT_SEASON_LEADERBOARD_FILTERS,
  DEFAULT_STATISTICS_FILTERS,
  type AdminStatisticsDataset,
} from "@/lib/statistics-engine";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/season-settings";

function buildBaseDataset(
  overrides: Partial<AdminStatisticsDataset> = {}
): AdminStatisticsDataset {
  return {
    viewerRole: "master_admin",
    scopeKind: "chapter",
    scopeLabel: "Whole Chapter",
    canViewHiddenFeedback: true,
    canViewPortalActivation: true,
    canViewManualOverrideRate: true,
    canViewHrHealth: true,
    canSwitchSeason: true,
    selectedSeason: { id: "season-1", name: "2026-2027", status: "active" },
    availableSeasons: [{ id: "season-1", name: "2026-2027", status: "active" }],
    seasonSettings: DEFAULT_SEASON_SETTINGS,
    tracks: [
      { id: "track-tech", name: "Technical" },
      { id: "track-ops", name: "Operations" },
    ],
    committees: [
      { id: "comm-ai", name: "AI and Machine Learning", slug: "ai-ml", trackId: "track-tech" },
      { id: "comm-web", name: "Web Development", slug: "web-dev", trackId: "track-tech" },
      { id: "comm-hr", name: "Human Resources", slug: "human-resources", trackId: "track-ops" },
    ],
    members: [
      // Alice: multi-hat person (member in AI + hr_member in HR tracking AI)
      {
        id: "mem-alice-ai",
        personId: "p-alice",
        fullName: "Alice Mansour",
        email: "alice@cu.edu.eg",
        role: "member",
        committeeId: "comm-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      {
        id: "mem-alice-hr",
        personId: "p-alice",
        fullName: "Alice Mansour",
        email: "alice@cu.edu.eg",
        role: "hr_member",
        committeeId: "comm-hr",
        trackedCommitteeId: "comm-ai",
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      // Bob: member in AI, inactive (0 points, 0 attendance, still must change password)
      {
        id: "mem-bob-ai",
        personId: "p-bob",
        fullName: "Bob Adel",
        email: "bob@cu.edu.eg",
        role: "member",
        committeeId: "comm-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: true,
      },
      // Salma: committee_head in AI (not leaderboard-eligible for member point averages)
      {
        id: "mem-salma-head",
        personId: "p-salma",
        fullName: "Salma El-Sayed",
        email: "salma@cu.edu.eg",
        role: "committee_head",
        committeeId: "comm-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      // Karim: member in Web Dev
      {
        id: "mem-karim-web",
        personId: "p-karim",
        fullName: "Karim Nabil",
        email: "karim@cu.edu.eg",
        role: "member",
        committeeId: "comm-web",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: false,
      },
      // Deactivated member in Web Dev (excluded under default status="active")
      {
        id: "mem-old-web",
        personId: "p-old",
        fullName: "Former Member",
        email: "former@cu.edu.eg",
        role: "member",
        committeeId: "comm-web",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: false,
        mustChangePassword: true,
      },
      // Attendee (kept separate from chapter member averages)
      {
        id: "mem-att-1",
        personId: "p-att",
        fullName: "Workshop Attendee",
        email: "att@gmail.com",
        role: "attendee",
        committeeId: "comm-ai",
        trackedCommitteeId: null,
        managedTrackId: null,
        isActive: true,
        mustChangePassword: true,
      },
    ],
    sessions: [
      {
        id: "sess-ai-1",
        committeeId: "comm-ai",
        startsAt: "2026-10-10T14:00:00.000Z",
        month: "2026-10",
      },
      {
        id: "sess-ai-2",
        committeeId: "comm-ai",
        startsAt: "2026-11-10T14:00:00.000Z",
        month: "2026-11",
      },
      // Future session: must NOT count toward sessionsHeld or attendance rates
      {
        id: "sess-ai-future",
        committeeId: "comm-ai",
        startsAt: "2026-12-20T14:00:00.000Z",
        month: "2026-12",
      },
    ],
    attendance: [
      // sess-ai-1: Alice present on-time, Bob excused, Salma present late (with manual override)
      {
        sessionId: "sess-ai-1",
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        status: "present",
        isPunctual: true,
        pointsAwarded: 15,
        hasOverride: false,
      },
      {
        sessionId: "sess-ai-1",
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        status: "excused",
        isPunctual: false,
        pointsAwarded: 0,
        hasOverride: true,
      },
      {
        sessionId: "sess-ai-1",
        membershipId: "mem-salma-head",
        personId: "p-salma",
        status: "present",
        isPunctual: false,
        pointsAwarded: 10,
        hasOverride: true,
      },
      // sess-ai-2: Alice present on-time, Bob absent, Salma present on-time
      {
        sessionId: "sess-ai-2",
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        status: "present",
        isPunctual: true,
        pointsAwarded: 15,
        hasOverride: false,
      },
      {
        sessionId: "sess-ai-2",
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        status: "absent",
        isPunctual: false,
        pointsAwarded: 0,
        hasOverride: false,
      },
      {
        sessionId: "sess-ai-2",
        membershipId: "mem-salma-head",
        personId: "p-salma",
        status: "present",
        isPunctual: true,
        pointsAwarded: 15,
        hasOverride: false,
      },
    ],
    tasks: [
      {
        id: "assign-ai-1",
        committeeId: "comm-ai",
        workType: "assignment",
        dueAt: "2026-10-20T20:00:00.000Z",
        month: "2026-10",
        maxPoints: 100,
      },
      {
        id: "task-ai-1",
        committeeId: "comm-ai",
        workType: "task",
        dueAt: "2026-11-05T20:00:00.000Z",
        month: "2026-11",
        maxPoints: 15,
      },
    ],
    submissions: [
      // Alice submitted assign-ai-1 on time and got graded 12 hours later
      {
        taskId: "assign-ai-1",
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        effortScore: 5,
        qualityScore: 4,
        timelinessScore: 5,
        totalPoints: 80,
        submittedAt: "2026-10-19T10:00:00.000Z",
        gradedAt: "2026-10-19T22:00:00.000Z",
      },
      // Bob never submitted assign-ai-1 (overdue)
      {
        taskId: "assign-ai-1",
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        effortScore: null,
        qualityScore: null,
        timelinessScore: null,
        totalPoints: null,
        submittedAt: null,
        gradedAt: null,
      },
      // Alice completed HR task-ai-1
      {
        taskId: "task-ai-1",
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        effortScore: null,
        qualityScore: null,
        timelinessScore: null,
        totalPoints: 15,
        submittedAt: "2026-11-04T10:00:00.000Z",
        gradedAt: "2026-11-04T12:00:00.000Z",
      },
      // Bob never submitted HR task-ai-1 (overdue -> 2 overdue items!)
      {
        taskId: "task-ai-1",
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        effortScore: null,
        qualityScore: null,
        timelinessScore: null,
        totalPoints: null,
        submittedAt: null,
        gradedAt: null,
      },
    ],
    ledger: [
      {
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        month: "2026-10",
        sourceType: "attendance",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 15,
      },
      {
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        month: "2026-10",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 80,
      },
      {
        membershipId: "mem-alice-hr",
        personId: "p-alice",
        month: "2026-10",
        sourceType: "manual_override",
        postingScope: "open",
        committeeId: null,
        points: 20,
      },
      {
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        month: "2026-11",
        sourceType: "attendance",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 15,
      },
      {
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        month: "2026-11",
        sourceType: "task",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 15,
      },
      {
        membershipId: "mem-karim-web",
        personId: "p-karim",
        month: "2026-10",
        sourceType: "assignment",
        postingScope: "committee",
        committeeId: "comm-web",
        points: 60,
      },
      {
        membershipId: "mem-karim-web",
        personId: "p-karim",
        month: "2026-11",
        sourceType: "manual_override",
        postingScope: "committee",
        committeeId: "comm-web",
        points: -10,
      },
    ],
    feedback: [
      {
        membershipId: "mem-alice-ai",
        personId: "p-alice",
        month: "2026-10",
        category: "recognition",
        pointsDelta: 20,
        isPublished: true,
        isWarning: false,
      },
      {
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        month: "2026-11",
        category: "warning",
        pointsDelta: -10,
        isPublished: true,
        isWarning: true,
      },
      {
        membershipId: "mem-bob-ai",
        personId: "p-bob",
        month: "2026-11",
        category: "internal_note",
        pointsDelta: 0,
        isPublished: false,
        isWarning: false,
      },
    ],
    snapshots: [{ month: "2026-10", status: "published" }],
    hrCoveredCommitteeIds: ["comm-ai"],
    ...overrides,
  };
}

const FIXED_NOW = new Date("2026-11-24T12:00:00.000Z");

describe("computeAdminStatistics pure engine", () => {
  it("deduplicates multi-hat persons, excludes deactivated & attendees by default, and computes exact score & attendance metrics", () => {
    const stats = computeAdminStatistics(
      buildBaseDataset(),
      DEFAULT_STATISTICS_FILTERS,
      FIXED_NOW
    );

    // Active non-attendee distinct people: Alice, Bob, Salma, Karim = 4 (Alice's 2 hats count once!)
    expect(stats.summary.managedPeopleCount).toBe(4);
    expect(stats.summary.attendeeCount).toBe(1);

    // Eligible leaderboard members (member/hr_member): Alice (145), Bob (0), Karim (50)
    expect(stats.summary.eligibleMemberCount).toBe(3);
    expect(stats.summary.netPoints).toBe(195); // 15+80+20+15+15+60-10 = 195
    expect(stats.summary.avgMemberPoints).toBe(65); // 195 / 3 = 65
    expect(stats.summary.medianMemberPoints).toBe(50); // sorted [0, 50, 145] -> 50

    // Inactive eligible members: Bob (0 pts, 0 present) = 1
    expect(stats.summary.inactiveMembersCount).toBe(1);

    // Portal activation: Alice(false), Bob(true), Salma(false), Karim(false) -> 3/4 = 75%
    expect(stats.summary.portalActivationRate).toBe(75);

    // Past sessions held: sess-ai-1 & sess-ai-2 (future session excluded!)
    expect(stats.summary.sessionsHeldCount).toBe(2);

    // Attendance rate (excused-adjusted):
    // sess-ai-1: expected active AI non-attendee = 3 (Alice, Bob, Salma), excused = 1 (Bob) -> denom 2, present 2
    // sess-ai-2: expected 3, excused = 0 -> denom 3, present 2
    // total present = 4, total adjusted denom = 5 -> 80%
    expect(stats.summary.attendanceRate).toBe(80);
    // Punctuality: 3 on-time out of 4 present -> 75%
    expect(stats.summary.punctualityRate).toBe(75);
    // Manual override rate: 2 overrides out of 6 records -> 33%
    expect(stats.summary.manualOverrideRate).toBe(33);

    // Assignments vs Tasks split
    expect(stats.assignments.totalSubmissions).toBe(2);
    expect(stats.assignments.submissionRate).toBe(50);
    expect(stats.assignments.gradedRate).toBe(50);
    expect(stats.assignments.onTimeRate).toBe(100);
    expect(stats.assignments.overdueCount).toBe(1);
    expect(stats.assignments.pendingGradingCount).toBe(0);
    expect(stats.assignments.medianTurnaroundHours).toBe(12);
    expect(stats.assignments.avgEffort).toBe(5);
    expect(stats.assignments.avgQuality).toBe(4);
    expect(stats.assignments.avgTimeliness).toBe(5);
    expect(stats.assignments.avgScorePercent).toBe(80);

    expect(stats.tasks.totalSubmissions).toBe(2);
    expect(stats.tasks.completedCount).toBe(1);
    expect(stats.tasks.completionRate).toBe(50);
    expect(stats.tasks.overdueCount).toBe(1);

    // Feedback breakdown (includes internal notes for master_admin)
    expect(stats.feedback.recognition).toBe(1);
    expect(stats.feedback.warning).toBe(1);
    expect(stats.feedback.internalNote).toBe(1);
    expect(stats.feedback.bonusPoints).toBe(20);
    expect(stats.feedback.deductionPoints).toBe(-10);

    // Bob triggers needs_attention (0% attendance across 2 sessions, 2 overdue, 1 warning, 0 pts)
    const bob = stats.people.find((p) => p.personId === "p-bob");
    expect(bob?.statusFlag).toBe("needs_attention");
    expect(bob?.attentionReasons.length).toBeGreaterThanOrEqual(3);
    expect(bob?.warningsCount).toBe(1);
    expect(bob?.excusedCount).toBe(1);
    expect(bob?.overdueCount).toBe(2);
    expect(bob?.assignmentsAssignedCount).toBe(1);
    expect(bob?.assignmentsCompletedCount).toBe(0);
    expect(bob?.tasksAssignedCount).toBe(1);
    expect(bob?.tasksCompletedCount).toBe(0);

    // Alice per-member detailed stats
    const alice = stats.people.find((p) => p.personId === "p-alice");
    expect(alice?.attendancePoints).toBe(30);
    expect(alice?.assignmentPoints).toBe(80);
    expect(alice?.taskPoints).toBe(15);
    expect(alice?.bonusPoints).toBe(20);
    expect(alice?.deductionPoints).toBe(0);
    expect(alice?.recognitionsCount).toBe(1);
    expect(alice?.warningsCount).toBe(0);
    expect(alice?.punctualityRate).toBe(100);
    expect(alice?.lateCount).toBe(0);

    // Salma (committee head) was late once on sess-ai-1
    const salma = stats.people.find((p) => p.personId === "p-salma");
    expect(salma?.lateCount).toBe(1);
    expect(salma?.punctualityRate).toBe(50);

    // HR health strip
    expect(stats.hrHealth?.coveredCommittees).toBe(1);
    expect(stats.hrHealth?.totalCommittees).toBe(2); // excludes human-resources itself from tracked committees
    expect(stats.hrHealth?.uncoveredCommittees).toEqual(["Web Development"]);
    expect(stats.hrHealth?.publishedMonthsCount).toBe(1);
    expect(stats.hrHealth?.unpublishedMonths).toEqual(["2026-11"]);
  });

  it("supports all Roster-matching filters (role, committee, track, status, search) plus month filtering", () => {
    const dataset = buildBaseDataset();

    // Status="inactive" reveals Former Member
    const inactiveOnly = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, status: "inactive" },
      FIXED_NOW
    );
    expect(inactiveOnly.people.map((p) => p.fullName)).toEqual(["Former Member"]);

    // Committee filter to Web Development scopes points and people to Karim only
    const webOnly = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, committeeId: "comm-web" },
      FIXED_NOW
    );
    expect(webOnly.summary.managedPeopleCount).toBe(1);
    expect(webOnly.summary.netPoints).toBe(50);

    // Track filter to Operations includes HR hat for Alice
    const opsOnly = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, trackId: "track-ops" },
      FIXED_NOW
    );
    expect(opsOnly.people.map((p) => p.personId)).toEqual(["p-alice"]);

    // Role filter to committee_head returns Salma only
    const headsOnly = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, role: "committee_head" },
      FIXED_NOW
    );
    expect(headsOnly.people.map((p) => p.fullName)).toEqual(["Salma El-Sayed"]);

    // Search filter matches by name or email
    const searchKarim = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, search: "karim@cu" },
      FIXED_NOW
    );
    expect(searchKarim.people.map((p) => p.fullName)).toEqual(["Karim Nabil"]);

    // Month filter to 2026-10 includes only October points (Alice 15+80+20=115, Karim 60 -> 175)
    const octOnly = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, month: "2026-10" },
      FIXED_NOW
    );
    expect(octOnly.summary.netPoints).toBe(175);
    expect(octOnly.summary.sessionsHeldCount).toBe(1);
    expect(octOnly.assignments.totalSubmissions).toBe(2);
    expect(octOnly.tasks.totalSubmissions).toBe(0);
  });

  it("hides internal notes, portal activation, manual override rate, and HR health for committee_head", () => {
    const dataset = buildBaseDataset({
      viewerRole: "committee_head",
      scopeKind: "committee",
      scopeLabel: "AI and Machine Learning",
      canViewHiddenFeedback: false,
      canViewPortalActivation: false,
      canViewManualOverrideRate: false,
      canViewHrHealth: false,
      canSwitchSeason: false,
      // Even if a hidden row were somehow passed in memory, pure engine still blocks it
    });

    const stats = computeAdminStatistics(
      dataset,
      { ...DEFAULT_STATISTICS_FILTERS, committeeId: "comm-ai" },
      FIXED_NOW
    );

    expect(stats.feedback.internalNote).toBeNull();
    expect(stats.summary.portalActivationRate).toBeNull();
    expect(stats.summary.manualOverrideRate).toBeNull();
    expect(stats.hrHealth).toBeNull();
    for (const person of stats.people) {
      expect(person.internalNotesCount).toBeNull();
    }
    // Committee head still sees both assignments and tasks for their committee!
    expect(stats.assignments.totalSubmissions).toBe(2);
    expect(stats.tasks.totalSubmissions).toBe(2);
  });

  it("computes the hidden season-wide leaderboard with multi-hat deduplication, role/committee/track/tier/warnings filtering, and preserved overallRank", () => {
    const dataset = buildBaseDataset();

    // Unfiltered chapter-wide season leaderboard ranks only eligible active roles (Alice #1: 145, Karim #2: 50, Bob #3: 0)
    // Excludes Salma (committee_head), Former Member (inactive), and Workshop Attendee
    const fullBoard = computeSeasonLeaderboard(
      dataset,
      DEFAULT_SEASON_LEADERBOARD_FILTERS,
      FIXED_NOW
    );
    expect(fullBoard.map((r) => [r.rank, r.overallRank, r.fullName, r.seasonPoints])).toEqual([
      [1, 1, "Alice Mansour", 145],
      [2, 2, "Karim Nabil", 50],
      [3, 3, "Bob Adel", 0],
    ]);
    expect(fullBoard[0].activeMonthsCount).toBe(2);
    expect(fullBoard[2].warningsCount).toBe(1);

    // Filtering by committee (Web Dev) keeps Karim with rank #1 in committee, overallRank #2
    const webBoard = computeSeasonLeaderboard(
      dataset,
      { ...DEFAULT_SEASON_LEADERBOARD_FILTERS, committeeId: "comm-web" },
      FIXED_NOW
    );
    expect(webBoard).toHaveLength(1);
    expect(webBoard[0].fullName).toBe("Karim Nabil");
    expect(webBoard[0].rank).toBe(1);
    expect(webBoard[0].overallRank).toBe(2);
    expect(webBoard[0].seasonPoints).toBe(50);

    // Filtering by warnings="with_warnings" returns only Bob (overallRank #3)
    const warnedBoard = computeSeasonLeaderboard(
      dataset,
      { ...DEFAULT_SEASON_LEADERBOARD_FILTERS, warnings: "with_warnings" },
      FIXED_NOW
    );
    expect(warnedBoard.map((r) => r.fullName)).toEqual(["Bob Adel"]);
    expect(warnedBoard[0].overallRank).toBe(3);

    // Filtering by role="hr_member" returns only Alice (and on Human Resources committee uses HR + open points = 20)
    const hrBoard = computeSeasonLeaderboard(
      dataset,
      { ...DEFAULT_SEASON_LEADERBOARD_FILTERS, committeeId: "comm-hr" },
      FIXED_NOW
    );
    expect(hrBoard).toHaveLength(1);
    expect(hrBoard[0].fullName).toBe("Alice Mansour");
    expect(hrBoard[0].seasonPoints).toBe(20); // open 20 pts only (AI committee-scoped pts excluded on HR board!)

    // Filtering by tier="Bronze" (50..149 pts with default thresholds) returns Alice (145) & Karim (50)
    const bronzeBoard = computeSeasonLeaderboard(
      dataset,
      { ...DEFAULT_SEASON_LEADERBOARD_FILTERS, tier: "Bronze" },
      FIXED_NOW
    );
    expect(bronzeBoard.map((r) => r.fullName)).toEqual(["Alice Mansour", "Karim Nabil"]);
  });
});
