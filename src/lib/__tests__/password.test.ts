import { afterEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generatePreassignedPassword,
  getDefaultMemberPassword,
  isPasswordStrong,
} from "@/lib/password";

describe("Password Hashing & Strength Utility", () => {
  const originalDefaultPassword = process.env.DEFAULT_MEMBER_PASSWORD;

  afterEach(() => {
    if (originalDefaultPassword === undefined) {
      delete process.env.DEFAULT_MEMBER_PASSWORD;
    } else {
      process.env.DEFAULT_MEMBER_PASSWORD = originalDefaultPassword;
    }
  });

  it("hashes password with a random salt and verifies correctly", () => {
    const raw = "EMBS2026!secret";
    const hashed = hashPassword(raw);

    expect(hashed).toContain(":");
    expect(verifyPassword(raw, hashed)).toBe(true);
    expect(verifyPassword("WrongPassword123", hashed)).toBe(false);
  });

  it("produces unique hashes for the same password due to random salting", () => {
    const raw = "MyInitialPassword!";
    const hash1 = hashPassword(raw);
    const hash2 = hashPassword(raw);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(raw, hash1)).toBe(true);
    expect(verifyPassword(raw, hash2)).toBe(true);
  });

  it("generates structured pre-assigned passwords for new roster members", () => {
    const preassigned = generatePreassignedPassword();
    expect(preassigned).toMatch(/^EMBS-\d{4}-[A-Z0-9]{8}$/);
  });

  it("reads DEFAULT_MEMBER_PASSWORD from env when configured and falls back when unset", () => {
    process.env.DEFAULT_MEMBER_PASSWORD = "  EMBS-Season2026!  ";
    expect(getDefaultMemberPassword()).toBe("EMBS-Season2026!");

    delete process.env.DEFAULT_MEMBER_PASSWORD;
    expect(getDefaultMemberPassword()).toMatch(/^EMBS-\d{4}-[A-Z0-9]{8}$/);
  });

  it("validates password strength rules (at least 8 chars)", () => {
    expect(isPasswordStrong("short").valid).toBe(false);
    expect(isPasswordStrong("short").reason).toMatch(/at least 8 characters/i);
    expect(isPasswordStrong("StrongPassword2026!").valid).toBe(true);
  });
});
