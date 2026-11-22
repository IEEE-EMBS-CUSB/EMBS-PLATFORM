import { requireOperationalSession } from "@/lib/portal-guards";
import { getOperationalCommitteeScope } from "@/lib/permissions";
import {
  RoleOperationalDashboard,
  type DashboardKpis,
} from "@/components/hr/role-operational-dashboard";
import type { AssignedTaskItem } from "@/components/hr/task-delegation-view";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";

export default async function HrOverviewPage() {
  const { profile } = await requireOperationalSession();

  let assignedTasks: AssignedTaskItem[] = [];
  const kpis: DashboardKpis = {
    activeMembers: 0,
    committeeCount: 0,
    hrOfficers: 0,
    assignedTasksCount: 0,
    pendingGradingCount: 0,
    avgMemberPoints: 0,
    sessionsCount: 0,
    publishedMonthsCount: 0,
  };

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;

      const [
        dbSubmissions,
        dbMembers,
        dbCommittees,
        dbTasks,
        dbAllTaskSubmissions,
        dbSessions,
        dbLedger,
        dbSnapshots,
      ] = await Promise.all([
        profile.role === "hr_admin"
          ? db
              .select({
                taskId: schema.tasks.id,
                title: schema.tasks.title,
                workType: schema.tasks.workType,
                dueAt: schema.tasks.dueAt,
                maxPoints: schema.tasks.maxPoints,
                totalPoints: schema.taskSubmissions.totalPoints,
                submittedAt: schema.taskSubmissions.submittedAt,
              })
              .from(schema.taskSubmissions)
              .innerJoin(
                schema.tasks,
                eq(schema.taskSubmissions.taskId, schema.tasks.id)
              )
              .where(
                and(
                  eq(schema.taskSubmissions.membershipId, profile.id),
                  eq(schema.tasks.seasonId, seasonId)
                )
              )
              .orderBy(desc(schema.tasks.createdAt))
          : Promise.resolve([]),
        db
          .select({
            id: schema.rosterMemberships.id,
            role: schema.rosterMemberships.role,
            committeeId: schema.rosterMemberships.committeeId,
          })
          .from(schema.rosterMemberships)
          .where(
            and(
              eq(schema.rosterMemberships.seasonId, seasonId),
              eq(schema.rosterMemberships.isActive, true),
              ne(schema.rosterMemberships.role, "attendee")
            )
          ),
        db
          .select({
            id: schema.committees.id,
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
          .select({
            id: schema.tasks.id,
            committeeId: schema.tasks.committeeId,
          })
          .from(schema.tasks)
          .where(eq(schema.tasks.seasonId, seasonId)),
        db
          .select({
            taskId: schema.taskSubmissions.taskId,
            gradedAt: schema.taskSubmissions.gradedAt,
            committeeId: schema.tasks.committeeId,
          })
          .from(schema.taskSubmissions)
          .innerJoin(
            schema.tasks,
            eq(schema.taskSubmissions.taskId, schema.tasks.id)
          )
          .where(eq(schema.tasks.seasonId, seasonId)),
        db
          .select({
            id: schema.branchSessions.id,
            committeeId: schema.branchSessions.committeeId,
          })
          .from(schema.branchSessions)
          .where(eq(schema.branchSessions.seasonId, seasonId)),
        db
          .select({
            membershipId: schema.scoreLedger.membershipId,
            points: schema.scoreLedger.points,
          })
          .from(schema.scoreLedger)
          .where(eq(schema.scoreLedger.seasonId, seasonId)),
        db
          .select({ id: schema.monthlySnapshots.id })
          .from(schema.monthlySnapshots)
          .where(
            and(
              eq(schema.monthlySnapshots.seasonId, seasonId),
              eq(schema.monthlySnapshots.status, "published")
            )
          ),
      ]);

      const defaultAssignerRole =
        profile.role === "hr_member" ? "hr_admin" : "director";

      assignedTasks = dbSubmissions.map((s) => ({
        id: s.taskId,
        title: s.title,
        workType: s.workType === "task" ? "task" : "assignment",
        assignedByName: "Leadership",
        assignerRole:
          s.workType === "task" ? "hr_admin" : defaultAssignerRole,
        dueAt: s.dueAt,
        maxPoints: s.maxPoints,
        status:
          s.totalPoints !== null
            ? "completed"
            : s.submittedAt
              ? "in_progress"
              : "not_started",
      }));

      const isCommitteeScoped =
        profile.role === "committee_head" || profile.role === "hr_member";
      const operationalCommitteeId = getOperationalCommitteeScope(profile);
      const isTrackDirector =
        profile.role === "director" && Boolean(profile.managedTrackId);
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      const scopedMembers = isCommitteeScoped
        ? dbMembers.filter(
            (m) =>
              operationalCommitteeId !== null &&
              m.committeeId === operationalCommitteeId
          )
        : directorTrackCommitteeIds
          ? dbMembers.filter(
              (m) =>
                m.committeeId !== null &&
                directorTrackCommitteeIds.has(m.committeeId)
            )
          : dbMembers;
      const scopedMemberIds = new Set(scopedMembers.map((m) => m.id));

      const scopedTasks = isCommitteeScoped
        ? dbTasks.filter(
            (t) =>
              operationalCommitteeId !== null &&
              t.committeeId === operationalCommitteeId
          )
        : directorTrackCommitteeIds
          ? dbTasks.filter(
              (t) =>
                t.committeeId !== null &&
                directorTrackCommitteeIds.has(t.committeeId)
            )
          : dbTasks;
      const scopedSubmissions = isCommitteeScoped
        ? dbAllTaskSubmissions.filter(
            (s) =>
              operationalCommitteeId !== null &&
              s.committeeId === operationalCommitteeId
          )
        : directorTrackCommitteeIds
          ? dbAllTaskSubmissions.filter(
              (s) =>
                s.committeeId !== null &&
                directorTrackCommitteeIds.has(s.committeeId)
            )
          : dbAllTaskSubmissions;
      const scopedSessions = isCommitteeScoped
        ? dbSessions.filter(
            (s) =>
              operationalCommitteeId !== null &&
              s.committeeId === operationalCommitteeId
          )
        : directorTrackCommitteeIds
          ? dbSessions.filter(
              (s) =>
                s.committeeId !== null &&
                directorTrackCommitteeIds.has(s.committeeId)
            )
          : dbSessions;

      const totalScopedPoints = dbLedger
        .filter((l) => scopedMemberIds.has(l.membershipId))
        .reduce((sum, l) => sum + l.points, 0);

      kpis.activeMembers = scopedMembers.length;
      kpis.committeeCount = directorTrackCommitteeIds
        ? directorTrackCommitteeIds.size
        : dbCommittees.length;
      kpis.hrOfficers = dbMembers.filter(
        (m) => m.role === "hr_member" || m.role === "hr_admin"
      ).length;
      kpis.assignedTasksCount = scopedTasks.length;
      kpis.pendingGradingCount = scopedSubmissions.filter(
        (s) => s.gradedAt === null
      ).length;
      kpis.avgMemberPoints =
        scopedMembers.length > 0
          ? Math.round(totalScopedPoints / scopedMembers.length)
          : 0;
      kpis.sessionsCount = scopedSessions.length;
      kpis.publishedMonthsCount = dbSnapshots.length;
    }
  } catch {
    // Graceful fallback when DB is unreachable during build
  }

  return (
    <RoleOperationalDashboard
      currentUserRole={profile.role}
      userName={profile.fullName}
      committeeName={
        profile.role === "hr_member"
          ? profile.trackedCommitteeName ?? undefined
          : (profile.committeeName ??
            (profile.managedTrackName ? `${profile.managedTrackName} Track` : undefined))
      }
      assignedTasks={assignedTasks}
      kpis={kpis}
    />
  );
}
