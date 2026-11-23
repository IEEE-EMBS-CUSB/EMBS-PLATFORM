import { describe, expect, it } from "vitest";
import { MOCK_LEADERBOARD_SNAPSHOTS } from "@/db/leaderboard-snapshots";
import {
  getCommitteeLeaderboard,
  getCommitteeLeaders,
  getCommittees,
  getLeaderboardHistory,
  getOverallLeaderboard,
  getPublishedMonths,
} from "@/services/leaderboard.service";

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
  });

  it("excludes unpublished draft months from published months, overall leaderboard, and history", async () => {
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

    const draftResult = await getOverallLeaderboard("2026-11");
    expect(draftResult).toBeNull();

    const history = await getLeaderboardHistory();
    expect(history.map((h) => h.month)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);
    // Heads are filtered out of overall rankings, so topOverall is the highest-ranked Member
    expect(history[0]?.topOverall?.memberName).toBe("Omar Tarek");
  });

  it("caps overall published leaderboards at top 10, filters out heads, and excludes member identification numbers", async () => {
    const latest = await getOverallLeaderboard();
    expect(latest).not.toBeNull();
    expect(latest?.month).toBe("2026-10");
    expect(latest?.status).toBe("published");
    expect(latest?.entries).toHaveLength(10);
    expect(latest?.entries.map((entry) => entry.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(latest?.entries[0]?.memberName).toBe("Omar Tarek");
    expect(
      latest?.entries.every(
        (entry) =>
          entry.role.toLowerCase() === "member" ||
          entry.role.toLowerCase() === "hr_member"
      )
    ).toBe(true);

    for (const entry of latest?.entries ?? []) {
      expect("displayId" in entry).toBe(false);
    }
  });

  it("caps committee-specific leaderboards at top 10 and re-ranks within the committee", async () => {
    const aiBoard = await getCommitteeLeaderboard(
      "ai-and-machine-learning",
      "2026-10"
    );

    expect(aiBoard).not.toBeNull();
    expect(aiBoard?.scope).toBe("committee");
    expect(aiBoard?.committee?.name).toBe("AI and Machine Learning");
    expect(aiBoard?.entries.length).toBeLessThanOrEqual(10);
    expect(aiBoard?.entries).toHaveLength(3);
    expect(
      aiBoard?.entries.every(
        (entry) => entry.committeeSlug === "ai-and-machine-learning"
      )
    ).toBe(true);
    expect(aiBoard?.entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(aiBoard?.entries[0]?.memberName).toBe("Salma El-Sayed");
    for (const entry of aiBoard?.entries ?? []) {
      if (entry.previousRank !== null) {
        expect(entry.previousRank).toBeLessThanOrEqual(3);
      }
    }

    const augustBoard = await getOverallLeaderboard("2026-08");
    expect(augustBoard).not.toBeNull();
    expect(
      (augustBoard?.entries ?? []).every(
        (entry) =>
          entry.role.toLowerCase() === "member" ||
          entry.role.toLowerCase() === "hr_member"
      )
    ).toBe(true);
  });

  it("returns published #1 leaders for all 12 committees without leaking draft months or member IDs", async () => {
    const leaders = await getCommitteeLeaders();
    expect(leaders).toHaveLength(12);

    const aiLeader = leaders.find(
      (item) => item.committee.slug === "ai-and-machine-learning"
    );
    expect(aiLeader?.leader?.memberName).toBe("Salma El-Sayed");
    expect(aiLeader?.leader?.monthlyScore).toBe(94);
    expect(aiLeader?.leader && "displayId" in aiLeader.leader).toBe(false);

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
