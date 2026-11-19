import { describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addRosterMemberAction,
  removeRosterMemberAction,
} from "@/app/hr/roster/actions";

describe("Roster Master Actions", () => {
  it("allows master_admin to add and remove a roster member in the database", async () => {
    const testEmail = `test.member.${Date.now()}@cu.edu.eg`;

    // 1. Unauthorized attempt by a non-master role
    const unauthorizedResult = await addRosterMemberAction(
      {
        fullName: "Test Non-Master Candidate",
        email: testEmail,
        role: "member",
        committeeId: null,
      },
      "hr_admin"
    );
    expect(unauthorizedResult.ok).toBe(false);
    expect(unauthorizedResult.error).toMatch(/unauthorized/i);

    // 2. Authorized addition by master_admin
    const addResult = await addRosterMemberAction(
      {
        fullName: "Test Member Master Created",
        email: testEmail,
        role: "member",
        committeeId: null,
      },
      "master_admin"
    );
    if (!addResult.ok) {
      console.error("ADD RESULT FAILED WITH ERROR:", addResult.error);
    }
    expect(addResult.ok).toBe(true);
    expect(addResult.memberId).toBeDefined();

    // Verify row exists in DB
    const [inserted] = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.email, testEmail));
    expect(inserted).toBeDefined();
    expect(inserted.fullName).toBe("Test Member Master Created");
    expect(inserted.role).toBe("member");
    expect(inserted.mustChangePassword).toBe(true);

    // 3. Unauthorized deletion attempt by non-master
    const unauthDelete = await removeRosterMemberAction(inserted.id, "hr_admin");
    expect(unauthDelete.ok).toBe(false);
    expect(unauthDelete.error).toMatch(/unauthorized/i);

    // 4. Authorized deletion by master_admin
    const deleteResult = await removeRosterMemberAction(inserted.id, "master_admin");
    expect(deleteResult.ok).toBe(true);

    // Verify row removed from DB
    const checkDeleted = await db
      .select()
      .from(schema.rosterMemberships)
      .where(eq(schema.rosterMemberships.id, inserted.id));
    expect(checkDeleted).toHaveLength(0);
  });
});
