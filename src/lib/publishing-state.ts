export type PublishingMonthPhase = "published" | "due_review" | "in_progress";

export function formatPublishingMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Classifies a leaderboard month into one of three operational states:
 * - "published": permanently frozen snapshot on public leaderboards
 * - "due_review": calendar month has already ended, still draft -> ready for HR review & publish
 * - "in_progress": current (or future) calendar month -> still collecting scores, wait for month end
 */
export function classifyPublishingMonthState(
  monthKey: string,
  status: "draft" | "published",
  currentMonthKey: string
): PublishingMonthPhase {
  if (status === "published") return "published";
  if (monthKey < currentMonthKey) return "due_review";
  return "in_progress";
}

/**
 * Picks the best default month for `/hr/publishing`:
 * prefers the most recent completed past month still awaiting review ("due_review"),
 * otherwise falls back to the latest available month.
 */
export function pickDefaultPublishingMonth(
  months: ReadonlyArray<{ month: string; status: "draft" | "published" }>,
  currentMonthKey: string
): string {
  if (months.length === 0) return currentMonthKey;
  const sorted = [...months].sort((a, b) => b.month.localeCompare(a.month));
  const dueReview = sorted.find(
    (item) =>
      classifyPublishingMonthState(item.month, item.status, currentMonthKey) ===
      "due_review"
  );
  return dueReview ? dueReview.month : sorted[0].month;
}
