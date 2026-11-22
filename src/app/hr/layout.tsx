import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { HrShell } from "@/components/hr/hr-shell";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { requireOperationalSession } from "@/lib/portal-guards";

export default async function HrLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireOperationalSession();

  let activeSeasonName = "Active Season";
  try {
    const [activeSeason] = await db
      .select({ name: schema.seasons.name })
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
    }
  } catch {
    // Graceful fallback if DB is temporarily unreachable
  }

  return (
    <HrShell
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={
        profile.role === "hr_member"
          ? profile.trackedCommitteeName
            ? `HR · Tracking ${profile.trackedCommitteeName}`
            : profile.committeeName ?? "Human Resources"
          : (profile.committeeName ??
            (profile.managedTrackName ? `${profile.managedTrackName} Track` : undefined))
      }
      activeSeasonName={activeSeasonName}
    >
      {children}
    </HrShell>
  );
}
