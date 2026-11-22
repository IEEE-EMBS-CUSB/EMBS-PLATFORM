import { describe, expect, it } from "vitest";
import {
  authenticateWithPassword,
  changeFirstLoginPassword,
  pickPreferredLoginMembership,
  resetPersonPassword,
} from "@/services/auth-password.service";
import { hashPassword } from "@/lib/password";

describe("Password Authentication & First-Login Reset Service", () => {
  const initialPassword = "EMBS-2026-INIT";
  const initialHash = hashPassword(initialPassword);

  const mockRoster = [
    {
      id: "mem-test-1",
      personId: "person-test-1",
      email: "salma.elsayed@cu.edu.eg",
      fullName: "Salma El-Sayed",
      role: "committee_head" as const,
      passwordHash: initialHash,
      mustChangePassword: true,
      isActive: true,
    },
    {
      id: "mem-inactive",
      personId: "person-inactive",
      email: "inactive@cu.edu.eg",
      fullName: "Inactive Member",
      role: "member" as const,
      passwordHash: initialHash,
      mustChangePassword: true,
      isActive: false,
    },
  ];

  it("authenticates with pre-assigned password and flags mustChangePassword on first login", async () => {
    const result = await authenticateWithPassword({
      email: "  Salma.ElSayed@CU.EDU.EG ",
      password: initialPassword,
      rosterLookup: async () => mockRoster[0],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mustChangePassword).toBe(true);
      expect(result.member.personId).toBe("person-test-1");
      expect(result.member.email).toBe("salma.elsayed@cu.edu.eg");
    }
  });

  it("rejects wrong password cleanly without disclosing internal info", async () => {
    const result = await authenticateWithPassword({
      email: "salma.elsayed@cu.edu.eg",
      password: "WrongPassword999",
      rosterLookup: async () => mockRoster[0],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/invalid email or password/i);
    }
  });

  it("rejects non-whitelisted emails cleanly without disclosing account existence", async () => {
    const result = await authenticateWithPassword({
      email: "stranger@gmail.com",
      password: initialPassword,
      rosterLookup: async () => null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/invalid email or password/i);
    }
  });

  it("rejects first-login password change if mustChangePassword is already false", async () => {
    const res = await changeFirstLoginPassword({
      currentPassword: initialPassword,
      newPassword: "NewSecretPassword2026!",
      member: {
        id: "mem-test-1",
        email: "salma.elsayed@cu.edu.eg",
        passwordHash: initialHash,
        mustChangePassword: false,
      },
    });
    expect(res.ok).toBe(false);
  });

  it("enforces password change on first login and marks mustChangePassword = false", async () => {
    let storedHash = initialHash;
    let storedMustChange = true;

    const changeResult = await changeFirstLoginPassword({
      currentPassword: initialPassword,
      newPassword: "NewSecretPassword2026!",
      member: {
        id: "mem-test-1",
        email: "salma.elsayed@cu.edu.eg",
        passwordHash: storedHash,
        mustChangePassword: storedMustChange,
      },
      updateMember: async (_id, data) => {
        storedHash = data.passwordHash;
        storedMustChange = data.mustChangePassword;
      },
    });

    expect(changeResult.ok).toBe(true);
    expect(storedMustChange).toBe(false);
    expect(storedHash).not.toBe(initialHash);
  });

  it("resets password on persons record with mustChangePassword = true", async () => {
    let updatedPersonId = "";
    let updatedHash = "";
    let updatedMustChange = false;

    const resetResult = await resetPersonPassword({
      personId: "person-test-1",
      tempPassword: "EMBS-2026-TEMP",
      updatePerson: async (personId, data) => {
        updatedPersonId = personId;
        updatedHash = data.passwordHash;
        updatedMustChange = data.mustChangePassword;
      },
    });

    expect(resetResult.ok).toBe(true);
    expect(resetResult.tempPassword).toBe("EMBS-2026-TEMP");
    expect(updatedPersonId).toBe("person-test-1");
    expect(updatedMustChange).toBe(true);
    expect(updatedHash).toContain(":");
  });

  it("picks highest-precedence active-season hat for multi-role persons and blocks archived fallback when deactivated in active season", () => {
    const chosen = pickPreferredLoginMembership([
      {
        id: "m-archived",
        role: "committee_head",
        committeeId: "c-old",
        isActive: true,
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01"),
        createdAt: new Date("2025-09-01"),
      },
      {
        id: "m-member",
        role: "member",
        committeeId: "c-ai",
        isActive: true,
        seasonStatus: "active",
        seasonStartDate: new Date("2026-09-01"),
        createdAt: new Date("2026-09-02"),
      },
      {
        id: "m-hr",
        role: "hr_member",
        committeeId: "c-pr",
        isActive: true,
        seasonStatus: "active",
        seasonStartDate: new Date("2026-09-01"),
        createdAt: new Date("2026-09-03"),
      },
    ]);
    expect(chosen?.id).toBe("m-hr");

    // Deactivated in active season must NOT fall back to archived season
    const deactivatedInActive = pickPreferredLoginMembership([
      {
        id: "m-archived",
        role: "member",
        committeeId: "c-old",
        isActive: true,
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01"),
        createdAt: new Date("2025-09-01"),
      },
      {
        id: "m-active-disabled",
        role: "member",
        committeeId: "c-ai",
        isActive: false,
        seasonStatus: "active",
        seasonStartDate: new Date("2026-09-01"),
        createdAt: new Date("2026-09-02"),
      },
    ]);
    expect(deactivatedInActive).toBeNull();

    // Alumni with no active-season membership can still resolve most recent archived membership
    const alumni = pickPreferredLoginMembership([
      {
        id: "m-old-1",
        role: "member",
        committeeId: "c-1",
        isActive: true,
        seasonStatus: "archived",
        seasonStartDate: new Date("2024-09-01"),
        createdAt: new Date("2024-09-01"),
      },
      {
        id: "m-old-2",
        role: "committee_head",
        committeeId: "c-2",
        isActive: true,
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01"),
        createdAt: new Date("2025-09-01"),
      },
    ]);
    expect(alumni?.id).toBe("m-old-2");
  });
});
