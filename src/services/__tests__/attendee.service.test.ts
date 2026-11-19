import { describe, expect, it } from "vitest";
import {
  getAttendeeAssignments,
  getAttendeeAttendance,
  getAttendeeDashboard,
  getAttendeeProfile,
} from "@/services/attendee.service";

describe("attendee.service", () => {
  it("loads attendee profile, participation summary, session attendance, and assignments", async () => {
    const profile = await getAttendeeProfile("att-201");
    expect(profile?.displayId).toBe("A001");
    expect(profile?.fullName).toBe("Mariam Hesham");

    const dashboard = await getAttendeeDashboard("att-201");
    expect(dashboard).not.toBeNull();
    expect(dashboard?.participation.sessionsAttended).toBe(5);
    expect(dashboard?.participation.marksSummaryLabel).toBe("53 / 60");

    const sessions = await getAttendeeAttendance("att-201");
    expect(sessions.length).toBe(6);

    const assignments = await getAttendeeAssignments("att-201");
    expect(assignments.length).toBe(4);
    expect(assignments[0]?.status).toBe("pending");
    expect(assignments[0]?.mark).toBeNull();
    expect(assignments[1]?.status).toBe("graded");
    expect(assignments[1]?.mark).toBe(19);
  });

  it("never attaches member-only performance metrics to attendee dashboard data", async () => {
    const dashboard = await getAttendeeDashboard("att-201");
    expect(dashboard).not.toBeNull();

    const keys = Object.keys(dashboard ?? {});
    expect(keys).not.toContain("currentMonthScore");
    expect(keys).not.toContain("overallRank");
    expect(keys).not.toContain("committeeRank");
    expect(keys).not.toContain("evaluations");
    expect(keys).not.toContain("bonusesPoints");
  });

  it("does not resolve a member identifier as an attendee", async () => {
    expect(await getAttendeeProfile("mem-101")).toBeNull();
    expect(await getAttendeeDashboard("mem-101")).toBeNull();
  });

  it("resolves database-backed attendee profiles and dashboards", async () => {
    // A database UUID attendee should be resolved
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "mariam.yassin@gmail.com"));

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
