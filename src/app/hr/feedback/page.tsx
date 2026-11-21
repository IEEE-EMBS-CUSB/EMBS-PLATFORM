import {
  HrFeedbackView,
  type FeedbackItem,
} from "@/components/hr/hr-feedback-view";
import { requireHrModule } from "@/lib/portal-guards";
import { addHrFeedbackAction } from "./actions";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";

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
          .select()
          .from(schema.rosterMemberships)
          .where(eq(schema.rosterMemberships.seasonId, seasonId)),
        db
          .select()
          .from(schema.committees)
          .where(eq(schema.committees.seasonId, seasonId)),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));
      const memberMap = new Map(allSeasonMembers.map((m) => [m.id, m]));
      const authorMap = new Map(allSeasonMembers.map((m) => [m.id, m.fullName]));

      const targetableMembers = allSeasonMembers.filter((m) => {
        if (!m.isActive) return false;
        if (isCommitteeHead) {
          return (
            profile.committeeId !== null &&
            m.committeeId === profile.committeeId &&
            m.id !== profile.id
          );
        }
        return true;
      });

      members = targetableMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        committeeName: m.committeeId
          ? commMap.get(m.committeeId) ?? "Unassigned"
          : "Unassigned",
      }));

      // Data-layer privacy: committee heads NEVER receive private HR warnings or notes about themselves
      let dbFeedback: (typeof schema.hrFeedback.$inferSelect)[] = [];
      if (canViewAndCreateWarnings) {
        dbFeedback = await db
          .select()
          .from(schema.hrFeedback)
          .where(
            and(
              eq(schema.hrFeedback.seasonId, seasonId),
              ne(schema.hrFeedback.membershipId, profile.id)
            )
          )
          .orderBy(desc(schema.hrFeedback.createdAt));
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
