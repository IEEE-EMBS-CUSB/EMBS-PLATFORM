import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireMemberSession } from "@/lib/portal-guards";
import {
  getMemberProfile,
  getOperationalUserProfile,
} from "@/services/member.service";
import {
  listEligibleContextsForPerson,
  toContextPickerOptions,
} from "@/services/context.service";
import type { MembershipRole } from "@/lib/auth-helpers";

export default async function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMemberSession();
  const [profile, opProfile, eligibleContexts] = await Promise.all([
    getMemberProfile(session.participantId),
    getOperationalUserProfile(session.participantId),
    listEligibleContextsForPerson(session.personId),
  ]);

  if (!profile) {
    redirect("/login?session=invalid");
  }

  // Chapter leadership and HR admins without committee personal-work views operate through /hr.
  // Committee heads and HR members can switch freely between /hr and /member
  // to view and submit personal work assigned to them.
  if (
    opProfile &&
    (opProfile.role === "master_admin" ||
      opProfile.role === "director" ||
      opProfile.role === "hr_admin")
  ) {
    redirect("/hr");
  }

  const role: MembershipRole =
    opProfile?.role ??
    (profile.role === "Head" ? "committee_head" : "member");

  return (
    <PortalShell
      portalType="member"
      userName={profile.fullName}
      subtitle={`${profile.committee.name} · ${profile.role}`}
      currentUserRole={role}
      contexts={toContextPickerOptions(eligibleContexts)}
      activeMembershipId={session.participantId}
    >
      {children}
    </PortalShell>
  );
}
