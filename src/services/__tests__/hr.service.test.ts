import { describe, expect, it } from "vitest";
import {
  calculateDraftMonthlySnapshot,
  generateSessionCheckinCode,
  parseRosterCsv,
} from "@/services/hr.service";

describe("HR Service: CSV Roster Import Parser", () => {
  it("parses valid CSV lines, normalizes emails, and maps roles", () => {
    const csvContent = `full_name,email,committee_slug,role
Master Admin,master@cu.edu.eg,,master_admin
Salma El-Sayed,  Salma.ElSayed@CU.EDU.EG ,ai-and-machine-learning,committee_head
Laila Amr,laila@cu.edu.eg,ai-and-machine-learning,hr_member
Ziad Hany,ZIAD.HANY@cu.edu.eg,web-development,member
Sara Hassan,hr.lead@cu.edu.eg,human-resources,hr_admin
Mariam Yassin,attendee.mariam@gmail.com,,attendee`;

    const result = parseRosterCsv(csvContent);
    expect(result.errors).toHaveLength(0);
    expect(result.validRecords).toHaveLength(6);

    expect(result.validRecords[0]).toEqual({
      fullName: "Master Admin",
      email: "master@cu.edu.eg",
      committeeSlug: null,
      role: "master_admin",
    });

    expect(result.validRecords[2]).toEqual({
      fullName: "Laila Amr",
      email: "laila@cu.edu.eg",
      committeeSlug: "ai-and-machine-learning",
      role: "hr_member",
    });

    expect(result.validRecords[5]).toEqual({
      fullName: "Mariam Yassin",
      email: "attendee.mariam@gmail.com",
      committeeSlug: null,
      role: "attendee",
    });
  });

  it("identifies invalid roles and malformed lines with detailed line errors", () => {
    const csvContent = `full_name,email,committee_slug,role
Valid User,valid@cu.edu.eg,r-and-d,member
Missing Email,,web-development,member
Invalid Role,bad.role@cu.edu.eg,ai-and-machine-learning,president
Incomplete Line Only Name`;

    const result = parseRosterCsv(csvContent);
    expect(result.validRecords).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toMatch(/email/i);
    expect(result.errors[1].line).toBe(4);
    expect(result.errors[1].message).toMatch(/role/i);
  });
});

describe("HR Service: Live QR Checkin Code Generator", () => {
  it("generates a 6-digit numeric code with future expiration", () => {
    const codeData = generateSessionCheckinCode(15); // 15 mins
    expect(codeData.code).toMatch(/^\d{6}$/);
    expect(codeData.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("HR Service: Draft Monthly Snapshot Calculator", () => {
  it("aggregates per-committee ledger scores for members and hr_members only and calculates committee-local trends", () => {
    const members = [
      {
        id: "mem-1",
        fullName: "Salma El-Sayed",
        committeeId: "com-ai",
        committeeSlug: "ai-and-machine-learning",
        committeeName: "AI and Machine Learning",
        role: "committee_head",
      },
      {
        id: "mem-2",
        fullName: "Omar Tarek",
        committeeId: "com-ai",
        committeeSlug: "ai-and-machine-learning",
        committeeName: "AI and Machine Learning",
        role: "member",
      },
      {
        id: "mem-4",
        fullName: "Karim Nabil",
        committeeId: "com-ai",
        committeeSlug: "ai-and-machine-learning",
        committeeName: "AI and Machine Learning",
        role: "member",
      },
      {
        id: "mem-3",
        fullName: "Laila Amr",
        committeeId: "com-hr",
        committeeSlug: "human-resources",
        committeeName: "Human Resources",
        role: "hr_member",
      },
    ];

    const currentMonthLedger = [
      { membershipId: "mem-1", points: 94 }, // Head -> excluded from committee leaderboard
      { membershipId: "mem-2", points: 80 }, // AI Member
      { membershipId: "mem-4", points: 92 }, // AI Member
      { membershipId: "mem-3", points: 91 }, // HR Member
    ];

    const previousMonthSnapshot = {
      committees: {
        "ai-and-machine-learning": [
          { memberId: "mem-2", rank: 1 },
          { memberId: "mem-4", rank: 2 },
        ],
      },
    };

    const snapshot = calculateDraftMonthlySnapshot({
      month: "2026-10",
      members,
      ledgerEntries: currentMonthLedger,
      previousSnapshot: previousMonthSnapshot,
    });

    // No overallEntries or headsEntries
    expect("overallEntries" in snapshot).toBe(false);
    expect("headsEntries" in snapshot).toBe(false);

    // AI committee board excludes Salma (committee_head) and tracks committee-local trends
    const aiEntries = snapshot.committeeEntries["ai-and-machine-learning"];
    expect(aiEntries).toHaveLength(2);
    expect(aiEntries[0].memberName).toBe("Karim Nabil");
    expect(aiEntries[0].rank).toBe(1);
    expect(aiEntries[0].previousRank).toBe(2);
    expect(aiEntries[1].memberName).toBe("Omar Tarek");
    expect(aiEntries[1].rank).toBe(2);
    expect(aiEntries[1].previousRank).toBe(1);

    // HR committee board includes Laila (hr_member)
    const hrEntries = snapshot.committeeEntries["human-resources"];
    expect(hrEntries).toHaveLength(1);
    expect(hrEntries[0].memberName).toBe("Laila Amr");
    expect(hrEntries[0].monthlyScore).toBe(91);
  });
});
