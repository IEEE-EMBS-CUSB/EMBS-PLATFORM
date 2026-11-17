import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session-cookie";
import type { SessionUser } from "@/types";

export async function requireMemberSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/member/access");
  }
  if (session.participantType !== "member") {
    redirect("/attendee");
  }
  return session;
}

export async function requireAttendeeSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/attendee/access");
  }
  if (session.participantType !== "attendee") {
    redirect("/member");
  }
  return session;
}
