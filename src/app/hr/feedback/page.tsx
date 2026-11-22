import {
  HrFeedbackView,
  type FeedbackItem,
} from "@/components/hr/hr-feedback-view";
import { requireHrModule } from "@/lib/portal-guards";
import {
  canAwardBonus,
  canIssueFeedbackWarnings,
  canViewHiddenFeedback,
  getOperationalCommitteeScope,
} from "@/lib/permissions";
import {
  DEFAULT_SEASON_SETTINGS,
  normalizeSeasonSettings,
  type SeasonFeedbackSettings,
} from "@/lib/season-settings";
import { inferFeedbackCategory } from "@/lib/feedback-categories";
import { addHrFeedbackAction } from "./actions";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";

export default async function HrFeedbackPage() {
  const { profile } = await requireHrModule("feedback");

  let members: Array<{
    id: string;
    fullName: string;
    committeeName: string;
    email: string;
  }> = [];
  let feedbackList: FeedbackItem[] = [];
  let feedbackCaps: SeasonFeedbackSettings = DEFAULT_SEASON_SETTINGS.feedback;

  const canCreateWarning = canIssueFeedbackWarnings(profile.role);
  const canSeeHidden = canViewHiddenFeedback(profile.role);
  const isCommitteeScoped =
    profile.role === "committee_head" || profile.role === "hr_member";
  const operationalCommitteeId = getOperationalCommitteeScope(profile);
  const canAwardPoints =
    profile.role !== "director" &&
    canAwardBonus(
      {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        committeeId: profile.committeeId,
        trackedCommitteeId: profile.trackedCommitteeId,
      },
      operationalCommitteeId
    );
  const isTrackDirector =
    profile.role === "director" && Boolean(profile.managedTrackId);

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      const seasonId = activeSeason.id;
      feedbackCaps = normalizeSeasonSettings(activeSeason.settingsJson).feedback;

      const [allSeasonMembers, dbCommittees] = await Promise.all([
        db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            fullName: schema.persons.fullName,
            email: schema.persons.email,
            personActive: schema.persons.isActive,
            committeeId: schema.rosterMemberships.committeeId,
            isActive: schema.rosterMemberships.isActive,
          })
          .from(schema.rosterMemberships)
          .innerJoin(
            schema.persons,
            eq(schema.rosterMemberships.personId, schema.persons.id)
          )
          .where(eq(schema.rosterMemberships.seasonId, seasonId)),
        db
          .select()
          .from(schema.committees)
          .where(eq(schema.committees.seasonId, seasonId)),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const memberMap = new Map(allSeasonMembers.map((m) => [m.id, m]));
      const authorMap = new Map(
        allSeasonMembers.map((m) => [m.id, m.fullName])
      );

      // Exclude ALL memberships owned by the viewing person (not only their active hat)
      // so a multi-hat user can NEVER view hidden HR notes/warnings written about another hat.
      const ownMembershipIds = Array.from(
        new Set([
          profile.id,
          ...allSeasonMembers
            .filter((m) => m.personId === profile.personId)
            .map((m) => m.id),
        ])
      );
      const ownMembershipIdSet = new Set(ownMembershipIds);
      const directorTrackCommitteeIds = isTrackDirector
        ? new Set(
            dbCommittees
              .filter((c) => c.trackId === profile.managedTrackId)
              .map((c) => c.id)
          )
        : null;

      const targetableMembers = allSeasonMembers.filter((m) => {
        if (!m.isActive || !m.personActive) return false;
        if (ownMembershipIdSet.has(m.id)) return false;
        if (isCommitteeScoped) {
          return (
            operationalCommitteeId !== null &&
            m.committeeId === operationalCommitteeId
          );
        }
        if (directorTrackCommitteeIds) {
          return (
            m.committeeId !== null &&
            directorTrackCommitteeIds.has(m.committeeId)
          );
        }
        return true;
      });

      members = targetableMembers
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          committeeName: m.committeeId
            ? commMap.get(m.committeeId) ?? "Unassigned"
            : "Unassigned",
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      // Data-layer privacy:
      // 1) Users NEVER receive feedback about any of their own hats here.
      // 2) Hidden HR notes (isPublished === false) are ONLY queried for roles with
      //    canViewHiddenFeedback (master_admin, director, hr_admin, hr_member).
      //    Committee heads strictly receive isPublished === true rows at the SQL layer.
      let dbFeedback: (typeof schema.hrFeedback.$inferSelect)[] = [];
      const scopedMemberIds = targetableMembers.map((m) => m.id);
      const isSubsetScoped =
        isCommitteeScoped || Boolean(directorTrackCommitteeIds);

      if (canSeeHidden) {
        if (isSubsetScoped) {
          if (scopedMemberIds.length > 0) {
            dbFeedback = await db
              .select()
              .from(schema.hrFeedback)
              .where(
                and(
                  eq(schema.hrFeedback.seasonId, seasonId),
                  notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
                  inArray(schema.hrFeedback.membershipId, scopedMemberIds)
                )
              )
              .orderBy(desc(schema.hrFeedback.createdAt));
          }
        } else {
          dbFeedback = await db
            .select()
            .from(schema.hrFeedback)
            .where(
              and(
                eq(schema.hrFeedback.seasonId, seasonId),
                notInArray(schema.hrFeedback.membershipId, ownMembershipIds)
              )
            )
            .orderBy(desc(schema.hrFeedback.createdAt));
        }
      } else if (profile.role === "committee_head" && scopedMemberIds.length > 0) {
        dbFeedback = await db
          .select()
          .from(schema.hrFeedback)
          .where(
            and(
              eq(schema.hrFeedback.seasonId, seasonId),
              eq(schema.hrFeedback.isPublished, true),
              notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
              inArray(schema.hrFeedback.membershipId, scopedMemberIds)
            )
          )
          .orderBy(desc(schema.hrFeedback.createdAt));
      }

      feedbackList = dbFeedback.map((f) => ({
        id: f.id,
        membershipId: f.membershipId,
        memberName: memberMap.get(f.membershipId)?.fullName ?? "Unknown",
        memberEmail: memberMap.get(f.membershipId)?.email ?? "",
        committeeName:
          commMap.get(memberMap.get(f.membershipId)?.committeeId ?? "") ??
          "Unassigned",
        category: inferFeedbackCategory({
          category: f.category,
          isPublished: f.isPublished,
          isWarning: f.isWarning,
        }),
        pointsDelta: f.pointsDelta ?? 0,
        content: f.content,
        isPublished: f.isPublished,
        isWarning: f.isWarning,
        createdByName: authorMap.get(f.createdBy) ?? "HR Team",
        createdAt: f.createdAt.toISOString(),
      }));
    }
  } catch {
    // DB offline
  }

  return (
    <HrFeedbackView
      feedbackList={feedbackList}
      members={members}
      canCreateWarning={canCreateWarning}
      canAwardPoints={canAwardPoints}
      feedbackCaps={feedbackCaps}
      currentUserName={profile.fullName}
      onAddFeedback={addHrFeedbackAction}
    />
  );
}
