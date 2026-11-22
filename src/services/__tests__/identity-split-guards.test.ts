import { describe, expect, it } from "vitest";
import {
  isSamePersonOrMembership,
} from "@/services/hr-ops/helpers";
import {
  isProtectedFromHrAdminPasswordReset,
} from "@/services/hr-ops/roster.service";

describe("Multi-hat identity security guards", () => {
  it("blocks hr_admin password reset when ANY active hat of the target person is privileged", () => {
    // Person is a director in one hat and a regular member in another hat
    expect(isProtectedFromHrAdminPasswordReset(["member", "director"])).toBe(true);
    expect(isProtectedFromHrAdminPasswordReset(["member", "master_admin"])).toBe(true);
    expect(isProtectedFromHrAdminPasswordReset(["attendee", "hr_admin"])).toBe(true);

    // Person holds only non-privileged hats -> HR Admin may reset
    expect(isProtectedFromHrAdminPasswordReset(["member", "hr_member"])).toBe(false);
    expect(isProtectedFromHrAdminPasswordReset(["committee_head", "attendee"])).toBe(false);
    expect(isProtectedFromHrAdminPasswordReset([])).toBe(false);
  });

  it("identifies self across different membership hats via personId", () => {
    // Different membership IDs, same personId -> MUST be treated as self
    expect(
      isSamePersonOrMembership(
        { id: "mem-head-ai", personId: "person-1" },
        { id: "mem-member-pr", personId: "person-1" }
      )
    ).toBe(true);

    // Same membership ID (even if personId omitted in unit mock) -> self
    expect(
      isSamePersonOrMembership(
        { id: "mem-1" },
        { id: "mem-1", personId: "person-1" }
      )
    ).toBe(true);

    // Different personId and different membershipId -> NOT self
    expect(
      isSamePersonOrMembership(
        { id: "mem-1", personId: "person-1" },
        { id: "mem-2", personId: "person-2" }
      )
    ).toBe(false);
  });
});
