import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
} from "drizzle-orm";
import {
  canAccessHrModule,
  canManageWorkItem,
  canPublishLeaderboard,
  canViewHiddenFeedback,
  getOperationalCommitteeScope,
  type UserPermissionContext,
  type WorkItemType,
} from "@/lib/permissions";
import type { NavBadgeMap } from "@/lib/nav-notifications";
import { classifyPublishingMonthState } from "@/lib/publishing-state";
import { isSessionCheckinLive } from "@/services/hr-ops/attendance.service";
import { formatMonthInCairo } from "@/services/hr-ops/helpers";
import { getPublishingMonthOptions } from "@/services/hr-ops/publishing.service";
import type { OperationalUserProfile } from "@/services/member.service";

const FEEDBACK_LOOKBACK_DAYS = 30;

export interface MemberWorkRow {
  workType: string;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

/**
 * Computes member-portal actionable counts:
 * - Assignments due: unsubmitted and ungraded assignments
 * - Tasks due: incomplete (ungraded) tasks
 */
export function computeMemberWorkBadgeCounts(
  rows: readonly MemberWorkRow[]
): { assignmentsDue: number; tasksDue: number } {
  let assignmentsDue = 0;
  let tasksDue = 0;
  for (const row of rows) {
    if (row.workType === "task") {
      if (!row.gradedAt) tasksDue += 1;
    } else {
      if (!row.submittedAt && !row.gradedAt) assignmentsDue += 1;
    }
  }
  return { assignmentsDue, tasksDue };
}

export interface HrSubmissionCandidate {
  submissionId: string;
  membershipId: string;
  personId?: string | null;
  workType: WorkItemType;
  completionMode: "self_report" | "hr_only";
  taskCommitteeId: string | null;
  memberCommitteeId: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

/**
 * Counts HR / Leadership actionable items in `/hr/tasks`:
 * 1) Submitted assignments awaiting grading in this actor's scope
 * 2) Unverified `hr_only` tasks awaiting HR verification in this actor's scope
 * 3) Incomplete personal items assigned directly to `actor.id`
 */
export function computeHrActionableWorkCount(input: {
  actor: UserPermissionContext;
  submissions: readonly HrSubmissionCandidate[];
  directorTrackCommitteeIds: ReadonlySet<string> | null;
}): number {
  const { actor, submissions, directorTrackCommitteeIds } = input;
  const countedSubmissionIds = new Set<string>();

  for (const sub of submissions) {
    if (sub.gradedAt) continue;

    // Personal item assigned directly to HR Admin by their overseeing Director
    if (sub.membershipId === actor.id) {
      if (actor.role === "hr_admin" && !sub.submittedAt) {
        countedSubmissionIds.add(sub.submissionId);
      }
      continue;
    }

    // Never count another hat owned by the same human as gradeable/verifiable
    if (actor.personId && sub.personId && actor.personId === sub.personId) {
      continue;
    }

    const scopeCommitteeId = sub.taskCommitteeId ?? sub.memberCommitteeId;
    if (!canManageWorkItem(actor, sub.workType, scopeCommitteeId)) {
      continue;
    }

    if (
      directorTrackCommitteeIds &&
      (!scopeCommitteeId || !directorTrackCommitteeIds.has(scopeCommitteeId))
    ) {
      continue;
    }

    if (sub.workType === "assignment") {
      // Only nag graders once the member has submitted their link/deliverable
      if (sub.submittedAt) {
        countedSubmissionIds.add(sub.submissionId);
      }
    } else if (sub.workType === "task" && sub.completionMode === "hr_only") {
      // HR-only tasks require HR verification
      countedSubmissionIds.add(sub.submissionId);
    }
  }

  return countedSubmissionIds.size;
}

export async function getMemberNavNotifications(
  memberId: string,
  personId: string
): Promise<NavBadgeMap> {
  const badges: NavBadgeMap = {};

  try {
    const [activeSeason] = await db
      .select({ id: schema.seasons.id })
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) return badges;

    const seasonId = activeSeason.id;
    const memberships = await db
      .select({
        id: schema.rosterMemberships.id,
        role: schema.rosterMemberships.role,
        committeeId: schema.rosterMemberships.committeeId,
      })
      .from(schema.rosterMemberships)
      .where(
        and(
          eq(schema.rosterMemberships.seasonId, seasonId),
          eq(schema.rosterMemberships.personId, personId),
          eq(schema.rosterMemberships.isActive, true),
          ne(schema.rosterMemberships.role, "attendee")
        )
      );

    const membershipIds =
      memberships.length > 0 ? memberships.map((m) => m.id) : [memberId];
    // Committee session check-in alerts apply only to committees where the person
    // is a regular member (`member`) or HR member (`hr_member`). Heads are alerted
    // for branch-wide sessions only.
    const committeeIdSet = new Set(
      memberships
        .filter((m) => m.role === "member" || m.role === "hr_member")
        .map((m) => m.committeeId)
        .filter((id): id is string => Boolean(id))
    );

    const now = new Date();
    const cutoff = new Date(
      now.getTime() - FEEDBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );

    const [workRows, openSessions, attendedRows, publishedFeedback] =
      await Promise.all([
        db
          .select({
            workType: schema.tasks.workType,
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
              inArray(schema.taskSubmissions.membershipId, membershipIds),
              isNull(schema.taskSubmissions.gradedAt)
            )
          ),
        db
          .select({
            id: schema.branchSessions.id,
            committeeId: schema.branchSessions.committeeId,
            checkinOpen: schema.branchSessions.checkinOpen,
            checkinStartsAt: schema.branchSessions.checkinStartsAt,
            checkinEndsAt: schema.branchSessions.checkinEndsAt,
          })
          .from(schema.branchSessions)
          .where(
            and(
              eq(schema.branchSessions.seasonId, seasonId),
              eq(schema.branchSessions.checkinOpen, true)
            )
          ),
        db
          .select({ sessionId: schema.attendanceRecords.sessionId })
          .from(schema.attendanceRecords)
          .where(
            and(
              inArray(schema.attendanceRecords.membershipId, membershipIds),
              eq(schema.attendanceRecords.status, "present")
            )
          ),
        // Data-layer privacy: strictly isPublished === true (never hidden HR notes)
        db
          .select({
            createdAt: schema.hrFeedback.createdAt,
            category: schema.hrFeedback.category,
            isWarning: schema.hrFeedback.isWarning,
          })
          .from(schema.hrFeedback)
          .where(
            and(
              eq(schema.hrFeedback.seasonId, seasonId),
              inArray(schema.hrFeedback.membershipId, membershipIds),
              eq(schema.hrFeedback.isPublished, true),
              gte(schema.hrFeedback.createdAt, cutoff)
            )
          ),
      ]);

    const { assignmentsDue, tasksDue } = computeMemberWorkBadgeCounts(workRows);
    if (assignmentsDue > 0) {
      badges["/member/assignments"] = {
        count: assignmentsDue,
        tone: "purple",
        label: `${assignmentsDue} assignment${assignmentsDue === 1 ? "" : "s"} due`,
      };
    }
    if (tasksDue > 0) {
      badges["/member/tasks"] = {
        count: tasksDue,
        tone: "purple",
        label: `${tasksDue} task${tasksDue === 1 ? "" : "s"} pending`,
      };
    }

    const attendedSessionIds = new Set(attendedRows.map((r) => r.sessionId));
    const liveUncheckedCount = openSessions.filter((sess) => {
      if (!isSessionCheckinLive(sess, now)) return false;
      if (attendedSessionIds.has(sess.id)) return false;
      return sess.committeeId === null || committeeIdSet.has(sess.committeeId);
    }).length;
    if (liveUncheckedCount > 0) {
      badges["/member/attendance"] = {
        count: liveUncheckedCount,
        tone: "green",
        label: `${liveUncheckedCount} live check-in open now`,
      };
    }

    if (publishedFeedback.length > 0) {
      const recentItemDates = publishedFeedback.map((f) =>
        f.createdAt.toISOString()
      );
      const recentWarningDates = publishedFeedback
        .filter((f) => f.category === "warning" || f.isWarning)
        .map((f) => f.createdAt.toISOString());

      badges["/member/feedback"] = {
        count: recentItemDates.length,
        tone: recentWarningDates.length > 0 ? "red" : "purple",
        seenKey: `member_feedback:${personId}`,
        recentItemDates,
        recentWarningDates,
        label:
          recentWarningDates.length > 0
            ? "New feedback including official warning"
            : "New feedback received",
      };
    }
  } catch {
    // Graceful fallback if DB is offline during build
  }

  return badges;
}

export async function getAttendeeNavNotifications(
  attendeeId: string
): Promise<NavBadgeMap> {
  const badges: NavBadgeMap = {};

  try {
    const [membership] = await db
      .select({
        id: schema.rosterMemberships.id,
        seasonId: schema.rosterMemberships.seasonId,
        committeeId: schema.rosterMemberships.committeeId,
      })
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, attendeeId))
      .limit(1);
    if (!membership) return badges;

    const now = new Date();
    const [workRows, openSessions, attendedRows] = await Promise.all([
      db
        .select({
          workType: schema.tasks.workType,
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
            eq(schema.tasks.seasonId, membership.seasonId),
            eq(schema.taskSubmissions.membershipId, membership.id),
            isNull(schema.taskSubmissions.gradedAt)
          )
        ),
      db
        .select({
          id: schema.branchSessions.id,
          committeeId: schema.branchSessions.committeeId,
          checkinOpen: schema.branchSessions.checkinOpen,
          checkinStartsAt: schema.branchSessions.checkinStartsAt,
          checkinEndsAt: schema.branchSessions.checkinEndsAt,
        })
        .from(schema.branchSessions)
        .where(
          and(
            eq(schema.branchSessions.seasonId, membership.seasonId),
            eq(schema.branchSessions.checkinOpen, true)
          )
        ),
      db
        .select({ sessionId: schema.attendanceRecords.sessionId })
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.membershipId, membership.id),
            eq(schema.attendanceRecords.status, "present")
          )
        ),
    ]);

    const { assignmentsDue } = computeMemberWorkBadgeCounts(workRows);
    if (assignmentsDue > 0) {
      badges["/attendee/assignments"] = {
        count: assignmentsDue,
        tone: "purple",
        label: `${assignmentsDue} assignment${assignmentsDue === 1 ? "" : "s"} due`,
      };
    }

    const attendedSessionIds = new Set(attendedRows.map((r) => r.sessionId));
    const liveUncheckedCount = openSessions.filter((sess) => {
      if (!isSessionCheckinLive(sess, now)) return false;
      if (attendedSessionIds.has(sess.id)) return false;
      return (
        sess.committeeId === null || sess.committeeId === membership.committeeId
      );
    }).length;
    if (liveUncheckedCount > 0) {
      badges["/attendee/attendance"] = {
        count: liveUncheckedCount,
        tone: "green",
        label: `${liveUncheckedCount} live check-in open now`,
      };
    }
  } catch {
    // Graceful fallback
  }

  return badges;
}

export async function getHrNavNotifications(
  profile: OperationalUserProfile
): Promise<NavBadgeMap> {
  const badges: NavBadgeMap = {};

  try {
    const [activeSeason] = await db
      .select({ id: schema.seasons.id })
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) return badges;

    const seasonId = activeSeason.id;
    const now = new Date();
    const cutoff = new Date(
      now.getTime() - FEEDBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );
    const isCommitteeScoped =
      profile.role === "committee_head" || profile.role === "hr_member";
    const operationalCommitteeId = getOperationalCommitteeScope(profile);
    const isTrackDirector =
      profile.role === "director" && Boolean(profile.managedTrackId);

    const [
      dbCommittees,
      ownHats,
      ungradedSubmissions,
      openSessions,
      activeHrMembers,
      hrTrackedJoinRows,
      monthOptions,
    ] = await Promise.all([
      db
        .select({
          id: schema.committees.id,
          slug: schema.committees.slug,
          name: schema.committees.name,
          trackId: schema.committees.trackId,
        })
        .from(schema.committees)
        .where(
          and(
            eq(schema.committees.seasonId, seasonId),
            eq(schema.committees.isActive, true)
          )
        ),
      db
        .select({ id: schema.rosterMemberships.id })
        .from(schema.rosterMemberships)
        .where(
          and(
            eq(schema.rosterMemberships.seasonId, seasonId),
            eq(schema.rosterMemberships.personId, profile.personId)
          )
        ),
      canAccessHrModule(profile.role, "tasks")
        ? db
            .select({
              submissionId: schema.taskSubmissions.id,
              membershipId: schema.taskSubmissions.membershipId,
              personId: schema.rosterMemberships.personId,
              workType: schema.tasks.workType,
              completionMode: schema.tasks.completionMode,
              taskCommitteeId: schema.tasks.committeeId,
              memberCommitteeId: schema.rosterMemberships.committeeId,
              memberRole: schema.rosterMemberships.role,
              submittedAt: schema.taskSubmissions.submittedAt,
              gradedAt: schema.taskSubmissions.gradedAt,
            })
            .from(schema.taskSubmissions)
            .innerJoin(
              schema.tasks,
              eq(schema.taskSubmissions.taskId, schema.tasks.id)
            )
            .innerJoin(
              schema.rosterMemberships,
              eq(schema.taskSubmissions.membershipId, schema.rosterMemberships.id)
            )
            .where(
              and(
                eq(schema.tasks.seasonId, seasonId),
                isNull(schema.taskSubmissions.gradedAt),
                or(
                  and(
                    eq(schema.tasks.workType, "assignment"),
                    isNotNull(schema.taskSubmissions.submittedAt)
                  ),
                  and(
                    eq(schema.tasks.workType, "task"),
                    eq(schema.tasks.completionMode, "hr_only")
                  ),
                  ...(profile.role === "hr_admin"
                    ? [eq(schema.taskSubmissions.membershipId, profile.id)]
                    : [])
                )
              )
            )
        : Promise.resolve([]),
      canAccessHrModule(profile.role, "attendance")
        ? db
            .select({
              id: schema.branchSessions.id,
              committeeId: schema.branchSessions.committeeId,
              checkinOpen: schema.branchSessions.checkinOpen,
              checkinStartsAt: schema.branchSessions.checkinStartsAt,
              checkinEndsAt: schema.branchSessions.checkinEndsAt,
            })
            .from(schema.branchSessions)
            .where(
              and(
                eq(schema.branchSessions.seasonId, seasonId),
                eq(schema.branchSessions.checkinOpen, true)
              )
            )
        : Promise.resolve([]),
      profile.role === "master_admin" || profile.role === "hr_admin"
        ? db
            .select({
              id: schema.rosterMemberships.id,
              trackedCommitteeId: schema.rosterMemberships.trackedCommitteeId,
              committeeId: schema.rosterMemberships.committeeId,
            })
            .from(schema.rosterMemberships)
            .innerJoin(
              schema.persons,
              eq(schema.rosterMemberships.personId, schema.persons.id)
            )
            .where(
              and(
                eq(schema.rosterMemberships.seasonId, seasonId),
                eq(schema.rosterMemberships.role, "hr_member"),
                eq(schema.rosterMemberships.isActive, true),
                eq(schema.persons.isActive, true)
              )
            )
        : Promise.resolve([]),
      profile.role === "master_admin" || profile.role === "hr_admin"
        ? db
            .select({
              membershipId: schema.hrMemberTrackedCommittees.membershipId,
              committeeId: schema.hrMemberTrackedCommittees.committeeId,
            })
            .from(schema.hrMemberTrackedCommittees)
            .where(eq(schema.hrMemberTrackedCommittees.seasonId, seasonId))
        : Promise.resolve([]),
      canPublishLeaderboard(profile.role)
        ? getPublishingMonthOptions(seasonId)
        : Promise.resolve([]),
    ]);

    const hrCommitteeId =
      dbCommittees.find(
        (c) =>
          c.slug === "human-resources" ||
          c.name.toLowerCase() === "human resources"
      )?.id ?? null;

    const directorTrackCommitteeIds = isTrackDirector
      ? new Set(
          dbCommittees
            .filter((c) => c.trackId === profile.managedTrackId)
            .map((c) => c.id)
        )
      : null;

    // 1. /hr/tasks — submissions awaiting grading / hr_only verification / personal items
    if (canAccessHrModule(profile.role, "tasks")) {
      const workCount = computeHrActionableWorkCount({
        actor: {
          id: profile.id,
          personId: profile.personId,
          email: profile.email,
          role: profile.role,
          committeeId: profile.committeeId,
          trackedCommitteeId: profile.trackedCommitteeId,
        },
        submissions: ungradedSubmissions.map((s) => ({
          submissionId: s.submissionId,
          membershipId: s.membershipId,
          personId: s.personId,
          workType: s.workType === "task" ? "task" : "assignment",
          completionMode:
            s.completionMode === "hr_only" ? "hr_only" : "self_report",
          taskCommitteeId: s.taskCommitteeId,
          memberCommitteeId:
            s.memberCommitteeId ??
            (s.memberRole === "hr_admin" ? hrCommitteeId : null),
          submittedAt: s.submittedAt,
          gradedAt: s.gradedAt,
        })),
        directorTrackCommitteeIds,
      });

      if (workCount > 0) {
        badges["/hr/tasks"] = {
          count: workCount,
          tone: "purple",
          label: `${workCount} item${workCount === 1 ? "" : "s"} awaiting review or verification`,
        };
      }
    }

    // 2. /hr/publishing — ended past months still awaiting publish
    if (canPublishLeaderboard(profile.role) && monthOptions.length > 0) {
      const currentMonth = formatMonthInCairo(now);
      const dueReviewCount = monthOptions.filter(
        (m) =>
          classifyPublishingMonthState(m.month, m.status, currentMonth) ===
          "due_review"
      ).length;
      if (dueReviewCount > 0) {
        badges["/hr/publishing"] = {
          count: dueReviewCount,
          tone: "amber",
          label: `${dueReviewCount} ended month${dueReviewCount === 1 ? "" : "s"} ready to publish`,
        };
      }
    }

    // 3. /hr/attendance — active live QR check-in windows
    if (canAccessHrModule(profile.role, "attendance")) {
      const liveSessionsCount = openSessions.filter((sess) => {
        if (!isSessionCheckinLive(sess, now)) return false;
        if (isCommitteeScoped) {
          return (
            operationalCommitteeId !== null &&
            sess.committeeId === operationalCommitteeId
          );
        }
        return true;
      }).length;
      if (liveSessionsCount > 0) {
        badges["/hr/attendance"] = {
          count: liveSessionsCount,
          tone: "green",
          label: `${liveSessionsCount} live check-in session${liveSessionsCount === 1 ? "" : "s"} open`,
        };
      }
    }

    // 4. /hr/roster — uncovered committees missing an HR member (for Master & HR Admin)
    if (profile.role === "master_admin" || profile.role === "hr_admin") {
      const activeHrMemberIds = new Set(activeHrMembers.map((m) => m.id));
      const coveredCommitteeIds = new Set<string>();
      for (const jr of hrTrackedJoinRows) {
        if (activeHrMemberIds.has(jr.membershipId)) {
          coveredCommitteeIds.add(jr.committeeId);
        }
      }
      for (const m of activeHrMembers) {
        const legacyId = m.trackedCommitteeId ?? m.committeeId;
        if (legacyId) coveredCommitteeIds.add(legacyId);
      }
      const uncoveredCount = dbCommittees.filter(
        (c) =>
          c.slug !== "human-resources" &&
          c.name.toLowerCase() !== "human resources" &&
          !coveredCommitteeIds.has(c.id)
      ).length;
      if (uncoveredCount > 0) {
        badges["/hr/roster"] = {
          count: uncoveredCount,
          tone: "amber",
          label: `${uncoveredCount} committee${uncoveredCount === 1 ? "" : "s"} missing an HR member`,
        };
      }
    }

    // 5. /hr/feedback — recent 30-day feedback in scope (excluding self across all hats,
    //    strictly isPublished === true for committee_head at the SQL query layer!)
    if (canAccessHrModule(profile.role, "feedback")) {
      const ownMembershipIds = Array.from(
        new Set([profile.id, ...ownHats.map((h) => h.id)])
      );
      const canSeeHidden = canViewHiddenFeedback(profile.role);

      let scopedMemberIds: string[] | null = null;
      if (isCommitteeScoped) {
        if (!operationalCommitteeId) {
          scopedMemberIds = [];
        } else {
          const rows = await db
            .select({ id: schema.rosterMemberships.id })
            .from(schema.rosterMemberships)
            .where(
              and(
                eq(schema.rosterMemberships.seasonId, seasonId),
                eq(schema.rosterMemberships.committeeId, operationalCommitteeId),
                eq(schema.rosterMemberships.isActive, true)
              )
            );
          scopedMemberIds = rows.map((r) => r.id);
        }
      } else if (directorTrackCommitteeIds) {
        const trackIds = Array.from(directorTrackCommitteeIds);
        if (trackIds.length === 0) {
          scopedMemberIds = [];
        } else {
          const rows = await db
            .select({ id: schema.rosterMemberships.id })
            .from(schema.rosterMemberships)
            .where(
              and(
                eq(schema.rosterMemberships.seasonId, seasonId),
                inArray(schema.rosterMemberships.committeeId, trackIds),
                eq(schema.rosterMemberships.isActive, true)
              )
            );
          scopedMemberIds = rows.map((r) => r.id);
        }
      }

      if (scopedMemberIds === null || scopedMemberIds.length > 0) {
        const conditions = [
          eq(schema.hrFeedback.seasonId, seasonId),
          gte(schema.hrFeedback.createdAt, cutoff),
          notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
          ne(schema.hrFeedback.createdBy, profile.id),
        ];
        if (!canSeeHidden) {
          conditions.push(eq(schema.hrFeedback.isPublished, true));
        }
        if (scopedMemberIds !== null) {
          conditions.push(
            inArray(schema.hrFeedback.membershipId, scopedMemberIds)
          );
        }

        const recentFeedback = await db
          .select({
            createdAt: schema.hrFeedback.createdAt,
            category: schema.hrFeedback.category,
            isWarning: schema.hrFeedback.isWarning,
          })
          .from(schema.hrFeedback)
          .where(and(...conditions));

        if (recentFeedback.length > 0) {
          const recentItemDates = recentFeedback.map((f) =>
            f.createdAt.toISOString()
          );
          const recentWarningDates = recentFeedback
            .filter((f) => f.category === "warning" || f.isWarning)
            .map((f) => f.createdAt.toISOString());

          badges["/hr/feedback"] = {
            count: recentItemDates.length,
            tone: recentWarningDates.length > 0 ? "red" : "purple",
            seenKey: `hr_feedback:${profile.id}`,
            recentItemDates,
            recentWarningDates,
            label: "New feedback or warnings logged in your scope",
          };
        }
      }
    }
  } catch {
    // Graceful fallback if DB is offline during build
  }

  return badges;
}
