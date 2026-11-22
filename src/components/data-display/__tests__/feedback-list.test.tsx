import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackList } from "../feedback-list";
import type { PublishedFeedback } from "@/types";

describe("FeedbackList", () => {
  it("renders member-visible official warnings and attached points bonus/deduction pills", () => {
    const items: PublishedFeedback[] = [
      {
        id: "fb-warn",
        month: "2026-11",
        publishedAt: "2026-11-18",
        authorRole: "HR Officer",
        reviewType: "warning",
        message: "Official warning for missing two committee meetings.",
        pointsDelta: -10,
        visibility: "published",
      },
      {
        id: "fb-rec",
        month: "2026-11",
        publishedAt: "2026-11-15",
        authorRole: "HR Lead",
        reviewType: "recognition",
        message: "Outstanding work mentoring new members.",
        pointsDelta: 15,
        visibility: "published",
      },
      {
        id: "fb-zero",
        month: "2026-11",
        publishedAt: "2026-11-12",
        authorRole: "Committee Head",
        reviewType: "excused_absence",
        message: "Midterm exam excuse logged.",
        pointsDelta: 0,
        visibility: "published",
      },
    ];

    render(<FeedbackList items={items} />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Recognition")).toBeInTheDocument();
    expect(screen.getByText("Excused absence")).toBeInTheDocument();
    expect(screen.getByText("-10 pts")).toBeInTheDocument();
    expect(screen.getByText("+15 pts")).toBeInTheDocument();
    expect(screen.queryByText("0 pts")).not.toBeInTheDocument();
  });
});
