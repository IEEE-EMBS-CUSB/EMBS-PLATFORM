import { describe, expect, it } from "vitest";
import {
  computePersonMonthlyScores,
  formatMemberProfileRoleLabel,
  type SeasonLedgerPointRow,
} from "@/services/member.service";

describe("Multi-hat personal score invariance & role labels", () => {
  it("never hides or reattributes score history when switching active hats, and counts each person once overall", () => {
    const ledger: SeasonLedgerPointRow[] = [
      // Salma (person-salma) has TWO hats: mem-salma-pr (PR Head) and mem-salma-ai (AI Member)
      {
        membershipId: "mem-salma-pr",
        personId: "person-salma",
        month: "2026-10",
        sourceType: "task",
        points: 80,
      },
      {
        membershipId: "mem-salma-ai",
        personId: "person-salma",
        month: "2026-10",
        sourceType: "attendance",
        points: 15,
      },
      // Omar (person-omar) has ONE hat in AI with 50 pts
      {
        membershipId: "mem-omar-ai",
        personId: "person-omar",
        month: "2026-10",
        sourceType: "task",
        points: 50,
      },
    ];

    const published = new Set(["2026-10"]);
    const prCommIds = new Set(["mem-salma-pr"]);
    const aiCommIds = new Set(["mem-salma-ai", "mem-omar-ai"]);

    // Viewing under PR Head hat
    const scoresUnderPrHat = computePersonMonthlyScores({
      personId: "person-salma",
      activeCommitteeId: "comm-pr",
      allSeasonLedger: ledger,
      publishedMonths: published,
      activeCommitteeMembershipIds: prCommIds,
    });

    // Viewing under AI Member hat
    const scoresUnderAiHat = computePersonMonthlyScores({
      personId: "person-salma",
      activeCommitteeId: "comm-ai",
      allSeasonLedger: ledger,
      publishedMonths: published,
      activeCommitteeMembershipIds: aiCommIds,
    });

    expect(scoresUnderPrHat).toHaveLength(1);
    expect(scoresUnderAiHat).toHaveLength(1);

    // Total monthly score, component breakdown, and overall rank are IDENTICAL across hats
    expect(scoresUnderPrHat[0].totalScore).toBe(95);
    expect(scoresUnderAiHat[0].totalScore).toBe(95);
    expect(scoresUnderPrHat[0].components).toEqual(scoresUnderAiHat[0].components);

    // Overall ranking counts 2 distinct people (Salma = 95, Omar = 50), NOT 3 memberships
    expect(scoresUnderPrHat[0].overallRank).toBe(1);
    expect(scoresUnderPrHat[0].overallTotal).toBe(2);
    expect(scoresUnderAiHat[0].overallRank).toBe(1);
    expect(scoresUnderAiHat[0].overallTotal).toBe(2);

    // Committee rank reflects each committee cleanly (Salma is #1 in PR, #2 behind Omar in AI)
    expect(scoresUnderPrHat[0].committeeRank).toBe(1);
    expect(scoresUnderPrHat[0].committeeTotal).toBe(1);
    expect(scoresUnderAiHat[0].committeeRank).toBe(2);
    expect(scoresUnderAiHat[0].committeeTotal).toBe(2);
  });

  it("never labels a committee_head or hr_member as 'Member'", () => {
    expect(formatMemberProfileRoleLabel("committee_head")).toBe("Head");
    expect(formatMemberProfileRoleLabel("hr_member")).toBe("HR Member");
    expect(formatMemberProfileRoleLabel("hr_admin")).toBe("HR Admin");
    expect(formatMemberProfileRoleLabel("director")).toBe("Director");
    expect(formatMemberProfileRoleLabel("master_admin")).toBe("Master Admin");
    expect(formatMemberProfileRoleLabel("member")).toBe("Member");
  });
});
