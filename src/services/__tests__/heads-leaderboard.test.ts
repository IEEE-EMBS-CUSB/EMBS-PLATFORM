import { describe, expect, it } from "vitest";
import { extractHeadsEntriesFromSnapshot } from "@/services/leaderboard.service";

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
