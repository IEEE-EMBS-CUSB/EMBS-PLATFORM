import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { PageLoadingState } from "@/components/states/loading-state";
import { requireMemberSession } from "@/lib/portal-guards";
import { getMemberProfile } from "@/services/member.service";

async function MemberPortalFrame({ children }: { children: React.ReactNode }) {
  const session = await requireMemberSession();
  const profile = await getMemberProfile(session.participantId);

  if (!profile) {
    redirect("/member/access");
  }

  return (
    <PortalShell
      portalType="member"
      userName={profile.fullName}
      subtitle={`${profile.committee.name} · ${profile.role}`}
    >
      {children}
    </PortalShell>
  );
}

function MemberShellFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 w-full border-b border-[#5a1b63] bg-[#772583]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageLoadingState />
      </div>
    </div>
  );
}

export default function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MemberShellFallback />}>
      <MemberPortalFrame>{children}</MemberPortalFrame>
    </Suspense>
  );
}
