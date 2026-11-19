import type {
  Committee,
  MonthKey,
  MonthlyScoreRecord,
  MemberAttendanceRecord,
  MemberTask,
  MemberActivity,
  SeasonalEvaluation,
  MemberAttendanceSummary,
  MemberTaskSummary,
  AttendeeProfile,
  AttendeeSessionRecord,
  AttendeeAssignment,
  AttendeeParticipationSummary,
} from "@/types";

export interface StoredFeedbackItem {
  id: string;
  membershipId: string;
  month: MonthKey;
  publishedAt: string;
  authorRole: string;
  reviewType:
    | "recognition"
    | "performance_review"
    | "score_correction"
    | "excused_absence"
    | "warning"
    | "appeal"
    | "other";
  message: string;
  decision?: string;
  isPublished: boolean;
  isWarning: boolean;
}

export interface MemberRecordData {
  id: string;
  displayId: string;
  fullName: string;
  email: string;
  committeeId: string;
  role: "Member" | "Vice" | "Head" | "Chairwoman" | "Treasurer";
  seasonLabel: string;
  monthlyScores: MonthlyScoreRecord[];
  attendance: MemberAttendanceRecord[];
  attendanceSummary: MemberAttendanceSummary;
  tasks: MemberTask[];
  taskSummary: MemberTaskSummary;
  activities: MemberActivity[];
  evaluations: SeasonalEvaluation[];
  feedback: StoredFeedbackItem[];
}

export interface AttendeeRecordData {
  profile: AttendeeProfile;
  participation: AttendeeParticipationSummary;
  sessions: AttendeeSessionRecord[];
  assignments: AttendeeAssignment[];
}

export const CHAPTER_COMMITTEES: readonly Committee[] = [
  {
    id: "com-ai-ml",
    slug: "ai-and-machine-learning",
    name: "AI and Machine Learning",
    shortName: "AI & ML",
    track: "technical",
    description:
      "Biomedical signal analysis, medical imaging models, and applied machine learning workshops.",
  },
  {
    id: "com-web-dev",
    slug: "web-development",
    name: "Web Development",
    shortName: "Web Dev",
    track: "technical",
    description:
      "Full-stack web engineering for chapter platforms, event portals, and healthcare web tools.",
  },
  {
    id: "com-robotics",
    slug: "robotics-and-automation",
    name: "Robotics and Automation",
    shortName: "Robotics",
    track: "technical",
    description:
      "Embedded systems, rehabilitation robotics, mechatronics, and sensor-driven automation.",
  },
  {
    id: "com-med-equip",
    slug: "medical-equipment-and-planning",
    name: "Medical Equipment and Planning",
    shortName: "Med Equip",
    track: "technical",
    description:
      "Clinical engineering, hospital equipment workflows, calibration, and healthcare facility planning.",
  },
  {
    id: "com-rnd",
    slug: "r-and-d",
    name: "R&D",
    shortName: "R&D",
    track: "technical",
    description:
      "Biomedical research tracks, paper reading circles, prototyping, and competition deliverables.",
  },
  {
    id: "com-game-dev",
    slug: "game-development",
    name: "Game Development",
    shortName: "Game Dev",
    track: "technical",
    description:
      "Interactive simulations, rehabilitation gamification, and 3D anatomical experiences.",
  },
  {
    id: "com-marketing",
    slug: "marketing-and-content-creation",
    name: "Marketing and Content Creation",
    shortName: "Marketing",
    track: "non_technical",
    description:
      "Campaign strategy, biomedical editorial copy, social channels, and summit outreach.",
  },
  {
    id: "com-graphic-design",
    slug: "graphic-design",
    name: "Graphic Design",
    shortName: "Graphic Design",
    track: "non_technical",
    description:
      "Visual identity systems, IEEE EMBS brand collateral, print assets, and event graphics.",
  },
  {
    id: "com-media-prod",
    slug: "photography-videography-editing",
    name: "Photography, Videography & Editing",
    shortName: "Media Prod",
    track: "non_technical",
    description:
      "Event coverage, session recording, motion recaps, and documentary storytelling.",
  },
  {
    id: "com-hr",
    slug: "human-resources",
    name: "Human Resources",
    shortName: "HR",
    track: "non_technical",
    description:
      "Member recruitment, tracking operations, seasonal evaluations, and chapter culture.",
  },
  {
    id: "com-pr-fr",
    slug: "public-relations-and-fund-raising",
    name: "Public Relations and Fund Raising",
    shortName: "PR & FR",
    track: "non_technical",
    description:
      "Corporate outreach, sponsorship decks, international grant writing, and partner relations.",
  },
  {
    id: "com-logistics",
    slug: "organizing-and-logistics",
    name: "Organizing and Logistics",
    shortName: "Logistics",
    track: "non_technical",
    description:
      "Venue scouting, stage management, attendee badge flows, and on-ground summit operations.",
  },
];

export function findCommitteeBySlug(slug: string): Committee | undefined {
  return CHAPTER_COMMITTEES.find((committee) => committee.slug === slug);
}

export function getCommitteeOrThrow(slug: string): Committee {
  const committee = findCommitteeBySlug(slug);
  if (!committee) {
    throw new Error(`Unknown committee slug: ${slug}`);
  }
  return committee;
}

export const STORED_MEMBERS: Record<string, MemberRecordData> = {
  "mem-101": {
    id: "mem-101",
    displayId: "M001",
    fullName: "Salma El-Sayed",
    email: "salma.elsayed@cusb.org",
    committeeId: "com-ai-ml",
    role: "Head",
    seasonLabel: "Fall 2026",
    monthlyScores: [
      {
        month: "2026-10",
        monthLabel: "October 2026",
        isPublished: true,
        totalScore: 94,
        overallRank: 1,
        overallTotal: 10,
        committeeRank: 1,
        committeeTotal: 2,
        previousOverallRank: 1,
        components: [
          { key: "attendance", label: "Attendance & Punctuality", points: 20, maxPoints: 20 },
          { key: "tasks", label: "Task Contribution", points: 37, maxPoints: 40 },
          { key: "projects", label: "Chapter Projects", points: 15, maxPoints: 20 },
          { key: "hackathons", label: "Hackathons & Competitions", points: 10, maxPoints: 10 },
          { key: "delivered_sessions", label: "Delivered Workshops", points: 5, maxPoints: 5 },
          { key: "bonuses", label: "HR Recognition & Bonuses", points: 7, maxPoints: 10 },
        ],
      },
      {
        month: "2026-09",
        monthLabel: "September 2026",
        isPublished: true,
        totalScore: 91,
        overallRank: 1,
        overallTotal: 10,
        committeeRank: 1,
        committeeTotal: 2,
        previousOverallRank: 2,
        components: [
          { key: "attendance", label: "Attendance & Punctuality", points: 20, maxPoints: 20 },
          { key: "tasks", label: "Task Contribution", points: 36, maxPoints: 40 },
          { key: "projects", label: "Chapter Projects", points: 15, maxPoints: 20 },
          { key: "hackathons", label: "Hackathons & Competitions", points: 10, maxPoints: 10 },
          { key: "delivered_sessions", label: "Delivered Workshops", points: 5, maxPoints: 5 },
          { key: "bonuses", label: "HR Recognition & Bonuses", points: 5, maxPoints: 10 },
        ],
      },
      {
        month: "2026-08",
        monthLabel: "August 2026",
        isPublished: true,
        totalScore: 88,
        overallRank: 2,
        overallTotal: 10,
        committeeRank: 1,
        committeeTotal: 2,
        previousOverallRank: null,
        components: [
          { key: "attendance", label: "Attendance & Punctuality", points: 18, maxPoints: 20 },
          { key: "tasks", label: "Task Contribution", points: 35, maxPoints: 40 },
          { key: "projects", label: "Chapter Projects", points: 15, maxPoints: 20 },
          { key: "hackathons", label: "Hackathons & Competitions", points: 10, maxPoints: 10 },
          { key: "delivered_sessions", label: "Delivered Workshops", points: 5, maxPoints: 5 },
          { key: "bonuses", label: "HR Recognition & Bonuses", points: 5, maxPoints: 10 },
        ],
      },
    ],
    attendanceSummary: {
      attendedCount: 8,
      totalCount: 8,
      lateCount: 0,
      excusedCount: 0,
      absentCount: 0,
      summaryLabel: "100% attendance across all scheduled sessions",
    },
    attendance: [
      {
        id: "att-101-1",
        month: "2026-10",
        date: "2026-10-24",
        title: "All-Community Chapter Sync",
        sessionType: "all_community_meeting",
        status: "attended",
        arrival: "on_time",
        bonusPoints: 2,
        bonusReason: "Arrived early to co-host check-in",
      },
      {
        id: "att-101-2",
        month: "2026-10",
        date: "2026-10-18",
        title: "AI Track Session 03: PyTorch Transformers",
        sessionType: "committee_meeting",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "att-101-3",
        month: "2026-10",
        date: "2026-10-10",
        title: "AI Track Session 02: CNN Medical Segmentation",
        sessionType: "committee_meeting",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "att-101-4",
        month: "2026-10",
        date: "2026-10-04",
        title: "AI Track Session 01: Setup & NumPy Foundations",
        sessionType: "committee_meeting",
        status: "attended",
        arrival: "on_time",
      },
    ],
    taskSummary: {
      completedCount: 4,
      totalCount: 4,
      summaryLabel: "4 of 4 deliverables submitted and graded",
    },
    tasks: [
      {
        id: "task-101-1",
        month: "2026-10",
        title: "Transformer architecture explainer slides",
        assignedDate: "2026-10-12",
        dueDate: "2026-10-22",
        completedDate: "2026-10-20",
        status: "completed",
        effort: 4,
        quality: 5,
        onTime: true,
        taskPoints: 10,
        notes: "Clear diagrams and well-documented PyTorch attention snippets.",
      },
      {
        id: "task-101-2",
        month: "2026-10",
        title: "Medical image dataset preprocessing pipeline",
        assignedDate: "2026-10-02",
        dueDate: "2026-10-10",
        completedDate: "2026-10-09",
        status: "completed",
        effort: 5,
        quality: 5,
        onTime: true,
        taskPoints: 10,
      },
    ],
    activities: [
      {
        id: "act-101-1",
        month: "2026-10",
        date: "2026-10-18",
        category: "delivered_session",
        title: "Delivered PyTorch Workshop",
        role: "Lead Speaker",
        summary: "Delivered a 2-hour technical hands-on workshop covering attention heads for 45 members.",
        pointsAwarded: 5,
      },
      {
        id: "act-101-2",
        month: "2026-10",
        date: "2026-10-15",
        category: "project",
        title: "Skin Lesion Classifier Deployment",
        role: "ML Architect",
        summary: "Published Dockerized inference API with ONNX runtime.",
        pointsAwarded: 15,
      },
    ],
    evaluations: [
      {
        id: "eval-101-f26",
        seasonLabel: "Fall 2026",
        publishedAt: "2026-10-25T12:00:00Z",
        status: "complete",
        evaluatorRole: "Vice Chair",
        finalScore: 96,
        outOf: 100,
        bonusPoints: 4,
        grade: "Outstanding",
        criteria: [
          { id: "c1", label: "Technical Competence & Execution", earned: 25, max: 25, ratingOutOfFive: 5 },
          { id: "c2", label: "Committee Leadership & Mentorship", earned: 24, max: 25, ratingOutOfFive: 5 },
          { id: "c3", label: "Session Delivery & Knowledge Sharing", earned: 24, max: 25, ratingOutOfFive: 5 },
          { id: "c4", label: "Chapter Initiative & Cross-Team Support", earned: 23, max: 25, ratingOutOfFive: 5 },
        ],
      },
    ],
    feedback: [
      {
        id: "fb-101-1",
        membershipId: "mem-101",
        month: "2026-10",
        publishedAt: "2026-10-26T14:30:00Z",
        authorRole: "Technical Director",
        reviewType: "recognition",
        message: "Outstanding delivery on the PyTorch Transformers session. The practical notebooks set a new chapter standard.",
        decision: "Awarded +2 bonus points to score ledger.",
        isPublished: true,
        isWarning: false,
      },
      {
        id: "fb-101-internal",
        membershipId: "mem-101",
        month: "2026-10",
        publishedAt: "2026-10-20T10:00:00Z",
        authorRole: "HR Lead",
        reviewType: "performance_review",
        message: "Internal HR note: Excellent leadership, candidate for next season Vice Chair.",
        isPublished: false,
        isWarning: false,
      },
    ],
  },
  "mem-102": {
    id: "mem-102",
    displayId: "M002",
    fullName: "Ziad Hany",
    email: "ziad.hany@cusb.org",
    committeeId: "com-web-dev",
    role: "Head",
    seasonLabel: "Fall 2026",
    monthlyScores: [
      {
        month: "2026-10",
        monthLabel: "October 2026",
        isPublished: true,
        totalScore: 88,
        overallRank: 3,
        overallTotal: 10,
        committeeRank: 1,
        committeeTotal: 2,
        previousOverallRank: 4,
        components: [
          { key: "attendance", label: "Attendance & Punctuality", points: 20, maxPoints: 20 },
          { key: "tasks", label: "Task Contribution", points: 34, maxPoints: 40 },
          { key: "projects", label: "Chapter Projects", points: 15, maxPoints: 20 },
          { key: "hackathons", label: "Hackathons & Competitions", points: 9, maxPoints: 10 },
          { key: "delivered_sessions", label: "Delivered Workshops", points: 5, maxPoints: 5 },
          { key: "bonuses", label: "HR Recognition & Bonuses", points: 5, maxPoints: 10 },
        ],
      },
    ],
    attendanceSummary: {
      attendedCount: 7,
      totalCount: 8,
      lateCount: 1,
      excusedCount: 0,
      absentCount: 0,
      summaryLabel: "7 of 8 sessions attended",
    },
    attendance: [
      {
        id: "att-102-1",
        month: "2026-10",
        date: "2026-10-24",
        title: "All-Community Chapter Sync",
        sessionType: "all_community_meeting",
        status: "attended",
        arrival: "on_time",
      },
    ],
    taskSummary: {
      completedCount: 3,
      totalCount: 3,
      summaryLabel: "3 deliverables completed",
    },
    tasks: [],
    activities: [],
    evaluations: [],
    feedback: [],
  },
};

export const STORED_ATTENDEES: Record<string, AttendeeRecordData> = {
  "att-201": {
    profile: {
      id: "att-201",
      displayId: "A001",
      fullName: "Mariam Hesham",
      programTrack: "Biomedical AI Foundations Track",
      cohortLabel: "Fall 2026",
    },
    participation: {
      sessionsAttended: 5,
      totalSessions: 6,
      assignmentsCompleted: 3,
      totalAssignments: 4,
      marksSummaryLabel: "53 / 60",
      participationStanding: "Active Participant",
      nextMilestoneNote:
        "Submit Assignment 4 before November 5 to complete the Foundations track.",
    },
    sessions: [
      {
        id: "ases-201-1",
        date: "2026-10-24",
        sessionTitle: "Evaluating Medical Image Classifiers",
        committeeName: "AI and Machine Learning",
        deliveredBy: "Karim Nabil",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "ases-201-2",
        date: "2026-10-17",
        sessionTitle: "Intro to Biomedical Signal Filtering",
        committeeName: "AI and Machine Learning",
        deliveredBy: "Salma El-Sayed",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "ases-201-3",
        date: "2026-10-10",
        sessionTitle: "Python NumPy & SciPy for Biosignals",
        committeeName: "AI and Machine Learning",
        deliveredBy: "Salma El-Sayed",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "ases-201-4",
        date: "2026-10-03",
        sessionTitle: "Clinical Data Privacy & DICOM Basics",
        committeeName: "Medical Equipment and Planning",
        deliveredBy: "Hana Wael",
        status: "attended",
        arrival: "late",
      },
      {
        id: "ases-201-5",
        date: "2026-09-26",
        sessionTitle: "Understanding ECG Waveforms",
        committeeName: "R&D",
        deliveredBy: "Mostafa Adel",
        status: "attended",
        arrival: "on_time",
      },
      {
        id: "ases-201-6",
        date: "2026-09-19",
        sessionTitle: "Track Orientation & Setup",
        committeeName: "Organizing and Logistics",
        deliveredBy: "Dina Ashraf",
        status: "excused",
      },
    ],
    assignments: [
      {
        id: "aasg-201-1",
        title: "Assignment 3: Notch & Bandpass ECG Filter",
        sessionTitle: "Intro to Biomedical Signal Filtering",
        dueDate: "2026-10-23",
        submittedAt: "2026-10-22",
        status: "graded",
        mark: 19,
        maxMark: 20,
        instructorNote: "Clean baseline wander removal and labeled plots.",
      },
      {
        id: "aasg-201-2",
        title: "Assignment 2: Peak Detection in PPG Data",
        sessionTitle: "Python NumPy & SciPy for Biosignals",
        dueDate: "2026-10-16",
        submittedAt: "2026-10-15",
        status: "graded",
        mark: 17,
        maxMark: 20,
        instructorNote: "Accurate BPM calculation.",
      },
      {
        id: "aasg-201-3",
        title: "Assignment 1: ECG Waveform Annotation Quiz",
        sessionTitle: "Understanding ECG Waveforms",
        dueDate: "2026-10-02",
        submittedAt: "2026-10-01",
        status: "graded",
        mark: 17,
        maxMark: 20,
      },
      {
        id: "aasg-201-4",
        title: "Assignment 4: Confusion Matrix & Sensitivity Lab",
        sessionTitle: "Evaluating Medical Image Classifiers",
        dueDate: "2026-11-05",
        status: "pending",
        mark: null,
        maxMark: 20,
      },
    ],
  },
};
