import { describe, expect, it } from "vitest";
import {
  getAttendeeAssignments,
  getAttendeeAttendance,
  getAttendeeDashboard,
  getAttendeeProfile,
} from "@/services/attendee.service";

describe("attendee.service", () => {
  it("loads attendee profile, participation summary, session attendance, and assignments", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "mariam.yassin@gmail.com"));
    const attendeeId = rows[0].id;

    const profile = await getAttendeeProfile(attendeeId);
    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBe("Mariam Yassin");

    const dashboard = await getAttendeeDashboard(attendeeId);
    expect(dashboard).not.toBeNull();

    const sessions = await getAttendeeAttendance(attendeeId);
    expect(Array.isArray(sessions)).toBe(true);

    const assignments = await getAttendeeAssignments(attendeeId);
    expect(Array.isArray(assignments)).toBe(true);
  });

  it("never attaches member-only performance metrics to attendee dashboard data", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "mariam.yassin@gmail.com"));
    const dashboard = await getAttendeeDashboard(rows[0].id);
    expect(dashboard).not.toBeNull();

    const keys = Object.keys(dashboard ?? {});
    expect(keys).not.toContain("currentMonthScore");
    expect(keys).not.toContain("overallRank");
    expect(keys).not.toContain("committeeRank");
    expect(keys).not.toContain("evaluations");
    expect(keys).not.toContain("bonusesPoints");
  });

  it("does not resolve a member identifier as an attendee", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "salma.elsayed@cu.edu.eg"));
    expect(await getAttendeeProfile(rows[0].id)).toBeNull();
    expect(await getAttendeeDashboard(rows[0].id)).toBeNull();
  });

  it("resolves database-backed attendee profiles and dashboards", async () => {
    // A database UUID attendee should be resolved
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({ id: schema.rosterMemberships.id })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.persons.email, "mariam.yassin@gmail.com"));

    if (rows.length > 0) {
      const dbAttendeeId = rows[0].id;
      const profile = await getAttendeeProfile(dbAttendeeId);
      expect(profile).not.toBeNull();
      expect(profile?.fullName).toBe("Mariam Yassin");
      expect(profile?.cohortLabel).toBe("Fall 2026");

      const dashboard = await getAttendeeDashboard(dbAttendeeId);
      expect(dashboard).not.toBeNull();
      expect(dashboard?.profile.fullName).toBe("Mariam Yassin");
    }
  });
});
