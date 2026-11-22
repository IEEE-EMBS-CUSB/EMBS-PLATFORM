import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCheckToggle } from "@/components/member/task-check-toggle";
import { MemberDeliverablesView } from "@/components/member/deliverables-view";
import type { MemberTask } from "@/types";

const mockToggleTaskCompletion = vi.fn();
const mockSubmitTask = vi.fn();

vi.mock("@/app/hr/tasks/actions", () => ({
  toggleTaskCompletionAction: (...args: unknown[]) =>
    mockToggleTaskCompletion(...args),
  submitTaskAction: (...args: unknown[]) => mockSubmitTask(...args),
}));

describe("TaskCheckToggle and MemberDeliverablesView work-type split", () => {
  beforeEach(() => {
    mockToggleTaskCompletion.mockReset();
    mockSubmitTask.mockReset();
  });

  it("self-checks a task to award points and unchecks on second click", async () => {
    const user = userEvent.setup();
    mockToggleTaskCompletion
      .mockResolvedValueOnce({ ok: true, completed: true, totalPoints: 20 })
      .mockResolvedValueOnce({ ok: true, completed: false, totalPoints: 0 });

    render(
      <TaskCheckToggle
        taskId="task-1"
        title="Submit biweekly check-in form"
        maxPoints={20}
        initialCompleted={false}
      />
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /mark "submit biweekly check-in form" completed/i,
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    await waitFor(() => {
      expect(mockToggleTaskCompletion).toHaveBeenCalledWith({
        taskId: "task-1",
        completed: true,
      });
    });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    await waitFor(() => {
      expect(mockToggleTaskCompletion).toHaveBeenCalledWith({
        taskId: "task-1",
        completed: false,
      });
    });
    expect(checkbox).not.toBeChecked();
  });

  it("reverts checkbox and shows alert when server action fails", async () => {
    const user = userEvent.setup();
    mockToggleTaskCompletion.mockResolvedValueOnce({
      ok: false,
      error: "This month is already published and locked.",
    });

    render(
      <TaskCheckToggle
        taskId="task-locked"
        title="Locked task"
        maxPoints={15}
        initialCompleted={false}
      />
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /mark "locked task" completed/i,
    });
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/published and locked/i);
    });
    expect(checkbox).not.toBeChecked();
  });

  it("renders checkboxes (not link submit forms) for tasks and link submission for assignments", () => {
    const hrTask: MemberTask = {
      id: "task-10",
      month: "2026-11",
      title: "Update member bio",
      workType: "task",
      assignedDate: "2026-11-01",
      dueDate: "2026-11-25",
      status: "not_started",
      effort: 1,
      quality: null,
      onTime: null,
      taskPoints: null,
      maxPoints: 15,
    };

    const { rerender } = render(
      <MemberDeliverablesView
        title="Tasks"
        subtitle="Operational tasks"
        itemLabel="Task"
        pointsColumnLabel="Task points"
        emptyIcon={null}
        emptyTitle="None"
        emptyDescription="None"
        items={[hrTask]}
      />
    );

    expect(
      screen.getAllByRole("checkbox", {
        name: /mark "update member bio" completed/i,
      }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/submission url/i)).not.toBeInTheDocument();

    const assignment: MemberTask = {
      id: "assign-10",
      month: "2026-11",
      title: "Design ECG Filter PCB",
      workType: "assignment",
      assignedDate: "2026-11-01",
      dueDate: "2026-11-28",
      submittedDate: "2026-11-22",
      status: "in_progress",
      effort: null,
      quality: null,
      onTime: null,
      taskPoints: null,
      maxPoints: 100,
      submissionUrl: "https://github.com/ieee-embs/ecg-pcb",
    };

    rerender(
      <MemberDeliverablesView
        title="Assignments"
        subtitle="Technical assignments"
        itemLabel="Assignment"
        pointsColumnLabel="Points"
        emptyIcon={null}
        emptyTitle="None"
        emptyDescription="None"
        items={[assignment]}
      />
    );

    expect(screen.getAllByLabelText(/submission url/i).length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: /submitted link/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://github.com/ieee-embs/ecg-pcb"
    );
    // Ungraded submitted assignment must NOT show bogus "Effort 1/5" or "Completed ..."
    expect(screen.queryByText(/effort 1\/5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/completed nov 22/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/pending grade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/submitted nov 22/i).length).toBeGreaterThan(0);
  });

  it("hides self-check toggle for hr_only tasks and shows HR verification status instead", () => {
    const pendingHrOnlyTask: MemberTask = {
      id: "task-hr-only-1",
      month: "2026-11",
      title: "Pass Lab Orientation Inspection",
      workType: "task",
      completionMode: "hr_only",
      assignedDate: "2026-11-01",
      dueDate: "2026-11-28",
      status: "not_started",
      effort: null,
      quality: null,
      onTime: null,
      taskPoints: null,
      maxPoints: 20,
    };

    const doneHrOnlyTask: MemberTask = {
      ...pendingHrOnlyTask,
      id: "task-hr-only-2",
      title: "Return Lab Kit",
      status: "completed",
      taskPoints: 20,
    };

    render(
      <MemberDeliverablesView
        title="Tasks"
        subtitle="Operational tasks"
        itemLabel="Task"
        pointsColumnLabel="Task points"
        emptyIcon={null}
        emptyTitle="None"
        emptyDescription="None"
        items={[pendingHrOnlyTask, doneHrOnlyTask]}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/pending hr verification/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/verified by hr/i).length).toBeGreaterThan(0);
  });
});
