import { HrShell } from "@/components/hr/hr-shell";
import {
  LeaderboardPublisherView,
  type SnapshotDisplayData,
} from "@/components/hr/leaderboard-publisher-view";
import { requireOperationalSession } from "@/lib/portal-guards";

const INITIAL_SNAPSHOT: SnapshotDisplayData = {
  month: "2026-10",
  status: "draft",
  overallEntries: [
    {
      rank: 1,
      previousRank: 3,
      memberId: "mem-1",
      memberName: "Salma El-Sayed",
      committeeSlug: "ai",
      committeeName: "AI & Machine Learning",
      role: "member",
      monthlyScore: 195,
    },
    {
      rank: 2,
      previousRank: 1,
      memberId: "mem-2",
      memberName: "Ziad Hany",
      committeeSlug: "web",
      committeeName: "Web Development",
      role: "member",
      monthlyScore: 180,
    },
    {
      rank: 3,
      previousRank: 4,
      memberId: "mem-3",
      memberName: "Omar Tarek",
      committeeSlug: "robotics",
      committeeName: "Robotics & Automation",
      role: "member",
      monthlyScore: 175,
    },
    {
      rank: 4,
      previousRank: 2,
      memberId: "mem-4",
      memberName: "Nourhan Khaled",
      committeeSlug: "design",
      committeeName: "Graphic Design",
      role: "member",
      monthlyScore: 160,
    },
    {
      rank: 5,
      previousRank: null,
      memberId: "mem-5",
      memberName: "Hana Wael",
      committeeSlug: "mep",
      committeeName: "Medical Equipment & Planning",
      role: "member",
      monthlyScore: 155,
    },
    {
      rank: 6,
      previousRank: 5,
      memberId: "mem-6",
      memberName: "Mostafa Karim",
      committeeSlug: "rnd",
      committeeName: "R&D",
      role: "member",
      monthlyScore: 148,
    },
    {
      rank: 7,
      previousRank: 8,
      memberId: "mem-7",
      memberName: "Farah Ahmed",
      committeeSlug: "gamedev",
      committeeName: "Game Development",
      role: "member",
      monthlyScore: 140,
    },
    {
      rank: 8,
      previousRank: 6,
      memberId: "mem-8",
      memberName: "Kareem Adel",
      committeeSlug: "marketing",
      committeeName: "Marketing & Content",
      role: "member",
      monthlyScore: 135,
    },
    {
      rank: 9,
      previousRank: 10,
      memberId: "mem-9",
      memberName: "Dina Samir",
      committeeSlug: "media",
      committeeName: "Photography & Media",
      role: "member",
      monthlyScore: 130,
    },
    {
      rank: 10,
      previousRank: null,
      memberId: "mem-10",
      memberName: "Aly Mahmoud",
      committeeSlug: "hr",
      committeeName: "Human Resources",
      role: "member",
      monthlyScore: 125,
    },
  ],
  committeeEntries: {
    ai: [
      {
        rank: 1,
        previousRank: 1,
        memberId: "mem-1",
        memberName: "Salma El-Sayed",
        committeeSlug: "ai",
        committeeName: "AI & Machine Learning",
        role: "member",
        monthlyScore: 195,
      },
    ],
    web: [
      {
        rank: 1,
        previousRank: 1,
        memberId: "mem-2",
        memberName: "Ziad Hany",
        committeeSlug: "web",
        committeeName: "Web Development",
        role: "member",
        monthlyScore: 180,
      },
    ],
    design: [
      {
        rank: 1,
        previousRank: 1,
        memberId: "mem-4",
        memberName: "Nourhan Khaled",
        committeeSlug: "design",
        committeeName: "Graphic Design",
        role: "member",
        monthlyScore: 160,
      },
    ],
  },
};

export default async function HrPublishingPage() {
  const { profile } = await requireOperationalSession();

  return (
    <HrShell
      activeTab="publishing"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <LeaderboardPublisherView
        snapshot={INITIAL_SNAPSHOT}
        availableMonths={["2026-10", "2026-09"]}
      />
    </HrShell>
  );
}
