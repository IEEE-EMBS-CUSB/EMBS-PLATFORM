import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addRosterMemberAsActor,
  removeRosterMemberAsActor,
  resetMemberPasswordAsActor,
} from "@/services/hr-ops/roster.service";

describe("Roster Master Actions", () => {
  const createdMemberIds: string[] = [];
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    for (const id of createdMemberIds.splice(0)) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.id, id));
    }
    for (const pid of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, pid));
    }
  });

  it("allows master_admin to add, reuse existing person for a second hat, and deactivate a roster membership", async () => {
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
    expect(addResult.personId).toBeDefined();
    expect(addResult.tempPassword).toBeDefined();
    createdMemberIds.push(addResult.memberId!);
    createdPersonIds.push(addResult.personId!);

    const [inserted] = await db
      .select({
        id: schema.rosterMemberships.id,
        personId: schema.persons.id,
        fullName: schema.persons.fullName,
        passwordHash: schema.persons.passwordHash,
        mustChangePassword: schema.persons.mustChangePassword,
        role: schema.rosterMemberships.role,
        isActive: schema.rosterMemberships.isActive,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.persons,
        eq(schema.rosterMemberships.personId, schema.persons.id)
      )
      .where(eq(schema.rosterMemberships.id, addResult.memberId!));
    expect(inserted).toBeDefined();
    expect(inserted.fullName).toBe("Test Member Master Created");
    expect(inserted.role).toBe("member");
    expect(inserted.mustChangePassword).toBe(true);

    // Adding a second hat for the same email reuses the existing person and preserves passwordHash
    const secondHat = await addRosterMemberAsActor(
      {
        fullName: "Ignored Overwrite Name",
        email: testEmail.toUpperCase(),
        role: "director",
        committeeId: null,
      },
      { profile: { role: "master_admin" } }
    );
    expect(secondHat.ok).toBe(true);
    expect(secondHat.existingPerson).toBe(true);
    expect(secondHat.tempPassword).toBeUndefined();
    expect(secondHat.personId).toBe(addResult.personId);
    createdMemberIds.push(secondHat.memberId!);

    const [personAfter] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, addResult.personId!));
    expect(personAfter.passwordHash).toBe(inserted.passwordHash);
    expect(personAfter.fullName).toBe("Test Member Master Created");

    // Cross-hat privilege-escalation guard: hr_admin CANNOT reset this person's password
    // even when clicking their non-privileged 'member' hat because they also hold 'director'
    const blockedCrossHatReset = await resetMemberPasswordAsActor(
      inserted.id,
      { profile: { role: "hr_admin" } }
    );
    expect(blockedCrossHatReset.ok).toBe(false);
    expect(blockedCrossHatReset.error).toMatch(/unauthorized/i);

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
