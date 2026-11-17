import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessPageShell } from "@/components/auth/access-page-shell";
import { getServerSession } from "@/lib/session-cookie";

export const metadata: Metadata = {
  title: "Member access",
  description: "Sign in with your IEEE EMBS CUSB member access key.",
};

async function RedirectIfSignedIn() {
  const session = await getServerSession();
  if (session) {
    redirect(session.participantType === "member" ? "/member" : "/attendee");
  }
  return null;
}

export default function MemberAccessPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <AccessPageShell heading="Member access" />
    </>
  );
}
