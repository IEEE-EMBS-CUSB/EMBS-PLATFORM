import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessPageShell } from "@/components/auth/access-page-shell";
import { getServerSession } from "@/lib/session-cookie";

export const metadata: Metadata = {
  title: "Attendee access",
  description: "Sign in with your IEEE EMBS CUSB attendee access key.",
};

async function RedirectIfSignedIn() {
  const session = await getServerSession();
  if (session) {
    redirect(session.participantType === "member" ? "/member" : "/attendee");
  }
  return null;
}

export default function AttendeeAccessPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <AccessPageShell heading="Attendee access" />
    </>
  );
}
