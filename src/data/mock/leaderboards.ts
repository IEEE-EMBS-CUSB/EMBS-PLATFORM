import type { LeaderboardEntry, LeaderboardStatus, MonthKey } from "@/types";
import { getCommitteeOrThrow } from "./committees";

export interface MockLeaderboardEntry extends LeaderboardEntry {
  previousCommitteeRank: number | null;
}

export interface MockMonthlyLeaderboardSnapshot {
  month: MonthKey;
  monthLabel: string;
  status: LeaderboardStatus;
  publishedAt: string;
  entries: MockLeaderboardEntry[];
}

interface RawRankingSeed {
  memberId: string;
  memberName: string;
  committeeSlug: string;
  role: string;
  monthlyScore: number;
  previousRank: number | null;
  previousCommitteeRank?: number | null;
}

function buildRankedEntries(seeds: RawRankingSeed[]): MockLeaderboardEntry[] {
  const sorted = [...seeds].sort((a, b) => b.monthlyScore - a.monthlyScore);
  const committeeRankCounters = new Map<string, number>();

  return sorted.map((seed, index) => {
    const committee = getCommitteeOrThrow(seed.committeeSlug);
    const committeeRank = (committeeRankCounters.get(committee.slug) ?? 0) + 1;
    committeeRankCounters.set(committee.slug, committeeRank);

    // Default committee-local previous rank derived cleanly when not explicitly seeded
    const defaultPrevCommitteeRank =
      seed.previousRank === null
        ? null
        : committeeRank === 1
          ? 2
          : committeeRank === 2
            ? 1
            : committeeRank;

    return {
      rank: index + 1,
      previousRank: seed.previousRank,
      previousCommitteeRank:
        seed.previousCommitteeRank !== undefined
          ? seed.previousCommitteeRank
          : defaultPrevCommitteeRank,
      memberId: seed.memberId,
      memberName: seed.memberName,
      committeeSlug: committee.slug,
      committeeName: committee.name,
      role: seed.role,
      monthlyScore: seed.monthlyScore,
    };
  });
}

export const MOCK_LEADERBOARD_SNAPSHOTS: readonly MockMonthlyLeaderboardSnapshot[] =
  [
    // Unpublished draft month — must NEVER be exposed by public leaderboard services
    {
      month: "2026-11",
      monthLabel: "November 2026",
      status: "draft",
      publishedAt: "",
      entries: buildRankedEntries([
        {
          memberId: "mem-101",
          memberName: "Salma El-Sayed",
          committeeSlug: "ai-and-machine-learning",
          role: "Head",
          monthlyScore: 41,
          previousRank: 1,
        },
      ]),
    },
    {
      month: "2026-10",
      monthLabel: "October 2026",
      status: "published",
      publishedAt: "2026-11-02",
      entries: buildRankedEntries([
        {
          memberId: "mem-101",
          memberName: "Salma El-Sayed",
          committeeSlug: "ai-and-machine-learning",
          role: "Head",
          monthlyScore: 94,
          previousRank: 3,
        },
        {
          memberId: "mem-103",
          memberName: "Nourhan Khaled",
          committeeSlug: "graphic-design",
          role: "Vice",
          monthlyScore: 91,
          previousRank: 2,
        },
        {
          memberId: "mem-102",
          memberName: "Omar Tarek",
          committeeSlug: "robotics-and-automation",
          role: "Member",
          monthlyScore: 89,
          previousRank: 4,
        },
        {
          memberId: "mem-104",
          memberName: "Ziad Hany",
          committeeSlug: "web-development",
          role: "Senior Member",
          monthlyScore: 88,
          previousRank: 1,
        },
        {
          memberId: "mem-105",
          memberName: "Hana Wael",
          committeeSlug: "medical-equipment-and-planning",
          role: "Senior Member",
          monthlyScore: 87,
          previousRank: 5,
        },
        {
          memberId: "mem-106",
          memberName: "Mostafa Adel",
          committeeSlug: "r-and-d",
          role: "Research Member",
          monthlyScore: 85,
          previousRank: 7,
        },
        {
          memberId: "mem-107",
          memberName: "Farah Sherif",
          committeeSlug: "marketing-and-content-creation",
          role: "Senior Member",
          monthlyScore: 84,
          previousRank: 6,
        },
        {
          memberId: "mem-108",
          memberName: "Yassin Magdy",
          committeeSlug: "game-development",
          role: "Member",
          monthlyScore: 83,
          previousRank: 9,
        },
        {
          memberId: "mem-109",
          memberName: "Dina Ashraf",
          committeeSlug: "organizing-and-logistics",
          role: "Coordinator",
          monthlyScore: 82,
          previousRank: 8,
        },
        {
          memberId: "mem-110",
          memberName: "Ahmed Samy",
          committeeSlug: "public-relations-and-fund-raising",
          role: "Partnerships Member",
          monthlyScore: 81,
          previousRank: 10,
        },
        {
          memberId: "mem-111",
          memberName: "Laila Amr",
          committeeSlug: "human-resources",
          role: "HR Specialist",
          monthlyScore: 80,
          previousRank: 11,
        },
        {
          memberId: "mem-112",
          memberName: "Seif El-Din Ramy",
          committeeSlug: "photography-videography-editing",
          role: "Lead Videographer",
          monthlyScore: 79,
          previousRank: 12,
        },
        {
          memberId: "mem-113",
          memberName: "Karim Nabil",
          committeeSlug: "ai-and-machine-learning",
          role: "Member",
          monthlyScore: 78,
          previousRank: 14,
        },
        {
          memberId: "mem-114",
          memberName: "Rana Hossam",
          committeeSlug: "web-development",
          role: "Member",
          monthlyScore: 77,
          previousRank: 13,
        },
        {
          memberId: "mem-115",
          memberName: "Tarek Bassem",
          committeeSlug: "robotics-and-automation",
          role: "Member",
          monthlyScore: 76,
          previousRank: 16,
        },
        {
          memberId: "mem-116",
          memberName: "Malak Ayman",
          committeeSlug: "medical-equipment-and-planning",
          role: "Member",
          monthlyScore: 75,
          previousRank: 15,
        },
        {
          memberId: "mem-117",
          memberName: "Abdelrahman Fathy",
          committeeSlug: "r-and-d",
          role: "Member",
          monthlyScore: 74,
          previousRank: 17,
        },
        {
          memberId: "mem-118",
          memberName: "Jana Walid",
          committeeSlug: "game-development",
          role: "Member",
          monthlyScore: 73,
          previousRank: 19,
        },
        {
          memberId: "mem-119",
          memberName: "Habiba Mohamed",
          committeeSlug: "marketing-and-content-creation",
          role: "Copywriter",
          monthlyScore: 72,
          previousRank: 18,
        },
        {
          memberId: "mem-120",
          memberName: "Eslam Gehad",
          committeeSlug: "graphic-design",
          role: "Member",
          monthlyScore: 71,
          previousRank: 20,
        },
        {
          memberId: "mem-121",
          memberName: "Menna Tarek",
          committeeSlug: "photography-videography-editing",
          role: "Editor",
          monthlyScore: 70,
          previousRank: 21,
        },
        {
          memberId: "mem-122",
          memberName: "Kareem Essam",
          committeeSlug: "human-resources",
          role: "Member",
          monthlyScore: 69,
          previousRank: 22,
        },
        {
          memberId: "mem-123",
          memberName: "Yara Ehab",
          committeeSlug: "public-relations-and-fund-raising",
          role: "Member",
          monthlyScore: 68,
          previousRank: 23,
        },
        {
          memberId: "mem-124",
          memberName: "Marwan Hazem",
          committeeSlug: "organizing-and-logistics",
          role: "Member",
          monthlyScore: 67,
          previousRank: 24,
        },
        // Third ranked members per committee so every committee has a full Top 3
        {
          memberId: "mem-125",
          memberName: "Nada Hesham",
          committeeSlug: "ai-and-machine-learning",
          role: "Member",
          monthlyScore: 75,
          previousRank: 25,
        },
        {
          memberId: "mem-126",
          memberName: "Adham Waleed",
          committeeSlug: "web-development",
          role: "Member",
          monthlyScore: 74,
          previousRank: 26,
        },
        {
          memberId: "mem-127",
          memberName: "Basma Osama",
          committeeSlug: "robotics-and-automation",
          role: "Member",
          monthlyScore: 72,
          previousRank: 27,
        },
        {
          memberId: "mem-128",
          memberName: "Hazem Ashraf",
          committeeSlug: "medical-equipment-and-planning",
          role: "Member",
          monthlyScore: 71,
          previousRank: 28,
        },
        {
          memberId: "mem-129",
          memberName: "Reem El-Gamal",
          committeeSlug: "r-and-d",
          role: "Member",
          monthlyScore: 70,
          previousRank: 29,
        },
        {
          memberId: "mem-130",
          memberName: "Moaz Ehab",
          committeeSlug: "game-development",
          role: "Member",
          monthlyScore: 69,
          previousRank: 30,
        },
        {
          memberId: "mem-131",
          memberName: "Toqa Alaa",
          committeeSlug: "marketing-and-content-creation",
          role: "Member",
          monthlyScore: 68,
          previousRank: 31,
        },
        {
          memberId: "mem-132",
          memberName: "Youssef Gamal",
          committeeSlug: "graphic-design",
          role: "Member",
          monthlyScore: 67,
          previousRank: 32,
        },
        {
          memberId: "mem-133",
          memberName: "Sama Hatem",
          committeeSlug: "photography-videography-editing",
          role: "Photographer",
          monthlyScore: 66,
          previousRank: 33,
        },
        {
          memberId: "mem-134",
          memberName: "Nour El-Hoda",
          committeeSlug: "human-resources",
          role: "Member",
          monthlyScore: 65,
          previousRank: 34,
        },
        {
          memberId: "mem-135",
          memberName: "Zeyad Medhat",
          committeeSlug: "public-relations-and-fund-raising",
          role: "Member",
          monthlyScore: 64,
          previousRank: 35,
        },
        {
          memberId: "mem-136",
          memberName: "Amina Khaled",
          committeeSlug: "organizing-and-logistics",
          role: "Member",
          monthlyScore: 63,
          previousRank: 36,
        },
      ]),
    },
    {
      month: "2026-09",
      monthLabel: "September 2026",
      status: "published",
      publishedAt: "2026-10-03",
      entries: buildRankedEntries([
        {
          memberId: "mem-104",
          memberName: "Ziad Hany",
          committeeSlug: "web-development",
          role: "Senior Member",
          monthlyScore: 92,
          previousRank: 2,
        },
        {
          memberId: "mem-103",
          memberName: "Nourhan Khaled",
          committeeSlug: "graphic-design",
          role: "Vice",
          monthlyScore: 88,
          previousRank: 3,
        },
        {
          memberId: "mem-101",
          memberName: "Salma El-Sayed",
          committeeSlug: "ai-and-machine-learning",
          role: "Head",
          monthlyScore: 86,
          previousRank: 5,
        },
        {
          memberId: "mem-102",
          memberName: "Omar Tarek",
          committeeSlug: "robotics-and-automation",
          role: "Member",
          monthlyScore: 84,
          previousRank: 6,
        },
        {
          memberId: "mem-105",
          memberName: "Hana Wael",
          committeeSlug: "medical-equipment-and-planning",
          role: "Senior Member",
          monthlyScore: 82,
          previousRank: 1,
        },
        {
          memberId: "mem-107",
          memberName: "Farah Sherif",
          committeeSlug: "marketing-and-content-creation",
          role: "Senior Member",
          monthlyScore: 80,
          previousRank: 4,
        },
        {
          memberId: "mem-106",
          memberName: "Mostafa Adel",
          committeeSlug: "r-and-d",
          role: "Research Member",
          monthlyScore: 79,
          previousRank: 7,
        },
        {
          memberId: "mem-109",
          memberName: "Dina Ashraf",
          committeeSlug: "organizing-and-logistics",
          role: "Coordinator",
          monthlyScore: 77,
          previousRank: 8,
        },
        {
          memberId: "mem-108",
          memberName: "Yassin Magdy",
          committeeSlug: "game-development",
          role: "Member",
          monthlyScore: 76,
          previousRank: 10,
        },
        {
          memberId: "mem-110",
          memberName: "Ahmed Samy",
          committeeSlug: "public-relations-and-fund-raising",
          role: "Partnerships Member",
          monthlyScore: 74,
          previousRank: 9,
        },
        {
          memberId: "mem-111",
          memberName: "Laila Amr",
          committeeSlug: "human-resources",
          role: "HR Specialist",
          monthlyScore: 73,
          previousRank: 11,
        },
        {
          memberId: "mem-112",
          memberName: "Seif El-Din Ramy",
          committeeSlug: "photography-videography-editing",
          role: "Lead Videographer",
          monthlyScore: 72,
          previousRank: 12,
        },
      ]),
    },
    {
      month: "2026-08",
      monthLabel: "August 2026",
      status: "published",
      publishedAt: "2026-09-02",
      entries: buildRankedEntries([
        {
          memberId: "mem-105",
          memberName: "Hana Wael",
          committeeSlug: "medical-equipment-and-planning",
          role: "Senior Member",
          monthlyScore: 89,
          previousRank: 3,
        },
        {
          memberId: "mem-104",
          memberName: "Ziad Hany",
          committeeSlug: "web-development",
          role: "Senior Member",
          monthlyScore: 86,
          previousRank: 1,
        },
        {
          memberId: "mem-103",
          memberName: "Nourhan Khaled",
          committeeSlug: "graphic-design",
          role: "Vice",
          monthlyScore: 84,
          previousRank: 4,
        },
        {
          memberId: "mem-107",
          memberName: "Farah Sherif",
          committeeSlug: "marketing-and-content-creation",
          role: "Senior Member",
          monthlyScore: 81,
          previousRank: 2,
        },
        {
          memberId: "mem-101",
          memberName: "Salma El-Sayed",
          committeeSlug: "ai-and-machine-learning",
          role: "Head",
          monthlyScore: 79,
          previousRank: 7,
        },
        {
          memberId: "mem-102",
          memberName: "Omar Tarek",
          committeeSlug: "robotics-and-automation",
          role: "Member",
          monthlyScore: 77,
          previousRank: 6,
        },
        {
          memberId: "mem-106",
          memberName: "Mostafa Adel",
          committeeSlug: "r-and-d",
          role: "Research Member",
          monthlyScore: 75,
          previousRank: 9,
        },
        {
          memberId: "mem-109",
          memberName: "Dina Ashraf",
          committeeSlug: "organizing-and-logistics",
          role: "Coordinator",
          monthlyScore: 74,
          previousRank: 5,
        },
        {
          memberId: "mem-110",
          memberName: "Ahmed Samy",
          committeeSlug: "public-relations-and-fund-raising",
          role: "Partnerships Member",
          monthlyScore: 72,
          previousRank: 10,
        },
        {
          memberId: "mem-108",
          memberName: "Yassin Magdy",
          committeeSlug: "game-development",
          role: "Member",
          monthlyScore: 71,
          previousRank: null,
        },
        {
          memberId: "mem-111",
          memberName: "Laila Amr",
          committeeSlug: "human-resources",
          role: "HR Specialist",
          monthlyScore: 70,
          previousRank: 8,
        },
        {
          memberId: "mem-112",
          memberName: "Seif El-Din Ramy",
          committeeSlug: "photography-videography-editing",
          role: "Lead Videographer",
          monthlyScore: 68,
          previousRank: 11,
        },
      ]),
    },
  ] as const;
