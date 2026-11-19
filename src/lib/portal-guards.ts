import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session-cookie";
import { isOperationalRole } from "@/lib/auth-helpers";
import {
  getOperationalUserProfile,
  type OperationalUserProfile,
} from "@/services/member.service";
import type { SessionUser } from "@/types";

export async function requireMemberSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (session.participantType !== "member") {
    redirect("/attendee");
  }
  return session;
}

export async function requireAttendeeSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (session.participantType !== "attendee") {
    redirect("/member");
  }
  return session;
}

export async function requireOperationalSession(): Promise<{
  session: SessionUser;
  profile: OperationalUserProfile;
}> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (session.participantType !== "member") {
    redirect("/attendee");
  }

  const profile = await getOperationalUserProfile(session.participantId);
  if (!profile) {
    redirect("/login");
  }

  if (!isOperationalRole(profile.role)) {
    redirect("/member");
  }

  return { session, profile };
}

