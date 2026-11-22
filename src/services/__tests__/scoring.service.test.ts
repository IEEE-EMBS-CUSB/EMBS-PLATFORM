import { describe, expect, it } from "vitest";
import {
  computeMonthlyBoards,
  type ScoringLedgerRow,
  type ScoringMembershipRef,
} from "@/services/scoring.service";

describe("scoring.service (Spec §4 board eligibility & counting discipline)", () => {
  it("keeps per-committee boards isolated (10 PR tasks + 1 AI task tops PR, barely registers on AI, sums once globally)", () => {
    const members: ScoringMembershipRef[] = [
      {
        id: "mem-salma-pr",
        personId: "person-salma",
        fullName: "Salma El-Sayed",
        role: "committee_head",
        committeeId: "comm-pr",
        committeeSlug: "public-relations",
        committeeName: "Public Relations",
      },
      {
        id: "mem-salma-ai",
        personId: "person-salma",
        fullName: "Salma El-Sayed",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      {
        id: "mem-omar-ai",
        personId: "person-omar",
        fullName: "Omar Tarek",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      {
        id: "mem-ziad-pr",
        personId: "person-ziad",
        fullName: "Ziad Hany",
        role: "member",
        committeeId: "comm-pr",
        committeeSlug: "public-relations",
        committeeName: "Public Relations",
      },
    ];

    const ledger: ScoringLedgerRow[] = [
      // Salma does 10 PR tasks (10 x 10 = 100 pts) + 1 AI task (10 pts)
      ...Array.from({ length: 10 }, () => ({
        membershipId: "mem-salma-pr",
        personId: "person-salma",
        postingScope: "committee" as const,
        committeeId: "comm-pr",
        points: 10,
      })),
      {
        membershipId: "mem-salma-ai",
        personId: "person-salma",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 10,
      },
      // Omar does 5 AI tasks (50 pts)
      {
        membershipId: "mem-omar-ai",
        personId: "person-omar",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 50,
      },
      // Ziad does 3 PR tasks (30 pts)
      {
        membershipId: "mem-ziad-pr",
        personId: "person-ziad",
        postingScope: "committee",
        committeeId: "comm-pr",
        points: 30,
      },
    ];

    const boards = computeMonthlyBoards({
      month: "2026-10",
      members,
      ledgerEntries: ledger,
    });

    // Global board: Salma appears ONCE with 110 pts (100 PR + 10 AI), Omar 50, Ziad 30
    expect(boards.overallEntries.map((e) => [e.memberName, e.monthlyScore])).toEqual([
      ["Salma El-Sayed", 110],
      ["Omar Tarek", 50],
      ["Ziad Hany", 30],
    ]);

    // PR board: Salma tops PR with 100 pts (NOT 110!)
    expect(
      boards.committeeEntries["public-relations"].map((e) => [
        e.memberName,
        e.monthlyScore,
      ])
    ).toEqual([
      ["Salma El-Sayed", 100],
      ["Ziad Hany", 30],
    ]);

    // AI board: Omar tops AI (50), Salma barely registers (10, NOT 110!)
    expect(
      boards.committeeEntries["ai-ml"].map((e) => [e.memberName, e.monthlyScore])
    ).toEqual([
      ["Omar Tarek", 50],
      ["Salma El-Sayed", 10],
    ]);
  });

  it("counts open/HR points once globally and once per eligible committee board (fairness + multi-hat dedupe)", () => {
    const members: ScoringMembershipRef[] = [
      {
        id: "mem-a-ai",
        personId: "person-a",
        fullName: "Alice",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      {
        id: "mem-b-ai",
        personId: "person-b",
        fullName: "Bob",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      // Bob also has a PR hat to verify open points count ONCE globally and ONCE on each eligible board
      {
        id: "mem-b-pr",
        personId: "person-b",
        fullName: "Bob",
        role: "member",
        committeeId: "comm-pr",
        committeeSlug: "public-relations",
        committeeName: "Public Relations",
      },
    ];

    const ledger: ScoringLedgerRow[] = [
      // Alice and Bob do identical AI assignments (40 pts each)
      {
        membershipId: "mem-a-ai",
        personId: "person-a",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 40,
      },
      {
        membershipId: "mem-b-ai",
        personId: "person-b",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 40,
      },
      // Bob also did an open/global HR task worth 15 pts (stamped to one membership)
      {
        membershipId: "mem-b-ai",
        personId: "person-b",
        postingScope: "open",
        committeeId: null,
        points: 15,
      },
    ];

    const boards = computeMonthlyBoards({
      month: "2026-10",
      members,
      ledgerEntries: ledger,
    });

    // Fairness: Bob beats Alice on AI board (55 > 40)
    expect(
      boards.committeeEntries["ai-ml"].map((e) => [e.memberName, e.monthlyScore])
    ).toEqual([
      ["Bob", 55],
      ["Alice", 40],
    ]);

    // Open points also appear ONCE on Bob's PR board (15 pts)
    expect(
      boards.committeeEntries["public-relations"].map((e) => [
        e.memberName,
        e.monthlyScore,
      ])
    ).toEqual([["Bob", 15]]);

    // Global board counts Bob ONCE with 55 pts (40 + 15, NEVER 55 + 15 = 70!)
    expect(boards.overallEntries.map((e) => [e.memberName, e.monthlyScore])).toEqual([
      ["Bob", 55],
      ["Alice", 40],
    ]);
  });

  it("places hr_member on the Human Resources committee board rather than their tracked committee", () => {
    const members: ScoringMembershipRef[] = [
      {
        id: "mem-laila-hr",
        personId: "person-laila",
        fullName: "Laila Amr",
        role: "hr_member",
        committeeId: "comm-hr",
        committeeSlug: "human-resources",
        committeeName: "Human Resources",
      },
      {
        id: "mem-omar-ai",
        personId: "person-omar",
        fullName: "Omar Tarek",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
    ];

    const ledger: ScoringLedgerRow[] = [
      {
        membershipId: "mem-laila-hr",
        personId: "person-laila",
        postingScope: "committee",
        committeeId: "comm-hr",
        points: 35,
      },
      {
        membershipId: "mem-omar-ai",
        personId: "person-omar",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 30,
      },
    ];

    const boards = computeMonthlyBoards({
      month: "2026-10",
      members,
      ledgerEntries: ledger,
    });

    expect(
      boards.committeeEntries["human-resources"].map((e) => [
        e.memberName,
        e.monthlyScore,
      ])
    ).toEqual([["Laila Amr", 35]]);
    expect(
      boards.committeeEntries["ai-ml"].map((e) => e.memberName)
    ).toEqual(["Omar Tarek"]);
  });

  it("computes heads-only leaderboard strictly from committee_head memberships plus open points without inflating from non-head hats", () => {
    const members: ScoringMembershipRef[] = [
      // Multi-hat: PR Head + AI Member
      {
        id: "mem-omar-pr-head",
        personId: "person-omar",
        fullName: "Omar Multi-Role",
        role: "committee_head",
        committeeId: "comm-pr",
        committeeSlug: "public-relations",
        committeeName: "Public Relations",
      },
      {
        id: "mem-omar-ai-member",
        personId: "person-omar",
        fullName: "Omar Multi-Role",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      // Pure AI Head
      {
        id: "mem-salma-ai-head",
        personId: "person-salma",
        fullName: "Salma AI Head",
        role: "committee_head",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      // Non-head roles must NOT appear on headsEntries
      {
        id: "mem-ahmed-member",
        personId: "person-ahmed",
        fullName: "Ahmed Member",
        role: "member",
        committeeId: "comm-ai",
        committeeSlug: "ai-ml",
        committeeName: "AI & ML",
      },
      {
        id: "mem-sara-hr-admin",
        personId: "person-sara",
        fullName: "Sara HR Admin",
        role: "hr_admin",
        committeeId: "comm-hr",
        committeeSlug: "human-resources",
        committeeName: "Human Resources",
      },
    ];

    const ledger: ScoringLedgerRow[] = [
      // Omar's head-scoped points (Director assignment to PR Head): 60 pts
      {
        membershipId: "mem-omar-pr-head",
        personId: "person-omar",
        postingScope: "committee",
        committeeId: "comm-pr",
        points: 60,
      },
      // Omar's non-head AI member assignment: 90 pts -> counts on Global + AI, MUST NOT count on Heads board!
      {
        membershipId: "mem-omar-ai-member",
        personId: "person-omar",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 90,
      },
      // Omar's open HR task (stamped to his AI member hat): 15 pts -> open counts ONCE on Heads board too
      {
        membershipId: "mem-omar-ai-member",
        personId: "person-omar",
        postingScope: "open",
        committeeId: null,
        points: 15,
      },
      // Salma's head-scoped points: 85 pts
      {
        membershipId: "mem-salma-ai-head",
        personId: "person-salma",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 85,
      },
      // Ahmed (regular member) has 200 pts -> tops Global, excluded from Heads board
      {
        membershipId: "mem-ahmed-member",
        personId: "person-ahmed",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 200,
      },
    ];

    const boards = computeMonthlyBoards({
      month: "2026-11",
      members,
      ledgerEntries: ledger,
      previousSnapshot: {
        heads: [
          { memberId: "mem-omar-pr-head", personId: "person-omar", rank: 1 },
          { memberId: "mem-salma-ai-head", personId: "person-salma", rank: 2 },
        ],
      },
    });

    // Global: Ahmed (200), Omar (60+90+15=165), Salma (85), Sara (0)
    expect(
      boards.overallEntries.map((e) => [e.memberName, e.monthlyScore])
    ).toEqual([
      ["Ahmed Member", 200],
      ["Omar Multi-Role", 165],
      ["Salma AI Head", 85],
      ["Sara HR Admin", 0],
    ]);

    // Heads-only board: Salma (85, moved from #2 -> #1) beats Omar (60 head + 15 open = 75, moved from #1 -> #2)
    expect(
      boards.headsEntries.map((e) => [
        e.rank,
        e.previousRank,
        e.memberName,
        e.monthlyScore,
      ])
    ).toEqual([
      [1, 2, "Salma AI Head", 85],
      [2, 1, "Omar Multi-Role", 75],
    ]);
  });
});
