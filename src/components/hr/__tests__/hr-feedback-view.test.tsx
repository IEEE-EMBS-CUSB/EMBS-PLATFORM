import { describe, it, expect, vi } from "vitest";
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
    category: "recognition",
    pointsDelta: 15,
    content:
      "Consistently delivering high quality machine learning slides and mentoring juniors.",
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
    category: "warning",
    pointsDelta: -10,
    content: "Official warning: missed two consecutive committee syncs.",
    isPublished: true,
    isWarning: true,
    createdByName: "HR Admin",
    createdAt: "2026-10-18T16:00:00Z",
  },
  {
    id: "fb-3",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    category: "internal_note",
    pointsDelta: 0,
    content: "Internal HR follow-up note scheduled for next week.",
    isPublished: false,
    isWarning: true,
    createdByName: "HR Officer",
    createdAt: "2026-10-19T12:00:00Z",
  },
];

describe("HrFeedbackView", () => {
  it("renders feedback items with category badges, visibility clarity, and adjacent points bonus/deduction badges", () => {
    render(
      <HrFeedbackView feedbackList={mockFeedback} members={mockMembers} />
    );

    expect(
      screen.getByRole("heading", { name: /feedback & warnings/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getAllByText("Ziad Hany").length).toBe(2);

    // Adjacent points badges
    expect(screen.getByText("+15 pts")).toBeInTheDocument();
    expect(screen.getByText("-10 pts")).toBeInTheDocument();

    // Clear visibility explanation without SQL/implementation jargon
    expect(
      screen.getByText(/never visible to the member, attendees, or committee heads/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/sql query layer/i)).not.toBeInTheDocument();
  });

  it("filters items by Sent to Member, Official Warnings, and Hidden HR Notes", async () => {
    const user = userEvent.setup();
    render(
      <HrFeedbackView feedbackList={mockFeedback} members={mockMembers} />
    );

    await user.click(screen.getByRole("button", { name: /official warnings/i }));
    expect(
      screen.getByText(/missed two consecutive committee syncs/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/high quality machine learning slides/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/internal hr follow-up note/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hidden hr notes/i }));
    expect(
      screen.getByText(/internal hr follow-up note/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/missed two consecutive committee syncs/i)
    ).not.toBeInTheDocument();
  });

  it("uses searchable MemberCombobox, defaults bonus/deduction to 0, and submits an Official Warning with deduction", async () => {
    const user = userEvent.setup();
    const onAddFeedback = vi
      .fn()
      .mockResolvedValue({ ok: true, id: "fb-new-1" });

    render(
      <HrFeedbackView
        feedbackList={mockFeedback}
        members={mockMembers}
        feedbackCaps={{ maxBonusPoints: 30, maxDeductionPoints: 25 }}
        canAwardPoints={true}
        onAddFeedback={onAddFeedback}
      />
    );

    await user.click(screen.getByRole("button", { name: /add feedback/i }));

    // Searchable combobox instead of plain <select>
    const combo = screen.getByRole("combobox");
    await user.click(combo);
    await user.type(combo, "Salma");
    await user.click(screen.getByRole("option", { name: /salma el-sayed/i }));

    // Default bonus/deduction MUST always start at 0
    const pointsInput = screen.getByLabelText(/bonus \/ deduction/i);
    expect(pointsInput).toHaveValue(0);

    // Choose Official Warning (sent to warned member)
    await user.click(screen.getByRole("radio", { name: /official warning/i }));

    // Enter -15 deduction
    await user.clear(pointsInput);
    await user.type(pointsInput, "-15");

    await user.type(
      screen.getByLabelText(/feedback content/i),
      "Formal warning for repeated unexcused absences."
    );

    await user.click(screen.getByRole("button", { name: /save entry/i }));

    expect(onAddFeedback).toHaveBeenCalledWith({
      membershipId: "mem-1",
      category: "warning",
      content: "Formal warning for repeated unexcused absences.",
      pointsDelta: -15,
    });
    expect(
      screen.getByText("Formal warning for repeated unexcused absences.")
    ).toBeInTheDocument();
    expect(screen.getByText("-15 pts")).toBeInTheDocument();
  });

  it("hides bonus/deduction input for Directors (canAwardPoints=false)", async () => {
    const user = userEvent.setup();
    render(
      <HrFeedbackView
        feedbackList={mockFeedback}
        members={mockMembers}
        canAwardPoints={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /add feedback/i }));
    expect(
      screen.queryByLabelText(/bonus \/ deduction/i)
    ).not.toBeInTheDocument();
  });
});
