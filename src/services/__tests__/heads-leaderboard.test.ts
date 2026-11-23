import { describe, expect, it } from "vitest";
import {
  extractHeadsEntriesFromSnapshot,
  extractOverallEntriesFromSnapshot,
} from "@/services/leaderboard.service";

describe("extractHeadsEntriesFromSnapshot", () => {
  it("returns frozen headsEntries when present and respects publicTopN", () => {
    const entries = extractHeadsEntriesFromSnapshot(
      {
        monthLabel: "November 2026",
        headsEntries: [
          {
            rank: 1,
            previousRank: 2,
            memberId: "m-salma",
            memberName: "Salma AI Head",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "committee_head",
            monthlyScore: 95,
          },
          {
            rank: 2,
            previousRank: 1,
            memberId: "m-omar",
            memberName: "Omar PR Head",
            committeeSlug: "public-relations",
            committeeName: "Public Relations",
            role: "committee_head",
            monthlyScore: 80,
          },
        ],
      },
      1
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      rank: 1,
      previousRank: 2,
      memberName: "Salma AI Head",
      monthlyScore: 95,
    });
  });

  it("gracefully falls back to filtering overallEntries for pre-P5 snapshots lacking headsEntries", () => {
    const entries = extractHeadsEntriesFromSnapshot(
      {
        monthLabel: "October 2026",
        overallEntries: [
          {
            rank: 1,
            previousRank: null,
            memberId: "m-ahmed",
            memberName: "Ahmed AI Member",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "Member",
            monthlyScore: 108,
          },
          {
            rank: 2,
            previousRank: null,
            memberId: "m-omar",
            memberName: "Omar Multi-Role",
            committeeSlug: "public-relations",
            committeeName: "Public Relations",
            role: "Head",
            monthlyScore: 95,
          },
          {
            rank: 3,
            previousRank: null,
            memberId: "m-salma",
            memberName: "Salma AI Head",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "committee_head",
            monthlyScore: 88,
          },
        ],
      },
      10
    );

    expect(entries.map((e) => [e.rank, e.memberName, e.monthlyScore])).toEqual([
      [1, "Omar Multi-Role", 95],
      [2, "Salma AI Head", 88],
    ]);
  });
});

describe("extractOverallEntriesFromSnapshot", () => {
  it("filters out heads and admin roles from already-published snapshots, keeping member and hr_member only and re-ranking 1..N", () => {
    const entries = extractOverallEntriesFromSnapshot(
      {
        monthLabel: "October 2026",
        overallEntries: [
          {
            rank: 1,
            previousRank: 2,
            memberId: "m-salma",
            memberName: "Salma AI Head",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "committee_head",
            monthlyScore: 110,
          },
          {
            rank: 2,
            previousRank: 1,
            memberId: "m-sara",
            memberName: "Sara HR Admin",
            committeeSlug: "human-resources",
            committeeName: "Human Resources",
            role: "hr_admin",
            monthlyScore: 105,
          },
          {
            rank: 3,
            previousRank: 4,
            memberId: "m-laila",
            memberName: "Laila HR Member",
            committeeSlug: "human-resources",
            committeeName: "Human Resources",
            role: "hr_member",
            monthlyScore: 95,
          },
          {
            rank: 4,
            previousRank: 3,
            memberId: "m-khaled",
            memberName: "Khaled Director",
            committeeSlug: "unassigned",
            committeeName: "Unassigned",
            role: "director",
            monthlyScore: 92,
          },
          {
            rank: 5,
            previousRank: 6,
            memberId: "m-omar",
            memberName: "Omar AI Member",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "member",
            monthlyScore: 88,
          },
          {
            rank: 6,
            previousRank: null,
            memberId: "m-legacy-head",
            memberName: "Legacy Head",
            committeeSlug: "web-development",
            committeeName: "Web Development",
            role: "Head",
            monthlyScore: 85,
          },
        ],
      },
      10
    );

    expect(
      entries.map((e) => [e.rank, e.previousRank, e.memberName, e.role, e.monthlyScore])
    ).toEqual([
      [1, null, "Laila HR Member", "hr_member", 95],
      [2, null, "Omar AI Member", "member", 88],
    ]);
  });

  it("preserves ranks and previousRank when a snapshot already contains only eligible member/hr_member entries and respects topLimit", () => {
    const entries = extractOverallEntriesFromSnapshot(
      {
        monthLabel: "November 2026",
        overallEntries: [
          {
            rank: 1,
            previousRank: 3,
            memberId: "m-laila",
            memberName: "Laila HR Member",
            committeeSlug: "human-resources",
            committeeName: "Human Resources",
            role: "hr_member",
            monthlyScore: 98,
          },
          {
            rank: 2,
            previousRank: 1,
            memberId: "m-omar",
            memberName: "Omar AI Member",
            committeeSlug: "ai-and-machine-learning",
            committeeName: "AI and Machine Learning",
            role: "member",
            monthlyScore: 90,
          },
        ],
      },
      1
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      rank: 1,
      previousRank: 3,
      memberName: "Laila HR Member",
      role: "hr_member",
      monthlyScore: 98,
    });
  });
});
