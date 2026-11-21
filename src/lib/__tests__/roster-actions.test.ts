import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addRosterMemberAsActor,
  removeRosterMemberAsActor,
} from "@/services/hr-ops/roster.service";

describe("Roster Master Actions", () => {
  const createdMemberIds: string[] = [];

  afterEach(async () => {
    for (const id of createdMemberIds.splice(0)) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, id));
    }
  });

  it("allows master_admin to add and remove a roster member in the database", async () => {
    const testEmail = `test.member.${Date.now()}@cu.edu.eg`;

    const unauthorizedResult = await addRosterMemberAsActor(
      {
        fullName: "Test Non-Master Candidate",
        email: testEmail,
        role: "member",
        committeeId: null,
      },
      { profile: { role: "hr_admin" } }
    );
    expect(unauthorizedResult.ok).toBe(false);
    expect(unauthorizedResult.error).toMatch(/unauthorized/i);

    const addResult = await addRosterMemberAsActor(
      {
        fullName: "Test Member Master Created",
        email: testEmail,
        role: "member",
        committeeId: null,
      },
      { profile: { role: "master_admin" } }
    );
    expect(addResult.ok).toBe(true);
    expect(addResult.memberId).toBeDefined();
    createdMemberIds.push(addResult.memberId!);

    const [inserted] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, addResult.memberId!));
    expect(inserted).toBeDefined();
    expect(inserted.fullName).toBe("Test Member Master Created");
    expect(inserted.role).toBe("member");
    expect(inserted.mustChangePassword).toBe(true);

    const unauthDelete = await removeRosterMemberAsActor(inserted.id, {
      profile: { role: "hr_admin" },
    });
    expect(unauthDelete.ok).toBe(false);
    expect(unauthDelete.error).toMatch(/unauthorized/i);

    const deleteResult = await removeRosterMemberAsActor(inserted.id, {
      profile: { role: "master_admin" },
    });
    expect(deleteResult.ok).toBe(true);

    const checkDeleted = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, inserted.id));
    expect(checkDeleted).toHaveLength(1);
    expect(checkDeleted[0].isActive).toBe(false);
  });
});
