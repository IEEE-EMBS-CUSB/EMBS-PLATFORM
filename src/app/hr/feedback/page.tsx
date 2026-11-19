import { HrShell } from "@/components/hr/hr-shell";
import { HrFeedbackView } from "@/components/hr/hr-feedback-view";
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

const INITIAL_FEEDBACK = [
  {
    id: "fb-1",
    membershipId: "mem-1",
    memberName: "Salma El-Sayed",
    memberEmail: "salma@cusb.org",
    committeeName: "AI & Machine Learning",
    content:
      "Consistently delivering high quality machine learning slides and actively mentoring juniors during technical tracks.",
    isPublished: true,
    isWarning: false,
    createdByName: "HR Lead",
    createdAt: "2026-10-14T10:00:00Z",
  },
  {
    id: "fb-2",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    content: "Missed two consecutive committee syncs without prior notification.",
    isPublished: false,
    isWarning: true,
    createdByName: "HR Admin",
    createdAt: "2026-10-18T16:00:00Z",
  },
  {
    id: "fb-3",
    membershipId: "mem-3",
    memberName: "Omar Tarek",
    memberEmail: "omar@cusb.org",
    committeeName: "Robotics & Automation",
    content: "Led the robotics hardware lab workshop with exceptional student satisfaction scores.",
    isPublished: true,
    isWarning: false,
    createdByName: "Technical VP",
    createdAt: "2026-10-22T11:15:00Z",
  },
];

export default async function HrFeedbackPage() {
  const { profile } = await requireOperationalSession();

  return (
    <HrShell
      activeTab="feedback"
      currentUserRole={profile.role}
      userName={profile.fullName}
      userCommitteeName={profile.committeeName}
    >
      <HrFeedbackView
        feedbackList={INITIAL_FEEDBACK}
        members={INITIAL_MEMBERS}
      />
    </HrShell>
  );
}
