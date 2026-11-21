import { HrShell } from "@/components/hr/hr-shell";
import { requireHrModule } from "@/lib/portal-guards";
import { EventLogForm } from "@/components/hr/event-log-form";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export default async function HrEventsPage() {
  const { profile } = await requireHrModule("events");
  let committees: { id: string; name: string }[] = [];
  let events: {
    id: string;
    title: string;
    eventDate: string;
    points: number;
    committeeName: string;
  }[] = [];
  let activeSeasonName = "Active Season";
  const defaultDate = new Date().toISOString().slice(0, 10);

  const isBranchWideAllowed =
    profile.role === "master_admin" || profile.role === "hr_admin";

  try {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);

    if (activeSeason) {
      activeSeasonName = activeSeason.name;
      const seasonId = activeSeason.id;

      const [dbCommittees, dbEvents] = await Promise.all([
        db
          .select()
          .from(schema.committees)
          .where(
            and(
              eq(schema.committees.seasonId, seasonId),
              eq(schema.committees.isActive, true)
            )
          ),
        db
          .select()
          .from(schema.events)
          .where(
            !isBranchWideAllowed && profile.committeeId
              ? and(
                  eq(schema.events.seasonId, seasonId),
                  eq(schema.events.committeeId, profile.committeeId)
                )
              : eq(schema.events.seasonId, seasonId)
          )
          .orderBy(desc(schema.events.eventDate)),
      ]);

      const commMap = new Map(dbCommittees.map((c) => [c.id, c.name]));

      committees = isBranchWideAllowed
        ? dbCommittees.map((c) => ({ id: c.id, name: c.name }))
        : dbCommittees
            .filter((c) => c.id === profile.committeeId)
            .map((c) => ({ id: c.id, name: c.name }));

      events = dbEvents.map((e) => ({
        id: e.id,
        title: e.title,
        eventDate: e.eventDate.toISOString().slice(0, 10),
        points: e.points,
        committeeName: e.committeeId
          ? commMap.get(e.committeeId) ?? "Committee"
          : "Branch-wide",
      }));
    }
  } catch {
    // DB offline
  }

  return (
    <HrShell
      activeTab="events"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
      activeSeasonName={activeSeasonName}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-[#002855] sm:text-3xl">
            Events & Points
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log committee or branch events and award points to active participants.
          </p>
        </div>

        <EventLogForm
          committees={committees}
          defaultDate={defaultDate}
          isBranchWideAllowed={isBranchWideAllowed}
          defaultCommitteeId={isBranchWideAllowed ? null : profile.committeeId}
        />

        {events.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4 shadow-xs">
            <h2 className="mb-3 font-heading text-sm font-bold text-[#002855]">
              Recent Events ({events.length})
            </h2>
            <ul className="divide-y divide-border/70 text-xs">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div>
                    <span className="font-semibold text-foreground">
                      {e.title}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      · {e.committeeName} · {e.eventDate}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#00629b]">
                    +{e.points} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </HrShell>
  );
}
