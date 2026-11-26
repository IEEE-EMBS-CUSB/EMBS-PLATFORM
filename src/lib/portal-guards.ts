import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session-cookie";
import { isOperationalRole } from "@/lib/auth-helpers";
import {
  canAccessHrModule,
  type HrModuleName,
} from "@/lib/permissions";
import {
  getOperationalUserProfile,
  type OperationalUserProfile,
} from "@/services/member.service";
import type { SessionUser } from "@/types";

export async function requireMemberSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?session=invalid");
  }
  if (session.participantType !== "member") {
    redirect("/attendee");
  }
  return session;
}

export async function requireAttendeeSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?session=invalid");
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
    redirect("/login?session=invalid");
  }
  if (session.participantType !== "member") {
    redirect("/attendee");
  }

  const profile = await getOperationalUserProfile(
    session.participantId,
    session.trackedCommitteeId
  );
  if (!profile) {
    redirect("/login?session=invalid");
  }

  if (!isOperationalRole(profile.role)) {
    redirect("/member");
  }

  return { session, profile };
}

/**
 * Enforces module-level RBAC on /hr/* pages.
 * Operational users without permission for the requested module are redirected to /hr.
 */
export async function requireHrModule(moduleName: HrModuleName): Promise<{
  session: SessionUser;
  profile: OperationalUserProfile;
}> {
  const ctx = await requireOperationalSession();
  if (!canAccessHrModule(ctx.profile.role, moduleName)) {
    redirect("/hr");
  }
  return ctx;
}
