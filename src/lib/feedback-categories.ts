export type FeedbackCategory =
  | "recognition"
  | "excused_absence"
  | "warning"
  | "other"
  | "internal_note";

export interface FeedbackCategoryMeta {
  category: FeedbackCategory;
  label: string;
  visibility: "member" | "hidden";
  requiresWarningAuthority: boolean;
  visibilitySummary: string;
}

export const FEEDBACK_CATEGORY_ORDER: readonly FeedbackCategory[] = [
  "recognition",
  "excused_absence",
  "other",
  "warning",
  "internal_note",
] as const;

export const FEEDBACK_CATEGORY_META: Record<
  FeedbackCategory,
  FeedbackCategoryMeta
> = {
  recognition: {
    category: "recognition",
    label: "Public Recognition",
    visibility: "member",
    requiresWarningAuthority: false,
    visibilitySummary: "Sent to member · visible in their portal",
  },
  excused_absence: {
    category: "excused_absence",
    label: "Excused Absence",
    visibility: "member",
    requiresWarningAuthority: false,
    visibilitySummary: "Sent to member · visible in their portal",
  },
  other: {
    category: "other",
    label: "General Note",
    visibility: "member",
    requiresWarningAuthority: false,
    visibilitySummary: "Sent to member · visible in their portal",
  },
  warning: {
    category: "warning",
    label: "Official Warning",
    visibility: "member",
    requiresWarningAuthority: true,
    visibilitySummary: "Sent to warned member · visible in their portal",
  },
  internal_note: {
    category: "internal_note",
    label: "Hidden HR Note",
    visibility: "hidden",
    requiresWarningAuthority: true,
    visibilitySummary:
      "Hidden · visible only to Master Admin, Track Director & HR (never visible to the member, attendees, or committee heads)",
  },
};

export function inferFeedbackCategory(item: {
  category?: string | null;
  isPublished: boolean;
  isWarning: boolean;
}): FeedbackCategory {
  if (item.category && item.category in FEEDBACK_CATEGORY_META) {
    return item.category as FeedbackCategory;
  }
  if (!item.isPublished) return "internal_note";
  if (item.isWarning) return "warning";
  return "recognition";
}
