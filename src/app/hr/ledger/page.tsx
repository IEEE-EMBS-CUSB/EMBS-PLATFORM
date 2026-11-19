import { HrShell } from "@/components/hr/hr-shell";
import { PointsLedgerView } from "@/components/hr/points-ledger-view";
import { requireOperationalSession } from "@/lib/portal-guards";

const INITIAL_MEMBERS = [
  {
    id: "mem-1",
    fullName: "Salma El-Sayed",
    committeeName: "AI & Machine Learning",
    email: "salma@cusb.org",
  },
  {
    id: "mem-2",
    fullName: "Ziad Hany",
    committeeName: "Web Development",
    email: "ziad@cusb.org",
  },
  {
    id: "mem-3",
    fullName: "Omar Tarek",
    committeeName: "Robotics & Automation",
    email: "omar@cusb.org",
  },
  {
    id: "mem-4",
    fullName: "Nourhan Khaled",
    committeeName: "Graphic Design",
    email: "nourhan@cusb.org",
  },
];

const INITIAL_ENTRIES = [
  {
    id: "led-1",
    membershipId: "mem-1",
    memberName: "Salma El-Sayed",
    memberEmail: "salma@cusb.org",
    committeeName: "AI & Machine Learning",
    month: "2026-10",
    sourceType: "manual_override" as const,
    points: 15,
    reason: "Outstanding support during workshop setup",
    createdByName: "HR Admin",
    createdAt: "2026-10-15T12:00:00Z",
  },
  {
    id: "led-2",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    month: "2026-10",
    sourceType: "attendance" as const,
    points: 15,
    reason: "Attended Web Track Session #1 with punctuality bonus",
    createdByName: "System QR Check-In",
    createdAt: "2026-10-10T18:00:00Z",
  },
  {
    id: "led-3",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    month: "2026-10",
    sourceType: "manual_override" as const,
    points: -5,
    reason: "Late submission without prior notice",
    createdByName: "HR Admin",
    createdAt: "2026-10-20T10:00:00Z",
  },
  {
    id: "led-4",
    membershipId: "mem-4",
    memberName: "Nourhan Khaled",
    memberEmail: "nourhan@cusb.org",
    committeeName: "Graphic Design",
    month: "2026-10",
    sourceType: "task" as const,
    points: 95,
    reason: "Social media visual brand deck submission",
    createdByName: "Design Head",
    createdAt: "2026-10-18T14:30:00Z",
  },
];

export default async function HrLedgerPage() {
  const { profile } = await requireOperationalSession();

  return (
    <HrShell
      activeTab="ledger"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <PointsLedgerView entries={INITIAL_ENTRIES} members={INITIAL_MEMBERS} />
    </HrShell>
  );
}
