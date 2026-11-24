import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addRosterMemberAsActor,
  updatePersonPhoneNumberAsActor,
} from "@/services/hr-ops/roster.service";
import {
  authenticateWithPassword,
  resolveLoginMembershipByIdentifier,
} from "@/services/auth-password.service";

describe("Phone Number on persons: Roster CRUD & Phone Login (real PostgreSQL)", () => {
  const createdPersonIds: string[] = [];
  let activeSeasonId = "";
  let commId = "";
  let memberId = "";
  let tempPassword = "";
  let uniquePhoneLocal = "";
  let uniquePhoneE164 = "";

  beforeAll(async () => {
    const [activeSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "active"))
      .limit(1);
    if (!activeSeason) throw new Error("Expected active season");
    activeSeasonId = activeSeason.id;

    const [comm] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.seasonId, activeSeasonId))
      .limit(1);
    if (!comm) throw new Error("Expected committee in active season");
    commId = comm.id;

    // Generate a unique valid Egyptian mobile number: 010 + 8 random digits
    const eightDigits = String(crypto.randomInt(10_000_000, 99_999_999));
    uniquePhoneLocal = `010${eightDigits}`;
    uniquePhoneE164 = `+2010${eightDigits}`;
  });

  afterAll(async () => {
    for (const personId of createdPersonIds) {
      await db
        .delete(schema.rosterMemberships)
        .where(eq(schema.rosterMemberships.personId, personId));
      await db.delete(schema.persons).where(eq(schema.persons.id, personId));
    }
  });

  it("saves normalized phone number when Master Admin adds a roster member and allows phone login", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const addRes = await addRosterMemberAsActor(
      {
        fullName: `Phone Test ${suffix}`,
        email: `phonetest-${suffix}@cu.edu.eg`,
        phoneNumber: `010 ${uniquePhoneLocal.slice(3, 7)} ${uniquePhoneLocal.slice(7)}`,
        role: "member",
        committeeId: commId,
      },
      { profile: { role: "master_admin" } }
    );

    expect(addRes.ok).toBe(true);
    expect(addRes.personId).toBeDefined();
    expect(addRes.memberId).toBeDefined();
    expect(addRes.tempPassword).toBeDefined();
    createdPersonIds.push(addRes.personId!);
    memberId = addRes.memberId!;
    tempPassword = addRes.tempPassword!;

    // Stored in canonical E.164 on persons table
    const [person] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, addRes.personId!))
      .limit(1);
    expect(person?.phoneNumber).toBe(uniquePhoneE164);

    // Lookup by local format and E.164 format both resolve the same person
    const lookupLocal = await resolveLoginMembershipByIdentifier(uniquePhoneLocal);
    expect(lookupLocal?.personId).toBe(addRes.personId);
    const lookupIntl = await resolveLoginMembershipByIdentifier(uniquePhoneE164);
    expect(lookupIntl?.personId).toBe(addRes.personId);

    // Authenticate with local phone number + password
    const authRes = await authenticateWithPassword({
      email: uniquePhoneLocal,
      password: tempPassword,
    });
    expect(authRes.ok).toBe(true);
    if (authRes.ok) {
      expect(authRes.member.personId).toBe(addRes.personId);
      expect(authRes.mustChangePassword).toBe(true);
    }
  });

  it("rejects duplicate phone numbers across distinct persons and allows HR Admin / Master Admin to update phone numbers", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const dupRes = await addRosterMemberAsActor(
      {
        fullName: `Phone Dup ${suffix}`,
        email: `phonedup-${suffix}@cu.edu.eg`,
        phoneNumber: uniquePhoneLocal,
        role: "member",
        committeeId: commId,
      },
      { profile: { role: "master_admin" } }
    );
    expect(dupRes.ok).toBe(false);
    expect(dupRes.error).toMatch(/phone number/i);

    // Committee head cannot edit phone numbers
    const forbidden = await updatePersonPhoneNumberAsActor(
      memberId,
      "01112345678",
      { profile: { role: "committee_head", committeeId: commId } }
    );
    expect(forbidden.ok).toBe(false);

    // HR Admin can update phone number to a new normalized number
    const newEight = String(crypto.randomInt(10_000_000, 99_999_999));
    const newLocal = `011${newEight}`;
    const newE164 = `+2011${newEight}`;
    const updated = await updatePersonPhoneNumberAsActor(
      memberId,
      newLocal,
      { profile: { role: "hr_admin" } }
    );
    expect(updated.ok).toBe(true);
    expect(updated.phoneNumber).toBe(newE164);

    // Login works with the updated phone number and no longer with the old one
    const authNew = await authenticateWithPassword({
      email: newLocal,
      password: tempPassword,
    });
    expect(authNew.ok).toBe(true);

    const authOld = await authenticateWithPassword({
      email: uniquePhoneLocal,
      password: tempPassword,
    });
    expect(authOld.ok).toBe(false);
  });
});
