import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireMemberSession } from "@/lib/portal-guards";
import {
  getMemberProfile,
  getOperationalUserProfile,
} from "@/services/member.service";
import type { MembershipRole } from "@/lib/auth-helpers";

export default async function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMemberSession();
  const [profile, opProfile] = await Promise.all([
    getMemberProfile(session.participantId),
    getOperationalUserProfile(session.participantId),
  ]);

  if (!profile) {
    redirect("/login?session=invalid");
  }

  // Chapter leadership and HR roles without committee member views operate through /hr.
  // Committee heads can switch freely between Leader View (/hr) and Member View (/member)
  // to view and submit assignments given to them by Directors.
  if (
    opProfile &&
    (opProfile.role === "master_admin" ||
      opProfile.role === "director" ||
      opProfile.role === "hr_admin" ||
      opProfile.role === "hr_member")
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
    >
      {children}
    </PortalShell>
  );
}
