import { describe, expect, it } from "vitest";
import { MOCK_LEADERBOARD_SNAPSHOTS } from "@/db/leaderboard-snapshots";
import {
  extractCommitteeEntriesFromSnapshot,
  getCommitteeLeaderboard,
  getCommitteeLeaders,
  getCommittees,
  getLeaderboardHistory,
  getPublishedMonths,
} from "@/services/leaderboard.service";

describe("extractCommitteeEntriesFromSnapshot", () => {
  it("filters out heads and admin roles from already-published committee snapshots, re-ranking 1..N", () => {
    const entries = extractCommitteeEntriesFromSnapshot(
      {
        monthLabel: "October 2026",
        committeeEntries: {
          "ai-and-machine-learning": [
            {
              rank: 1,
              previousRank: 1,
              memberId: "m-salma",
              memberName: "Salma AI Head",
              committeeSlug: "ai-and-machine-learning",
              committeeName: "AI and Machine Learning",
              role: "committee_head",
              monthlyScore: 110,
            },
            {
              rank: 2,
              previousRank: 3,
              memberId: "m-nadia-hr",
              memberName: "Nadia HR Member",
              committeeSlug: "ai-and-machine-learning",
              committeeName: "AI and Machine Learning",
              role: "hr_member",
              monthlyScore: 100,
            },
            {
              rank: 3,
              previousRank: 2,
              memberId: "m-omar",
              memberName: "Omar AI Member",
              committeeSlug: "ai-and-machine-learning",
              committeeName: "AI and Machine Learning",
              role: "member",
              monthlyScore: 88,
            },
          ],
        },
      },
      "ai-and-machine-learning",
      10
    );

    expect(
      entries.map((e) => [e.rank, e.previousRank, e.memberName, e.role, e.monthlyScore])
    ).toEqual([[1, null, "Omar AI Member", "member", 88]]);
  });

  it("keeps hr_member entries on human-resources and preserves ranks when already clean", () => {
    const entries = extractCommitteeEntriesFromSnapshot(
      {
        monthLabel: "November 2026",
        committeeEntries: {
          "human-resources": [
            {
              rank: 1,
              previousRank: 2,
              memberId: "m-laila",
              memberName: "Laila HR Member",
              committeeSlug: "human-resources",
              committeeName: "Human Resources",
              role: "hr_member",
              monthlyScore: 95,
            },
          ],
        },
      },
      "human-resources",
      10
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      rank: 1,
      previousRank: 2,
      memberName: "Laila HR Member",
      role: "hr_member",
      monthlyScore: 95,
    });
  });
});

describe("leaderboard.service", () => {
  it("returns all 12 IEEE EMBS CUSB committees across technical and non-technical tracks", async () => {
    const committees = await getCommittees();

    expect(committees).toHaveLength(12);
    const names = committees.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Marketing and Content Creation",
        "Graphic Design",
        "Photography, Videography & Editing",
        "Human Resources",
        "Public Relations and Fund Raising",
        "Organizing and Logistics",
        "AI and Machine Learning",
        "Web Development",
        "Robotics and Automation",
        "Medical Equipment and Planning",
        "R&D",
        "Game Development",
      ])
    );

    // Every committee carries its season-defined track category (Technical, Creative, Operations, etc.)
    const trackNames = new Set(committees.map((c) => c.trackName));
    expect(trackNames).toEqual(
      expect.objectContaining(new Set(["Technical", "Creative", "Operations"]))
    );
    const graphicDesign = committees.find((c) => c.slug === "graphic-design");
    expect(graphicDesign?.trackName).toBe("Creative");
    const hr = committees.find((c) => c.slug === "human-resources");
    expect(hr?.trackName).toBe("Operations");
  });

  it("excludes unpublished draft months from published months and history", async () => {
    const rawDraftExists = MOCK_LEADERBOARD_SNAPSHOTS.some(
      (s) => s.month === "2026-11" && s.status === "draft"
    );
    expect(rawDraftExists).toBe(true);

    const publishedMonths = await getPublishedMonths();
    expect(publishedMonths.map((m) => m.month)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);

    const history = await getLeaderboardHistory();
    expect(history.map((h) => h.month)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);
  });

  it("caps committee-specific leaderboards at top 10, filters out heads, and excludes member identification numbers", async () => {
    const aiBoard = await getCommitteeLeaderboard(
      "ai-and-machine-learning",
      "2026-10"
    );

    expect(aiBoard).not.toBeNull();
    expect(aiBoard?.scope).toBe("committee");
    expect(aiBoard?.committee?.name).toBe("AI and Machine Learning");
    expect(aiBoard?.entries.length).toBeLessThanOrEqual(10);
    expect(
      aiBoard?.entries.every(
        (entry) =>
          entry.committeeSlug === "ai-and-machine-learning" &&
          entry.role.toLowerCase() === "member"
      )
    ).toBe(true);
    for (const entry of aiBoard?.entries ?? []) {
      expect("displayId" in entry).toBe(false);
    }
  });

  it("returns published #1 leaders for all 12 committees without leaking draft months or member IDs", async () => {
    const leaders = await getCommitteeLeaders();
    expect(leaders).toHaveLength(12);

    for (const item of leaders) {
      if (item.leader) {
        expect("displayId" in item.leader).toBe(false);
      }
    }

    expect(await getCommitteeLeaders("2026-11")).toEqual([]);
  });

  it("returns null for unknown committees or unpublished months on committee leaderboards", async () => {
    expect(
      await getCommitteeLeaderboard("nonexistent-committee", "2026-10")
    ).toBeNull();
    expect(
      await getCommitteeLeaderboard("ai-and-machine-learning", "2026-11")
    ).toBeNull();
  });
});
