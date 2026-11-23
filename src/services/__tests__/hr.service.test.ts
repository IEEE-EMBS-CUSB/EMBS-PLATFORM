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
  it("aggregates ledger scores, filters overall rankings to members and hr_members, and calculates committee-local trends", () => {
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
        id: "mem-3",
        fullName: "Laila Amr",
        committeeId: "com-hr",
        committeeSlug: "human-resources",
        committeeName: "Human Resources",
        role: "hr_member",
      },
    ];

    const currentMonthLedger = [
      { membershipId: "mem-1", points: 40 },
      { membershipId: "mem-1", points: 54 }, // Total 94 (Head -> excluded from overall)
      { membershipId: "mem-2", points: 80 }, // Total 80 (Member)
      { membershipId: "mem-3", points: 91 }, // Total 91 (HR Member)
    ];

    const previousMonthSnapshot = {
      overall: [
        { memberId: "mem-2", rank: 1 },
        { memberId: "mem-3", rank: 2 },
      ],
      committees: {
        "ai-and-machine-learning": [
          { memberId: "mem-2", rank: 1 },
          { memberId: "mem-1", rank: 2 },
        ],
      },
    };

    const snapshot = calculateDraftMonthlySnapshot({
      month: "2026-10",
      members,
      ledgerEntries: currentMonthLedger,
      previousSnapshot: previousMonthSnapshot,
    });

    // Overall Top 10: excludes Salma (committee_head), keeps Laila (hr_member) and Omar (member)
    expect(snapshot.overallEntries).toHaveLength(2);
    expect(snapshot.overallEntries[0].memberName).toBe("Laila Amr");
    expect(snapshot.overallEntries[0].monthlyScore).toBe(91);
    expect(snapshot.overallEntries[0].rank).toBe(1);
    expect(snapshot.overallEntries[0].previousRank).toBe(2); // Was #2, now #1

    expect(snapshot.overallEntries[1].memberName).toBe("Omar Tarek");
    expect(snapshot.overallEntries[1].monthlyScore).toBe(80);
    expect(snapshot.overallEntries[1].rank).toBe(2);
    expect(snapshot.overallEntries[1].previousRank).toBe(1); // Was #1, now #2

    // Committee leaderboards still include committee heads with committee-local trends
    const aiEntries = snapshot.committeeEntries["ai-and-machine-learning"];
    expect(aiEntries).toBeDefined();
    expect(aiEntries[0].memberName).toBe("Salma El-Sayed");
    expect(aiEntries[0].previousRank).toBe(2); // In previous month AI board, Salma was #2
    expect(aiEntries[1].memberName).toBe("Omar Tarek");
    expect(aiEntries[1].previousRank).toBe(1); // In previous month AI board, Omar was #1

    // Heads board includes Salma
    expect(snapshot.headsEntries).toHaveLength(1);
    expect(snapshot.headsEntries[0].memberName).toBe("Salma El-Sayed");
    expect(snapshot.headsEntries[0].monthlyScore).toBe(94);
  });
});
