import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmbsMark } from "@/components/brand/embs-mark";
import { QrCheckinHandler } from "@/components/member/qr-checkin-handler";
import { getServerSession } from "@/lib/session-cookie";

export const metadata: Metadata = {
  title: "Session Check-In · IEEE EMBS CUSB",
  description: "Record your attendance for a live IEEE EMBS CUSB session.",
};

interface CheckinPageProps {
  searchParams: Promise<{ code?: string }>;
}

function getAttendanceDestination(
  participantType: "member" | "attendee",
  membershipRole?: string
): string {
  if (participantType === "attendee") {
    return "/attendee/attendance";
  }
  if (
    membershipRole === "master_admin" ||
    membershipRole === "director" ||
    membershipRole === "hr_admin"
  ) {
    return "/hr/attendance";
  }
  return "/member/attendance";
}

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const { code } = await searchParams;
  const cleanCode = code?.trim() ?? "";

  const session = await getServerSession();
  if (!session) {
    const nextTarget = cleanCode
      ? `/checkin?code=${encodeURIComponent(cleanCode)}`
      : "/checkin";
    redirect(`/login?next=${encodeURIComponent(nextTarget)}`);
  }

  const destinationPath = getAttendanceDestination(
    session.participantType,
    session.membershipRole
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-md">
            <EmbsMark inverted />
          </Link>
          <span className="text-xs font-semibold text-white/90">
            {session.fullName}
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <QrCheckinHandler
          initialCode={cleanCode}
          destinationPath={destinationPath}
        />
      </main>
    </div>
  );
}
