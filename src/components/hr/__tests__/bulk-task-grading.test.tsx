import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkTaskGradingView } from "@/components/hr/bulk-task-grading-view";

describe("BulkTaskGradingView Component", () => {
  const sampleTask = {
    id: "t-1",
    title: "Design Summit Social Media Campaign",
    committeeName: "Graphic Design",
    maxPoints: 100,
  };

  const sampleSubmissions = [
    {
      membershipId: "m-1",
      memberName: "Nourhan Khaled",
      effortScore: 4,
      qualityScore: 5,
      timelinessScore: 5,
      totalPoints: 95,
      notes: "Exceptional design assets delivered early",
    },
    {
      membershipId: "m-2",
      memberName: "Omar Tarek",
      effortScore: 3,
      qualityScore: 3,
      timelinessScore: 2,
      totalPoints: 65,
      notes: "Submitted 2 days late",
    },
  ];

  it("renders submissions and allows keyboard input navigation across grading cells", async () => {
    const user = userEvent.setup();
    render(
      <BulkTaskGradingView
        task={sampleTask}
        submissions={sampleSubmissions}
      />
    );

    expect(screen.getByText("Nourhan Khaled")).toBeInTheDocument();
    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();

    const effortInputs = screen.getAllByLabelText(/effort/i);
    expect(effortInputs).toHaveLength(2);
    expect(effortInputs[0]).toHaveValue(4);

    await user.clear(effortInputs[0]);
    await user.type(effortInputs[0], "5");
    expect(effortInputs[0]).toHaveValue(5);
  });

  it("calculates total points dynamically using custom season grading weights", async () => {
    const user = userEvent.setup();
    render(
      <BulkTaskGradingView
        task={sampleTask}
        submissions={sampleSubmissions}
        gradingWeights={{
          effortWeight: 12,
          qualityWeight: 4,
          timelinessWeight: 2,
          defaultMaxPoints: 100,
        }}
      />
    );

    const effortInputs = screen.getAllByLabelText(/effort/i);
    await user.clear(effortInputs[0]);
    await user.type(effortInputs[0], "3");

    // Custom weights: 3*12 + 5*4 + 5*2 = 66 pts (default weights would produce 80 pts)
    expect(screen.getByText("66 pts")).toBeInTheDocument();
  });

  it("shows clickable safe submission links for assignments and blocks unsafe javascript: URLs", () => {
    render(
      <BulkTaskGradingView
        task={{ ...sampleTask, workType: "assignment" }}
        submissions={[
          {
            ...sampleSubmissions[0],
            submissionId: "sub-1",
            submissionUrl: "https://github.com/embs/design-campaign",
          },
          {
            ...sampleSubmissions[1],
            submissionId: "sub-2",
            submissionUrl: "javascript:alert(1)",
          },
        ]}
      />
    );

    const link = screen.getByRole("link", { name: /open link/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/embs/design-campaign"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link", { name: /open link/i })).toHaveLength(1);
  });

  it("renders a completion checklist instead of rubric inputs for checkable tasks", async () => {
    const user = userEvent.setup();
    const onToggleTask = vi
      .fn()
      .mockResolvedValue({ ok: true, completed: true, totalPoints: 20 });

    render(
      <BulkTaskGradingView
        task={{
          id: "t-hr-1",
          title: "Complete HR Onboarding Form",
          workType: "task",
          committeeName: "PR",
          maxPoints: 20,
        }}
        submissions={[
          {
            submissionId: "sub-hr-1",
            membershipId: "m-1",
            memberName: "Nourhan Khaled",
            effortScore: null,
            qualityScore: null,
            timelinessScore: null,
            totalPoints: null,
            notes: "",
            completed: false,
          },
        ]}
        onToggleTask={onToggleTask}
      />
    );

    expect(screen.queryByLabelText(/effort/i)).not.toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", {
      name: /mark complete hr onboarding form completed for nourhan khaled/i,
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    await waitFor(() => {
      expect(onToggleTask).toHaveBeenCalledWith({
        submissionId: "sub-hr-1",
        completed: true,
      });
    });
    expect(checkbox).toBeChecked();
  });

  it("displays an HR-Only verification badge on hr_only tasks and syncs submissions when props refresh", () => {
    const { rerender } = render(
      <BulkTaskGradingView
        task={{
          id: "t-hr-only",
          title: "Verify Lab Safety Sign-Off",
          workType: "task",
          completionMode: "hr_only",
          committeeName: "Biomedical",
          maxPoints: 15,
        }}
        submissions={[
          {
            submissionId: "sub-1",
            membershipId: "m-1",
            memberName: "Nourhan Khaled",
            effortScore: null,
            qualityScore: null,
            timelinessScore: null,
            totalPoints: null,
            notes: "",
            completed: false,
          },
        ]}
      />
    );

    expect(screen.getByText("HR-Only")).toBeInTheDocument();

    rerender(
      <BulkTaskGradingView
        task={{
          id: "t-hr-only",
          title: "Verify Lab Safety Sign-Off",
          workType: "task",
          completionMode: "hr_only",
          committeeName: "Biomedical",
          maxPoints: 15,
        }}
        submissions={[
          {
            submissionId: "sub-1",
            membershipId: "m-1",
            memberName: "Nourhan Khaled",
            effortScore: null,
            qualityScore: null,
            timelinessScore: null,
            totalPoints: 15,
            notes: "",
            completed: true,
          },
        ]}
      />
    );

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("15 pts")).toBeInTheDocument();
  });

  it("saves graded rows while skipping unsubmitted blank rows, and rejects partially filled rows", async () => {
    const user = userEvent.setup();
    const onGrade = vi.fn().mockResolvedValue({ ok: true });

    render(
      <BulkTaskGradingView
        task={{ ...sampleTask, workType: "assignment" }}
        submissions={[
          {
            submissionId: "sub-ahmed",
            membershipId: "m-ahmed",
            memberName: "Ahmed AI Member",
            effortScore: null,
            qualityScore: null,
            timelinessScore: null,
            totalPoints: null,
            notes: "",
            submissionUrl: "https://github.com/embs/ecg",
          },
          {
            submissionId: "sub-omar",
            membershipId: "m-omar",
            memberName: "Omar Multi-Role",
            effortScore: null,
            qualityScore: null,
            timelinessScore: null,
            totalPoints: null,
            notes: "",
            submissionUrl: null,
          },
        ]}
        onGrade={onGrade}
      />
    );

    // Partially filling only Effort for Ahmed should show a clear row-specific error
    await user.type(
      screen.getByLabelText(/effort score for ahmed ai member/i),
      "5"
    );
    await user.click(screen.getByRole("button", { name: /save grades/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/ahmed ai member/i);
    expect(onGrade).not.toHaveBeenCalled();

    // Completing all 3 scores for Ahmed (while leaving Omar blank) should save Ahmed cleanly
    await user.type(
      screen.getByLabelText(/quality score for ahmed ai member/i),
      "4"
    );
    await user.type(
      screen.getByLabelText(/timeliness score for ahmed ai member/i),
      "5"
    );
    await user.type(
      screen.getByLabelText(/feedback notes for ahmed ai member/i),
      "Great filter plots!"
    );
    await user.click(screen.getByRole("button", { name: /save grades/i }));

    await waitFor(() => {
      expect(onGrade).toHaveBeenCalledTimes(1);
    });
    expect(onGrade).toHaveBeenCalledWith({
      submissionId: "sub-ahmed",
      effortScore: 5,
      qualityScore: 4,
      timelinessScore: 5,
      notes: "Great filter plots!",
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
