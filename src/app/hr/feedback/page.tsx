import {
  HrFeedbackView,
  type FeedbackItem,
} from "@/components/hr/hr-feedback-view";
import { requireHrModule } from "@/lib/portal-guards";
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

  const canViewAndCreateWarnings =
    profile.role === "master_admin" ||
    profile.role === "director" ||
    profile.role === "hr_admin";
  const isCommitteeHead = profile.role === "committee_head";
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

      const [allSeasonMembers, dbCommittees] = await Promise.all([
        db
          .select({
            id: schema.rosterMemberships.id,
            personId: schema.rosterMemberships.personId,
            fullName: schema.persons.fullName,
            email: schema.persons.email,
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
      const authorMap = new Map(allSeasonMembers.map((m) => [m.id, m.fullName]));
      // Exclude ALL memberships owned by the viewing person (not only their active hat)
      // so a multi-hat user can NEVER view private HR warnings/notes written about another hat.
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
        if (!m.isActive) return false;
        if (isCommitteeHead) {
          return (
            profile.committeeId !== null &&
            m.committeeId === profile.committeeId &&
            !ownMembershipIdSet.has(m.id)
          );
        }
        if (directorTrackCommitteeIds) {
          return (
            m.committeeId !== null &&
            directorTrackCommitteeIds.has(m.committeeId) &&
            !ownMembershipIdSet.has(m.id)
          );
        }
        return !ownMembershipIdSet.has(m.id);
      });

      members = targetableMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        committeeName: m.committeeId
          ? commMap.get(m.committeeId) ?? "Unassigned"
          : "Unassigned",
      }));

      // Data-layer privacy: users NEVER receive private HR warnings or notes about any of their own hats
      let dbFeedback: (typeof schema.hrFeedback.$inferSelect)[] = [];
      if (canViewAndCreateWarnings) {
        if (directorTrackCommitteeIds) {
          const trackMemberIds = targetableMembers.map((m) => m.id);
          if (trackMemberIds.length > 0) {
            dbFeedback = await db
              .select()
              .from(schema.hrFeedback)
              .where(
                and(
                  eq(schema.hrFeedback.seasonId, seasonId),
                  notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
                  inArray(schema.hrFeedback.membershipId, trackMemberIds)
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
      } else if (isCommitteeHead && targetableMembers.length > 0) {
        const commMemberIds = targetableMembers.map((m) => m.id);
        dbFeedback = await db
          .select()
          .from(schema.hrFeedback)
          .where(
            and(
              eq(schema.hrFeedback.seasonId, seasonId),
              eq(schema.hrFeedback.isPublished, true),
              eq(schema.hrFeedback.isWarning, false),
              notInArray(schema.hrFeedback.membershipId, ownMembershipIds),
              inArray(schema.hrFeedback.membershipId, commMemberIds)
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
      canCreateWarning={canViewAndCreateWarnings}
      currentUserName={profile.fullName}
      onAddFeedback={addHrFeedbackAction}
    />
  );
}
