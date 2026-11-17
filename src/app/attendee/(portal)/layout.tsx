import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { PageLoadingState } from "@/components/states/loading-state";
import { requireAttendeeSession } from "@/lib/portal-guards";
import { getAttendeeProfile } from "@/services/attendee.service";

async function AttendeePortalFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAttendeeSession();
  const profile = await getAttendeeProfile(session.participantId);

  if (!profile) {
    redirect("/attendee/access");
  }

  return (
    <PortalShell
      portalType="attendee"
      userName={profile.fullName}
      subtitle={`${profile.programTrack} · ${profile.cohortLabel}`}
    >
      {children}
    </PortalShell>
  );
}

function AttendeeShellFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 w-full border-b border-[#5a1b63] bg-[#772583]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageLoadingState />
      </div>
    </div>
  );
}

export default function AttendeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AttendeeShellFallback />}>
      <AttendeePortalFrame>{children}</AttendeePortalFrame>
    </Suspense>
  );
}
