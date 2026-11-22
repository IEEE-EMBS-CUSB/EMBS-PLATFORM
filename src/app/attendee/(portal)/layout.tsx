import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireAttendeeSession } from "@/lib/portal-guards";
import { getAttendeeProfile } from "@/services/attendee.service";
import {
  listEligibleContextsForPerson,
  toContextPickerOptions,
} from "@/services/context.service";
import { getAttendeeNavNotifications } from "@/services/notifications.service";

export default async function AttendeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAttendeeSession();
  const [profile, eligibleContexts, navBadges] = await Promise.all([
    getAttendeeProfile(session.participantId),
    listEligibleContextsForPerson(session.personId),
    getAttendeeNavNotifications(session.participantId),
  ]);

  if (!profile) {
    redirect("/login?session=invalid");
  }

  return (
    <PortalShell
      portalType="attendee"
      userName={profile.fullName}
      subtitle={`${profile.programTrack} · ${profile.cohortLabel}`}
      contexts={toContextPickerOptions(eligibleContexts)}
      activeMembershipId={session.participantId}
      navBadges={navBadges}
    >
      {children}
    </PortalShell>
  );
}
