import type { Committee } from "@/types";

export const LEADERBOARD_TOP_LIMIT = 10;

export interface OfficialCommitteeSpec {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  track: "technical" | "non_technical";
  defaultTrackSlug: "technical" | "creative" | "operations";
  description: string;
}

/**
 * Authoritative catalog of the 12 official IEEE EMBS CUSB committees.
 * Used for production season bootstrap and fallback display metadata (short names & descriptions).
 */
export const OFFICIAL_CHAPTER_COMMITTEES: readonly OfficialCommitteeSpec[] = [
  {
    id: "com-ai-ml",
    slug: "ai-and-machine-learning",
    name: "AI and Machine Learning",
    shortName: "AI & ML",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Biomedical signal analysis, medical imaging models, and applied machine learning workshops.",
  },
  {
    id: "com-web-dev",
    slug: "web-development",
    name: "Web Development",
    shortName: "Web Dev",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Full-stack web engineering for chapter platforms, event portals, and healthcare web tools.",
  },
  {
    id: "com-robotics",
    slug: "robotics-and-automation",
    name: "Robotics and Automation",
    shortName: "Robotics",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Embedded systems, rehabilitation robotics, mechatronics, and sensor-driven automation.",
  },
  {
    id: "com-med-equip",
    slug: "medical-equipment-and-planning",
    name: "Medical Equipment and Planning",
    shortName: "Med Equip",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Clinical engineering, hospital equipment workflows, calibration, and healthcare facility planning.",
  },
  {
    id: "com-rnd",
    slug: "r-and-d",
    name: "R&D",
    shortName: "R&D",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Biomedical research tracks, paper reading circles, prototyping, and competition deliverables.",
  },
  {
    id: "com-game-dev",
    slug: "game-development",
    name: "Game Development",
    shortName: "Game Dev",
    track: "technical",
    defaultTrackSlug: "technical",
    description:
      "Interactive simulations, rehabilitation gamification, and 3D anatomical experiences.",
  },
  {
    id: "com-marketing",
    slug: "marketing-and-content-creation",
    name: "Marketing and Content Creation",
    shortName: "Marketing",
    track: "non_technical",
    defaultTrackSlug: "creative",
    description:
      "Campaign strategy, biomedical editorial copy, social channels, and summit outreach.",
  },
  {
    id: "com-graphic-design",
    slug: "graphic-design",
    name: "Graphic Design",
    shortName: "Graphic Design",
    track: "non_technical",
    defaultTrackSlug: "creative",
    description:
      "Visual identity systems, IEEE EMBS brand collateral, print assets, and event graphics.",
  },
  {
    id: "com-media-prod",
    slug: "photography-videography-editing",
    name: "Photography, Videography & Editing",
    shortName: "Media Prod",
    track: "non_technical",
    defaultTrackSlug: "creative",
    description:
      "Event coverage, session recording, motion recaps, and documentary storytelling.",
  },
  {
    id: "com-hr",
    slug: "human-resources",
    name: "Human Resources",
    shortName: "HR",
    track: "non_technical",
    defaultTrackSlug: "operations",
    description:
      "Member recruitment, tracking operations, attendance governance, and chapter culture.",
  },
  {
    id: "com-pr-fr",
    slug: "public-relations-and-fund-raising",
    name: "Public Relations and Fund Raising",
    shortName: "PR & FR",
    track: "non_technical",
    defaultTrackSlug: "operations",
    description:
      "Corporate outreach, sponsorship decks, international grant writing, and partner relations.",
  },
  {
    id: "com-logistics",
    slug: "organizing-and-logistics",
    name: "Organizing and Logistics",
    shortName: "Logistics",
    track: "non_technical",
    defaultTrackSlug: "operations",
    description:
      "Venue scouting, stage management, attendee badge flows, and on-ground summit operations.",
  },
] as const;

export const OFFICIAL_SCORING_RUBRICS = [
  {
    name: "Attendance & Punctuality",
    maxPoints: 20,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 1,
  },
  {
    name: "Task Contribution",
    maxPoints: 25,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 2,
  },
  {
    name: "Workshops",
    maxPoints: 5,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 3,
  },
  {
    name: "Hands-on & Events",
    maxPoints: 20,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 4,
  },
  {
    name: "Communication & Teamwork",
    maxPoints: 10,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 5,
  },
  {
    name: "Initiative & Ownership",
    maxPoints: 10,
    weight: "1.00",
    leadersOnly: false,
    sortOrder: 6,
  },
  {
    name: "Leadership",
    maxPoints: 10,
    weight: "1.00",
    leadersOnly: true,
    sortOrder: 7,
  },
] as const;

const DEFAULT_TRACK_META: Record<
  "technical" | "creative" | "operations",
  { name: string; sortOrder: number }
> = {
  technical: { name: "Technical", sortOrder: 1 },
  creative: { name: "Creative", sortOrder: 2 },
  operations: { name: "Operations", sortOrder: 3 },
};

export interface CommitteeTrackGroup {
  slug: string;
  name: string;
  sortOrder: number;
  committees: Committee[];
}

export function resolveCommitteeTrackMeta(committee: Committee): {
  slug: string;
  name: string;
  sortOrder: number;
} {
  if (committee.trackSlug && committee.trackName) {
    return {
      slug: committee.trackSlug,
      name: committee.trackName,
      sortOrder: committee.trackSortOrder ?? 99,
    };
  }
  const catalogMatch = OFFICIAL_CHAPTER_COMMITTEES.find(
    (c) => c.slug === committee.slug
  );
  if (catalogMatch) {
    const meta = DEFAULT_TRACK_META[catalogMatch.defaultTrackSlug];
    return {
      slug: catalogMatch.defaultTrackSlug,
      name: meta.name,
      sortOrder: meta.sortOrder,
    };
  }
  if (committee.track === "technical") {
    return { slug: "technical", name: "Technical", sortOrder: 1 };
  }
  return { slug: "operations", name: "Operations", sortOrder: 3 };
}

export function groupCommitteesByTrack(
  committees: readonly Committee[]
): CommitteeTrackGroup[] {
  const bySlug = new Map<string, CommitteeTrackGroup>();
  for (const committee of committees) {
    const meta = resolveCommitteeTrackMeta(committee);
    const existing = bySlug.get(meta.slug);
    if (existing) {
      existing.committees.push(committee);
      if (meta.sortOrder < existing.sortOrder) {
        existing.sortOrder = meta.sortOrder;
      }
    } else {
      bySlug.set(meta.slug, {
        slug: meta.slug,
        name: meta.name,
        sortOrder: meta.sortOrder,
        committees: [committee],
      });
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

export function findOfficialCommitteeBySlug(
  slug: string
): Committee | undefined {
  const found = OFFICIAL_CHAPTER_COMMITTEES.find((c) => c.slug === slug);
  if (!found) return undefined;
  const meta = DEFAULT_TRACK_META[found.defaultTrackSlug];
  return {
    id: found.id,
    slug: found.slug,
    name: found.name,
    shortName: found.shortName,
    track: found.track,
    trackSlug: found.defaultTrackSlug,
    trackName: meta.name,
    trackSortOrder: meta.sortOrder,
    description: found.description,
  };
}

export function getOfficialCommitteeOrThrow(slug: string): Committee {
  const committee = findOfficialCommitteeBySlug(slug);
  if (!committee) {
    throw new Error(`Unknown committee slug: ${slug}`);
  }
  return committee;
}
