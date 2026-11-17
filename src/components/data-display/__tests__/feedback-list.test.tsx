import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FeedbackList } from "@/components/data-display/feedback-list";
import type { PublishedFeedback } from "@/types";

const SAMPLE_FEEDBACK: PublishedFeedback[] = [
  {
    id: "fb-1",
    month: "2026-10",
    publishedAt: "2026-10-28",
    authorRole: "HR Lead",
    reviewType: "recognition",
    message: "Led the signal filtering workshop smoothly.",
    decision: "+2 bonus points logged",
    visibility: "published",
  },
];

describe("FeedbackList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders published feedback reviewer role, HR review type, message, and outcome", () => {
    render(<FeedbackList items={SAMPLE_FEEDBACK} />);

    expect(screen.getByText("HR Lead")).toBeInTheDocument();
    expect(
      screen.getByText("Led the signal filtering workshop smoothly.")
    ).toBeInTheDocument();
    expect(screen.getByText(/recognition/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 bonus points logged/i)).toBeInTheDocument();
  });

  it("renders an empty state when no feedback has been published", () => {
    render(<FeedbackList items={[]} />);

    expect(screen.getByText(/no published feedback yet/i)).toBeInTheDocument();
  });
});
