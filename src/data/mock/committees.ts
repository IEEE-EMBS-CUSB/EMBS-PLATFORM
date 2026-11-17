import type { Committee } from "@/types";

export const MOCK_COMMITTEES: readonly Committee[] = [
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
      "Industry partnerships, speaker coordination, sponsorships, and MedTech institutional relations.",
  },
  {
    id: "com-logistics",
    slug: "organizing-and-logistics",
    name: "Organizing and Logistics",
    shortName: "Logistics",
    track: "non_technical",
    description:
      "Venue operations, workshop scheduling, attendee check-in, and summit execution.",
  },
] as const;

export function findCommitteeBySlug(slug: string): Committee | undefined {
  return MOCK_COMMITTEES.find((committee) => committee.slug === slug);
}

export function getCommitteeOrThrow(slug: string): Committee {
  const committee = findCommitteeBySlug(slug);
  if (!committee) {
    throw new Error(`Unknown mock committee slug: ${slug}`);
  }
  return committee;
}
