import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canSwitchStatisticsSeason,
  canViewHiddenFeedback,
  getOperationalCommitteeScope,
} from "@/lib/permissions";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
} from "@/lib/season-settings";
import { inferFeedbackCategory } from "@/lib/feedback-categories";
import {
  formatMonthInCairo,
  getDirectorTrackCommitteeIds,
} from "@/services/hr-ops/helpers";
import { ensureDefaultTracksForSeason } from "@/services/hr-ops/committees.service";
import type {
  AdminStatisticsDataset,
  StatisticsScopeKind,
  StatisticsSeasonOption,
} from "@/lib/statistics-engine";

export interface StatisticsActor {
  id: string;
  personId: string;
  role: MembershipRole;
  committeeId: string | null;
  committeeName?: string;
  trackedCommitteeId?: string | null;
  trackedCommitteeName?: string;
  managedTrackId?: string | null;
  managedTrackName?: string;
}

function buildEmptyDataset(params: {
  actor: StatisticsActor;
  scopeKind: StatisticsScopeKind;
  scopeLabel: string;
  canSwitchSeason: boolean;
  selectedSeason: StatisticsSeasonOption | null;
  availableSeasons: StatisticsSeasonOption[];
}): AdminStatisticsDataset {
  const {
    actor,
    scopeKind,
    scopeLabel,
    canSwitchSeason,
    selectedSeason,
    availableSeasons,
  } = params;
  const isChapterHrOrMaster =
    actor.role === "master_admin" || actor.role === "hr_admin";

  return {
    viewerRole: actor.role,
    scopeKind,
    scopeLabel,
    canViewHiddenFeedback: canViewHiddenFeedback(actor.role),
    canViewPortalActivation: isChapterHrOrMaster,
    canViewManualOverrideRate:
      isChapterHrOrMaster || actor.role === "hr_member",
    canViewHrHealth: isChapterHrOrMaster,
    canSwitchSeason,
    selectedSeason,
    availableSeasons,
    seasonSettings: DEFAULT_SEASON_SETTINGS,
    tracks: [],
    committees: [],
    members: [],
    sessions: [],
    attendance: [],
    tasks: [],
    submissions: [],
    ledger: [],
    feedback: [],
    snapshots: [],
    hrCoveredCommitteeIds: [],
  };
}

/**
 * Loads the strictly role-scoped and SQL-privacy-filtered statistics dataset
 * for an operational user in `/hr/statistics`.
 *
 * Security invariants enforced at the query layer:
 * 1. `committee_head` never receives `is_published = false` feedback rows.
 * 2. No actor ever receives feedback rows targeting any of their own `person_id` hats.
 * 3. Free-text content (`hr_feedback.content`, `task_submissions.notes`, `submission_text`)
 *    is never selected or returned.
 * 4. `hr_member` with null `trackedCommitteeId` receives an empty dataset (never HR home scope).
 * 5. Only `master_admin` and `hr_admin` may switch to archived/other seasons.
 */
export async function getAdminStatisticsDatasetForActor(input: {
  actor: StatisticsActor;
  seasonId?: string | null;
}): Promise<AdminStatisticsDataset> {
  const { actor, seasonId: requestedSeasonId } = input;
  const canSwitchSeason = canSwitchStatisticsSeason(actor.role);
  const isChapterHrOrMaster =
    actor.role === "master_admin" || actor.role === "hr_admin";
  const isCommitteeScoped =
    actor.role === "committee_head" || actor.role === "hr_member";
  const operationalCommitteeId = getOperationalCommitteeScope(actor);
  const isTrackDirector =
    actor.role === "director" && Boolean(actor.managedTrackId);

  const scopeKind: StatisticsScopeKind = isCommitteeScoped
    ? "committee"
    : isTrackDirector
      ? "track"
      : "chapter";

  const fallbackScopeLabel = isCommitteeScoped
    ? actor.role === "hr_member"
      ? (actor.trackedCommitteeName ?? "Unassigned HR Committee")
      : (actor.committeeName ?? "Assigned Committee")
    : isTrackDirector
      ? `${actor.managedTrackName ?? "Assigned"} Track`
      : "Whole Chapter";

  const dbSeasons = await db
    .select({
      id: schema.seasons.id,
      name: schema.seasons.name,
      status: schema.seasons.status,
      settingsJson: schema.seasons.settingsJson,
    })
    .from(schema.seasons)
    .orderBy(desc(schema.seasons.startDate), asc(schema.seasons.createdAt));

  const activeSeason = dbSeasons.find((s) => s.status === "active") ?? null;
  const availableSeasons: StatisticsSeasonOption[] = (
    canSwitchSeason ? dbSeasons : activeSeason ? [activeSeason] : []
  ).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }));

  const targetSeason =
    canSwitchSeason && requestedSeasonId
      ? (dbSeasons.find((s) => s.id === requestedSeasonId) ?? activeSeason)
      : activeSeason;

  if (!targetSeason) {
    return buildEmptyDataset({
      actor,
      scopeKind,
      scopeLabel: fallbackScopeLabel,
      canSwitchSeason,
      selectedSeason: null,
      availableSeasons,
    });
  }

  const selectedSeasonOption: StatisticsSeasonOption = {
    id: targetSeason.id,
    name: targetSeason.name,
    status: targetSeason.status,
  };

  // Unassigned HR member or Committee Head gets strictly empty statistics
  if (isCommitteeScoped && !operationalCommitteeId) {
    return buildEmptyDataset({
      actor,
      scopeKind,
      scopeLabel: "No Assigned Committee",
      canSwitchSeason,
      selectedSeason: selectedSeasonOption,
      availableSeasons,
    });
  }

  const seasonId = targetSeason.id;
  const seasonSettings = normalizeSeasonSettings(targetSeason.settingsJson);

  // Never mutate archived seasons; only seed default tracks for non-archived seasons
  const dbTracks =
    targetSeason.status === "archived"
      ? await db
          .select()
          .from(schema.committeeTracks)
          .where(eq(schema.committeeTracks.seasonId, seasonId))
          .orderBy(
            asc(schema.committeeTracks.sortOrder),
            asc(schema.committeeTracks.createdAt)
          )
      : await ensureDefaultTracksForSeason(seasonId);

  const directorTrackCommitteeIds = isTrackDirector
    ? await getDirectorTrackCommitteeIds(
        seasonId,
        actor.role,
        actor.managedTrackId
      )
    : null;

  const allowedCommitteeIds: string[] | null = isCommitteeScoped
    ? [operationalCommitteeId!]
    : directorTrackCommitteeIds
      ? Array.from(directorTrackCommitteeIds)
      : null;

  // If a Track Director has zero committees in their track, return empty scoped dataset
  if (allowedCommitteeIds !== null && allowedCommitteeIds.length === 0) {
    return buildEmptyDataset({
      actor,
      scopeKind,
      scopeLabel: fallbackScopeLabel,
      canSwitchSeason,
      selectedSeason: selectedSeasonOption,
      availableSeasons,
    });
  }

  // Load committees, memberships (with person metadata), and actor's own hats for privacy exclusion
  const [dbCommittees, dbAllSeasonMembers, dbSnapshots] = await Promise.all([
    db
      .select({
        id: schema.committees.id,
        name: schema.committees.name,
        slug: schema.committees.slug,
        trackId: schema.committees.trackId,
      })
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.seasonId, seasonId),
          eq(schema.committees.isActive, true),
          ...(allowedCommitteeIds !== null
            ? [inArray(schema.committees.id, allowedCommitteeIds)]
            : [])
        )
      )
      .orderBy(asc(schema.committees.name)),
    db
      .select({
        id: schema.rosterMemberships.id,
        personId: schema.persons.id,
        fullName: schema.persons.fullName,
        email: schema.persons.email,
        role: schema.rosterMemberships.role,
        committeeId: schema.rosterMemberships.committeeId,
        trackedCommitteeId: schema.rosterMemberships.trackedCommitteeId,
        managedTrackId: schema.rosterMemberships.managedTrackId,
        membershipActive: schema.rosterMemberships.isActive,
        personActive: schema.persons.isActive,
        mustChangePassword: schema.persons.mustChangePassword,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.rosterMemberships.seasonId, seasonId)),
    db
      .select({
        month: schema.monthlySnapshots.month,
        status: schema.monthlySnapshots.status,
      })
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.seasonId, seasonId)),
  ]);

  const allowedCommitteeSet =
    allowedCommitteeIds !== null ? new Set(allowedCommitteeIds) : null;

  // Resolve ALL membership IDs owned by the viewing person in this season
  // so feedback written about any of their hats is never queried or leaked.
  const ownMembershipIds = Array.from(
    new Set([
      actor.id,
      ...dbAllSeasonMembers
        .filter((m) => m.personId === actor.personId)
        .map((m) => m.id),
    ])
  );

  // HR coverage (for Master Admin & HR Admin health strip)
  const hrCoveredCommitteeIds = isChapterHrOrMaster
    ? Array.from(
        new Set(
          dbAllSeasonMembers
            .filter(
              (m) =>
                m.role === "hr_member" &&
                m.membershipActive &&
                m.personActive &&
                m.trackedCommitteeId !== null
            )
            .map((m) => m.trackedCommitteeId!)
        )
      )
    : [];

  // Scope memberships to the actor's managed people
  const scopedMembers = dbAllSeasonMembers.filter((m) => {
    if (!allowedCommitteeSet) return true;
    if (isCommitteeScoped) {
      return m.committeeId !== null && allowedCommitteeSet.has(m.committeeId);
    }
    // Track Director sees members of committees in their track + HR officers tracking those committees
    if (m.role === "hr_member" && m.trackedCommitteeId) {
      return allowedCommitteeSet.has(m.trackedCommitteeId);
    }
    return m.committeeId !== null && allowedCommitteeSet.has(m.committeeId);
  });

  const scopedMembershipIds = scopedMembers.map((m) => m.id);
  const scopedPersonIds = Array.from(new Set(scopedMembers.map((m) => m.personId)));
  const personIdByMembershipId = new Map(
    dbAllSeasonMembers.map((m) => [m.id, m.personId])
  );

  // Scoped tracks for the filter bar
  const visibleTrackIds = new Set(
    dbCommittees.map((c) => c.trackId).filter((id): id is string => Boolean(id))
  );
  const scopedTracks =
    allowedCommitteeSet !== null
      ? dbTracks.filter((t) => visibleTrackIds.has(t.id))
      : dbTracks;

  const resolvedScopeLabel =
    isCommitteeScoped && dbCommittees[0]
      ? dbCommittees[0].name
      : fallbackScopeLabel;

  // Query sessions, attendance, tasks (both assignment & task), submissions, ledger, and privacy-guarded feedback in parallel
  const canSeeHidden = canViewHiddenFeedback(actor.role);

  const [
    dbSessions,
    dbTasks,
    dbSubmissions,
    dbLedger,
    dbFeedback,
  ] = await Promise.all([
    // Sessions in scope
    db
      .select({
        id: schema.branchSessions.id,
        committeeId: schema.branchSessions.committeeId,
        startsAt: schema.branchSessions.startsAt,
      })
      .from(schema.branchSessions)
      .where(
        and(
          eq(schema.branchSessions.seasonId, seasonId),
          ...(allowedCommitteeIds !== null
            ? [inArray(schema.branchSessions.committeeId, allowedCommitteeIds)]
            : [])
        )
      ),
    // Both assignments AND tasks in scope (plus branch-wide tasks where committeeId IS NULL)
    db
      .select({
        id: schema.tasks.id,
        committeeId: schema.tasks.committeeId,
        workType: schema.tasks.workType,
        dueAt: schema.tasks.dueAt,
        maxPoints: schema.tasks.maxPoints,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.seasonId, seasonId),
          ...(allowedCommitteeIds !== null
            ? [
                or(
                  inArray(schema.tasks.committeeId, allowedCommitteeIds),
                  isNull(schema.tasks.committeeId)
                ),
              ]
            : [])
        )
      ),
    // Submissions for scoped memberships (numeric/timestamp metadata only, no free-text notes)
    scopedMembershipIds.length > 0
      ? db
          .select({
            taskId: schema.taskSubmissions.taskId,
            membershipId: schema.taskSubmissions.membershipId,
            effortScore: schema.taskSubmissions.effortScore,
            qualityScore: schema.taskSubmissions.qualityScore,
            timelinessScore: schema.taskSubmissions.timelinessScore,
            totalPoints: schema.taskSubmissions.totalPoints,
            submittedAt: schema.taskSubmissions.submittedAt,
            gradedAt: schema.taskSubmissions.gradedAt,
          })
          .from(schema.taskSubmissions)
          .innerJoin(
            schema.tasks,
            eq(schema.taskSubmissions.taskId, schema.tasks.id)
          )
          .where(
            and(
              eq(schema.tasks.seasonId, seasonId),
              inArray(schema.taskSubmissions.membershipId, scopedMembershipIds)
            )
          )
      : Promise.resolve([]),
    // Ledger entries for scoped memberships + open postings for scoped persons
    scopedMembershipIds.length > 0
      ? db
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
          .where(
            and(
              eq(schema.scoreLedger.seasonId, seasonId),
              or(
                inArray(schema.scoreLedger.membershipId, scopedMembershipIds),
                and(
                  eq(schema.scoreLedger.postingScope, "open"),
                  inArray(schema.rosterMemberships.personId, scopedPersonIds)
                )
              )
            )
          )
      : Promise.resolve([]),
    // Feedback (SQL-layer privacy enforced: never select content, never own hats, never unpublished for committee_head)
    scopedMembershipIds.length > 0
      ? db
          .select({
            membershipId: schema.hrFeedback.membershipId,
            category: schema.hrFeedback.category,
            pointsDelta: schema.hrFeedback.pointsDelta,
            isPublished: schema.hrFeedback.isPublished,
            isWarning: schema.hrFeedback.isWarning,
            createdAt: schema.hrFeedback.createdAt,
          })
          .from(schema.hrFeedback)
          .where(
            and(
              eq(schema.hrFeedback.seasonId, seasonId),
              notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
              ...(allowedCommitteeSet !== null
                ? [inArray(schema.hrFeedback.membershipId, scopedMembershipIds)]
                : []),
              ...(!canSeeHidden ? [eq(schema.hrFeedback.isPublished, true)] : [])
            )
          )
      : Promise.resolve([]),
  ]);

  const sessionIds = dbSessions.map((s) => s.id);
  const dbAttendance =
    sessionIds.length > 0 && scopedMembershipIds.length > 0
      ? await db
          .select({
            sessionId: schema.attendanceRecords.sessionId,
            membershipId: schema.attendanceRecords.membershipId,
            status: schema.attendanceRecords.status,
            isPunctual: schema.attendanceRecords.isPunctual,
            pointsAwarded: schema.attendanceRecords.pointsAwarded,
            overrideReason: schema.attendanceRecords.overrideReason,
          })
          .from(schema.attendanceRecords)
          .where(
            and(
              inArray(schema.attendanceRecords.sessionId, sessionIds),
              inArray(schema.attendanceRecords.membershipId, scopedMembershipIds)
            )
          )
      : [];

  // For subset scopes, only keep branch-wide tasks (committeeId === null) that actually have
  // at least one submission for our scoped memberships so unrelated branch tasks don't clutter counts.
  const submissionTaskIdSet = new Set(dbSubmissions.map((s) => s.taskId));
  const filteredTasks = dbTasks.filter(
    (t) =>
      allowedCommitteeSet === null ||
      t.committeeId !== null ||
      submissionTaskIdSet.has(t.id)
  );

  return {
    viewerRole: actor.role,
    scopeKind,
    scopeLabel: resolvedScopeLabel,
    canViewHiddenFeedback: canSeeHidden,
    canViewPortalActivation: isChapterHrOrMaster,
    canViewManualOverrideRate:
      isChapterHrOrMaster || actor.role === "hr_member",
    canViewHrHealth: isChapterHrOrMaster,
    canSwitchSeason,
    selectedSeason: selectedSeasonOption,
    availableSeasons,
    seasonSettings,
    tracks: scopedTracks.map((t) => ({ id: t.id, name: t.name })),
    committees: dbCommittees.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      trackId: c.trackId ?? null,
    })),
    members: scopedMembers.map((m) => ({
      id: m.id,
      personId: m.personId,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      committeeId: m.committeeId,
      trackedCommitteeId: m.trackedCommitteeId,
      managedTrackId: m.managedTrackId,
      isActive: m.membershipActive && m.personActive,
      mustChangePassword: isChapterHrOrMaster ? m.mustChangePassword : null,
    })),
    sessions: dbSessions.map((s) => ({
      id: s.id,
      committeeId: s.committeeId,
      startsAt: s.startsAt.toISOString(),
      month: formatMonthInCairo(s.startsAt),
    })),
    attendance: dbAttendance.map((a) => ({
      sessionId: a.sessionId,
      membershipId: a.membershipId,
      personId: personIdByMembershipId.get(a.membershipId) ?? a.membershipId,
      status:
        a.status === "excused"
          ? "excused"
          : a.status === "absent"
            ? "absent"
            : "present",
      isPunctual: a.isPunctual,
      pointsAwarded: a.pointsAwarded,
      hasOverride: Boolean(a.overrideReason),
    })),
    tasks: filteredTasks.map((t) => ({
      id: t.id,
      committeeId: t.committeeId,
      workType: t.workType === "task" ? "task" : "assignment",
      dueAt: t.dueAt.toISOString(),
      month: formatMonthInCairo(t.dueAt),
      maxPoints: t.maxPoints,
    })),
    submissions: dbSubmissions.map((s) => ({
      taskId: s.taskId,
      membershipId: s.membershipId,
      personId: personIdByMembershipId.get(s.membershipId) ?? s.membershipId,
      effortScore: s.effortScore,
      qualityScore: s.qualityScore,
      timelinessScore: s.timelinessScore,
      totalPoints: s.totalPoints,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    })),
    ledger: dbLedger.map((l) => ({
      membershipId: l.membershipId,
      personId: l.personId,
      month: l.month,
      sourceType: l.sourceType,
      postingScope: l.postingScope,
      committeeId: l.committeeId,
      points: l.points,
    })),
    feedback: dbFeedback.map((f) => ({
      membershipId: f.membershipId,
      personId: personIdByMembershipId.get(f.membershipId) ?? f.membershipId,
      month: formatMonthInCairo(f.createdAt),
      category: inferFeedbackCategory({
        category: f.category,
        isPublished: f.isPublished,
        isWarning: f.isWarning,
      }),
      pointsDelta: f.pointsDelta ?? 0,
      isPublished: f.isPublished,
      isWarning: f.isWarning,
    })),
    snapshots: dbSnapshots.map((sn) => ({
      month: sn.month,
      status: sn.status,
    })),
    hrCoveredCommitteeIds,
  };
}
