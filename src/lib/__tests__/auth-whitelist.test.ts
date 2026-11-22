import { describe, expect, it } from "vitest";
import {
  checkRosterWhitelist,
  getRoleLandingPath,
  isOperationalRole,
} from "@/lib/auth-helpers";
import type { RosterMembershipRecord } from "@/lib/auth-helpers";

describe("Roster Whitelist & Role Access Helpers", () => {
  const activeMemberships: RosterMembershipRecord[] = [
    {
      id: "mem-1",
      seasonId: "season-2026",
      email: "salma.elsayed@cu.edu.eg",
      fullName: "Salma El-Sayed",
      role: "committee_head",
      isActive: true,
      seasonStatus: "active",
    },
    {
      id: "mem-2",
      seasonId: "season-2026",
      email: "hr.lead@cu.edu.eg",
      fullName: "Sara Hassan",
      role: "hr_admin",
      isActive: true,
      seasonStatus: "active",
    },
    {
      id: "att-1",
      seasonId: "season-2026",
      email: "attendee.mariam@gmail.com",
      fullName: "Mariam Yassin",
      role: "attendee",
      isActive: true,
      seasonStatus: "active",
    },
    {
      id: "mem-inactive",
      seasonId: "season-2026",
      email: "inactive.member@cu.edu.eg",
      fullName: "Former Member",
      role: "member",
      isActive: false,
      seasonStatus: "active",
    },
    {
      id: "alumni-1",
      seasonId: "season-2025",
      email: "alumni.omar@cu.edu.eg",
      fullName: "Omar Tarek",
      role: "member",
      isActive: true,
      seasonStatus: "archived",
    },
    {
      id: "master-archived-1",
      seasonId: "season-2025",
      email: "master.archived@cu.edu.eg",
      fullName: "Master Admin",
      role: "master_admin",
      isActive: true,
      seasonStatus: "archived",
    },
  ];

  it("authorizes active season members and normalizes input emails", () => {
    const result = checkRosterWhitelist(
      "  Salma.ElSayed@CU.EDU.EG  ",
      activeMemberships
    );
    expect(result.allowed).toBe(true);
    expect(result.membership?.role).toBe("committee_head");
    expect(result.isAlumni).toBe(false);
  });

  it("authorizes HR admins for the /hr portal", () => {
    const result = checkRosterWhitelist("hr.lead@cu.edu.eg", activeMemberships);
    expect(result.allowed).toBe(true);
    expect(result.membership?.role).toBe("hr_admin");
    expect(getRoleLandingPath(result.membership?.role)).toBe("/hr");
  });

  it("authorizes Master admins and HR members for the /hr operations workspace", () => {
    expect(getRoleLandingPath("master_admin")).toBe("/hr");
    expect(getRoleLandingPath("hr_member")).toBe("/hr");
    expect(getRoleLandingPath("committee_head")).toBe("/hr");
  });

  it("authorizes attendees exclusively for the /attendee portal", () => {
    const result = checkRosterWhitelist(
      "attendee.mariam@gmail.com",
      activeMemberships
    );
    expect(result.allowed).toBe(true);
    expect(result.membership?.role).toBe("attendee");
    expect(getRoleLandingPath(result.membership?.role)).toBe("/attendee");
  });

  it("denies access to inactive members", () => {
    const result = checkRosterWhitelist(
      "inactive.member@cu.edu.eg",
      activeMemberships
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/inactive/i);
  });

  it("denies access to archived-season non-master accounts while exempting master_admin", () => {
    const oldMember = checkRosterWhitelist(
      "alumni.omar@cu.edu.eg",
      activeMemberships
    );
    expect(oldMember.allowed).toBe(false);

    const archivedMaster = checkRosterWhitelist(
      "master.archived@cu.edu.eg",
      activeMemberships
    );
    expect(archivedMaster.allowed).toBe(true);
    expect(archivedMaster.membership?.role).toBe("master_admin");
  });

  it("denies access to emails not present on any roster", () => {
    const result = checkRosterWhitelist(
      "random.stranger@gmail.com",
      activeMemberships
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found on the roster/i);
  });

  it("identifies operational roles that have management capabilities", () => {
    expect(isOperationalRole("master_admin")).toBe(true);
    expect(isOperationalRole("director")).toBe(true);
    expect(isOperationalRole("hr_admin")).toBe(true);
    expect(isOperationalRole("committee_head")).toBe(true);
    expect(isOperationalRole("hr_member")).toBe(true);
    expect(isOperationalRole("member")).toBe(false);
    expect(isOperationalRole("attendee")).toBe(false);
    expect(isOperationalRole(undefined)).toBe(false);
  });
});
