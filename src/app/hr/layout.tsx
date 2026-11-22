import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { HrShell } from "@/components/hr/hr-shell";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { requireOperationalSession } from "@/lib/portal-guards";
import {
  listEligibleContextsForPerson,
  toContextPickerOptions,
} from "@/services/context.service";
import { getHrNavNotifications } from "@/services/notifications.service";

export default async function HrLayout({ children }: { children: ReactNode }) {
  const { session, profile } = await requireOperationalSession();

  const [eligibleContexts, activeSeasonName, navBadges] = await Promise.all([
    listEligibleContextsForPerson(session.personId),
    db
      .select({ name: schema.seasons.name })
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1)
      .then(([activeSeason]) => activeSeason?.name ?? "Active Season")
      .catch(() => "Active Season"),
    getHrNavNotifications(profile),
  ]);

  return (
    <HrShell
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={
        profile.role === "hr_member"
          ? profile.trackedCommitteeName
            ? `HR · Tracking ${profile.trackedCommitteeName}`
            : profile.committeeName ?? "Human Resources"
          : (profile.committeeName ??
            (profile.managedTrackName ? `${profile.managedTrackName} Track` : undefined))
      }
      activeSeasonName={activeSeasonName}
      contexts={toContextPickerOptions(eligibleContexts)}
      activeMembershipId={session.participantId}
      navBadges={navBadges}
    >
      {children}
    </HrShell>
  );
}
