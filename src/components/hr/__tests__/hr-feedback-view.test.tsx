import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HrFeedbackView,
  type FeedbackItem,
  type MemberOption,
} from "../hr-feedback-view";

const mockMembers: MemberOption[] = [
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
];

const mockFeedback: FeedbackItem[] = [
  {
    id: "fb-1",
    membershipId: "mem-1",
    memberName: "Salma El-Sayed",
    memberEmail: "salma@cusb.org",
    committeeName: "AI & Machine Learning",
    content: "Consistently delivering high quality machine learning slides and mentoring juniors.",
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
];

describe("HrFeedbackView", () => {
  it("renders feedback list with recognition and private warning badges", () => {
    render(
      <HrFeedbackView feedbackList={mockFeedback} members={mockMembers} />
    );

    expect(
      screen.getByRole("heading", { name: /feedback & warnings/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Ziad Hany")).toBeInTheDocument();
    expect(screen.getByText(/high quality machine learning slides/i)).toBeInTheDocument();
    expect(screen.getByText(/missed two consecutive committee syncs/i)).toBeInTheDocument();

    // Badges
    expect(screen.getAllByText("Public Recognition")).toHaveLength(2);
    expect(screen.getByText("HR Warning (Private)")).toBeInTheDocument();
  });

  it("filters items by tab: all, public recognition, and internal warnings", async () => {
    const user = userEvent.setup();
    render(
      <HrFeedbackView feedbackList={mockFeedback} members={mockMembers} />
    );

    // Filter to Warnings
    const warningsTab = screen.getByRole("button", { name: /warnings only/i });
    await user.click(warningsTab);

    expect(screen.getByText("Ziad Hany")).toBeInTheDocument();
    expect(screen.queryByText("Salma El-Sayed")).not.toBeInTheDocument();

    // Filter to Public Recognition
    const publicTab = screen.getByRole("button", { name: /public recognition/i });
    await user.click(publicTab);

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.queryByText("Ziad Hany")).not.toBeInTheDocument();
  });

  it("opens modal and logs a new private HR warning", async () => {
    const user = userEvent.setup();
    render(
      <HrFeedbackView feedbackList={mockFeedback} members={mockMembers} />
    );

    const addBtn = screen.getByRole("button", { name: /\+ add note \/ warning/i });
    await user.click(addBtn);

    expect(
      screen.getByRole("heading", { name: /log feedback or hr warning/i })
    ).toBeInTheDocument();

    const memberSelect = screen.getByLabelText(/select member/i);
    await user.selectOptions(memberSelect, "mem-1");

    // Select Warning radio
    const warningRadio = screen.getByLabelText(/internal hr warning \(private\)/i);
    await user.click(warningRadio);

    const contentInput = screen.getByLabelText(/feedback content/i);
    await user.type(contentInput, "First formal attendance warning issued via email.");

    const submitBtn = screen.getByRole("button", { name: /save entry/i });
    await user.click(submitBtn);

    expect(
      screen.queryByRole("heading", { name: /log feedback or hr warning/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("First formal attendance warning issued via email.")).toBeInTheDocument();
  });
});
