import { describe, expect, it } from "vitest";
import {
  computeMonthlyBoards,
  isCommitteeBoardEligibleRole,
  isHrMemberEligibleForCommittee,
  type ScoringLedgerRow,
  type ScoringMembershipRef,
} from "@/services/scoring.service";

describe("scoring.service (per-committee board eligibility & counting discipline)", () => {
  it("excludes committee_head, hr_admin, director, master_admin, and attendee from committee boards while keeping member and hr_member", () => {
    expect(isCommitteeBoardEligibleRole("member")).toBe(true);
    expect(isCommitteeBoardEligibleRole("Member")).toBe(true);
    expect(isCommitteeBoardEligibleRole("hr_member")).toBe(true);
    expect(isCommitteeBoardEligibleRole("HR Member")).toBe(true);
    expect(isCommitteeBoardEligibleRole("committee_head")).toBe(false);
    expect(isCommitteeBoardEligibleRole("Head")).toBe(false);
    expect(isCommitteeBoardEligibleRole("hr_admin")).toBe(false);
    expect(isCommitteeBoardEligibleRole("director")).toBe(false);
    expect(isCommitteeBoardEligibleRole("master_admin")).toBe(false);
    expect(isCommitteeBoardEligibleRole("attendee")).toBe(false);

    expect(isHrMemberEligibleForCommittee("hr_member", "human-resources")).toBe(
      true
    );
    expect(
      isHrMemberEligibleForCommittee("hr_member", "ai-and-machine-learning")
    ).toBe(false);
    expect(
      isHrMemberEligibleForCommittee("member", "ai-and-machine-learning")
    ).toBe(true);
  });

  it("keeps per-committee boards isolated and excludes committee_head hats even for multi-hat people", () => {
    const members: ScoringMembershipRef[] = [
      // Multi-hat: PR Head + AI Member
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
      {
        id: "mem-sara-hr-admin",
        personId: "person-sara",
        fullName: "Sara HR Admin",
        role: "hr_admin",
        committeeId: "comm-hr",
        committeeSlug: "human-resources",
        committeeName: "Human Resources",
      },
      {
        id: "mem-khaled-dir",
        personId: "person-khaled",
        fullName: "Khaled Director",
        role: "director",
        committeeId: null,
        committeeSlug: null,
        committeeName: null,
      },
    ];

    const ledger: ScoringLedgerRow[] = [
      // Salma's PR head points (100 pts) -> PR board excludes heads!
      ...Array.from({ length: 10 }, () => ({
        membershipId: "mem-salma-pr",
        personId: "person-salma",
        postingScope: "committee" as const,
        committeeId: "comm-pr",
        points: 10,
      })),
      // Salma's AI member task (10 pts) -> counts on AI board
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
      // Sara HR Admin has 90 pts -> excluded from HR board
      {
        membershipId: "mem-sara-hr-admin",
        personId: "person-sara",
        postingScope: "committee",
        committeeId: "comm-hr",
        points: 90,
      },
    ];

    const boards = computeMonthlyBoards({
      month: "2026-10",
      members,
      ledgerEntries: ledger,
    });

    // No overallEntries or headsEntries on computed boards
    expect("overallEntries" in boards).toBe(false);
    expect("headsEntries" in boards).toBe(false);

    // PR board: Ziad only (Salma is committee_head in PR, so excluded)
    expect(
      boards.committeeEntries["public-relations"].map((e) => [
        e.memberName,
        e.role,
        e.monthlyScore,
      ])
    ).toEqual([["Ziad Hany", "member", 30]]);

    // AI board: Omar tops AI (50), Salma appears via her AI member hat (10, NOT 110!)
    expect(
      boards.committeeEntries["ai-ml"].map((e) => [
        e.memberName,
        e.role,
        e.monthlyScore,
      ])
    ).toEqual([
      ["Omar Tarek", "member", 50],
      ["Salma El-Sayed", "member", 10],
    ]);

    // HR board has no eligible entries (Sara is hr_admin)
    expect(boards.committeeEntries["human-resources"]).toBeUndefined();
  });

  it("counts open/HR points once per eligible committee board for multi-hat members", () => {
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

    expect(
      boards.committeeEntries["ai-ml"].map((e) => [e.memberName, e.monthlyScore])
    ).toEqual([
      ["Bob", 55],
      ["Alice", 40],
    ]);

    expect(
      boards.committeeEntries["public-relations"].map((e) => [
        e.memberName,
        e.monthlyScore,
      ])
    ).toEqual([["Bob", 15]]);
  });

  it("places hr_member ONLY on the human-resources board and NEVER on another committee board", () => {
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
      // Guard: even if an hr_member record somehow pointed to a non-HR committee, it must NEVER appear there
      {
        id: "mem-nadia-hr-misassigned",
        personId: "person-nadia",
        fullName: "Nadia HR",
        role: "hr_member",
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
        membershipId: "mem-nadia-hr-misassigned",
        personId: "person-nadia",
        postingScope: "committee",
        committeeId: "comm-ai",
        points: 99,
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
        e.role,
        e.monthlyScore,
      ])
    ).toEqual([["Laila Amr", "hr_member", 35]]);

    expect(
      boards.committeeEntries["ai-ml"].map((e) => [e.memberName, e.monthlyScore])
    ).toEqual([["Omar Tarek", 30]]);
  });
});
