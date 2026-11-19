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
    redirect("/login");
  }

  // Chapter leadership roles without committee assignments (Director, Master Admin)
  // operate exclusively through the HR & Operations console at /hr.
  if (opProfile?.role === "director" || opProfile?.role === "master_admin") {
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
