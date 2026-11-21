import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  createSessionAsActor,
  rotateSessionCheckinCodeAsActor,
  recordMemberCheckin,
} from "@/services/hr-ops/attendance.service";

describe("QR code rotation", () => {
  const createdSessionIds: string[] = [];

  afterEach(async () => {
    for (const sessionId of createdSessionIds.splice(0)) {
      const records = await db
        .select({ id: schema.attendanceRecords.id })
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      for (const rec of records) {
        await db
          .delete(schema.scoreLedger)
          .where(eq(schema.scoreLedger.sourceId, rec.id));
      }
      await db
        .delete(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.sessionId, sessionId));
      await db
        .delete(schema.branchSessions)
        .where(eq(schema.branchSessions.id, sessionId));
    }
  });

  it("rotates an open session code, blocks unauthorized rotators, and accepts check-in with the new code", async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"));
    const [robotics] = await db
      .select()
      .from(schema.committees)
      .where(
        and(
          eq(schema.committees.slug, "robotics-and-automation"),
          eq(schema.committees.seasonId, activeSeason.id)
        )
      );
    expect(robotics).toBeDefined();

    const [omar] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, "omar.tarek@cu.edu.eg"));
    expect(omar).toBeDefined();

    const created = await createSessionAsActor(
      {
        title: `QR Rotation ${Date.now()}`,
        startsAt: new Date(Date.now() - 60000).toISOString(),
        committeeId: robotics.id,
        checkinWindowMinutes: 30,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
        openCheckinImmediately: true,
      },
      { profile: { id: "test", role: "committee_head", committeeId: robotics.id } }
    );
    expect(created.ok).toBe(true);
    createdSessionIds.push(created.sessionId!);
    const firstCode = created.checkinCode!;
    expect(firstCode).toHaveLength(6);

    // Unauthorized role (director) or cross-committee head must be rejected
    const unauthRotate = await rotateSessionCheckinCodeAsActor(
      created.sessionId!,
      30,
      { profile: { id: "other", role: "committee_head", committeeId: "different-comm" } }
    );
    expect(unauthRotate.ok).toBe(false);
    expect(unauthRotate.error).toMatch(/unauthorized/i);

    const rotated = await rotateSessionCheckinCodeAsActor(created.sessionId!, 30, {
      profile: { id: "test", role: "committee_head", committeeId: robotics.id },
    });
    expect(rotated.ok).toBe(true);
    expect(rotated.checkinCode).not.toBe(firstCode);
    expect(rotated.checkinCode).toHaveLength(6);

    const oldCheckin = await recordMemberCheckin(firstCode, omar.id);
    expect(oldCheckin.ok).toBe(false);

    const newCheckin = await recordMemberCheckin(rotated.checkinCode!, omar.id);
    expect(newCheckin.ok).toBe(true);
  });
});
