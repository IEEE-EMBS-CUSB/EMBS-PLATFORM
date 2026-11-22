import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipboardList } from "lucide-react";
import { MemberDeliverablesView } from "@/components/member/deliverables-view";
import type { MemberTask } from "@/types";

const mockToggle = vi.fn();
const mockSubmit = vi.fn();
vi.mock("@/app/hr/tasks/actions", () => ({
  toggleTaskCompletionAction: (...args: unknown[]) => mockToggle(...args),
  submitTaskAction: (...args: unknown[]) => mockSubmit(...args),
}));

function makeItem(overrides: Partial<MemberTask>): MemberTask {
  return {
    id: "t-1",
    month: "2026-11",
    title: "Item",
    workType: "task",
    completionMode: "self_report",
    assignedDate: "2026-11-01",
    dueDate: "2026-11-30",
    status: "not_started",
    effort: null,
    quality: null,
    onTime: null,
    taskPoints: null,
    maxPoints: 10,
    ...overrides,
  };
}

const baseProps = {
  title: "Work",
  subtitle: "sub",
  itemLabel: "Item",
  pointsColumnLabel: "Points",
  emptyIcon: <ClipboardList />,
  emptyTitle: "Empty",
  emptyDescription: "Nothing",
};

describe("MemberDeliverablesView", () => {
  beforeEach(() => {
    mockToggle.mockReset();
    mockSubmit.mockReset();
  });

  it("renders self-report HR tasks as checkboxes that award points when checked", async () => {
    const user = userEvent.setup();
    mockToggle.mockResolvedValueOnce({ ok: true, completed: true, totalPoints: 10 });

    render(
      <MemberDeliverablesView
        {...baseProps}
        items={[makeItem({ id: "task-1", title: "Update roster sheet" })]}
      />
    );

    expect(screen.queryByLabelText(/submission url/i)).not.toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox", {
      name: /mark "update roster sheet" completed/i,
    });
    expect(boxes[0]).not.toBeChecked();

    await user.click(boxes[0]);

    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith({
        taskId: "task-1",
        completed: true,
      })
    );
    await waitFor(() => expect(boxes[0]).toBeChecked());
  });

  it("renders HR-only tasks without self-check controls", () => {
    render(
      <MemberDeliverablesView
        {...baseProps}
        items={[
          makeItem({
            id: "task-hr-only",
            title: "Book venue",
            completionMode: "hr_only",
            status: "completed",
            taskPoints: 10,
          }),
        ]}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByText(/verified by hr/i).length).toBeGreaterThan(0);
  });

  it("requires a link before an assignment can be submitted", async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValueOnce({ ok: true });

    render(
      <MemberDeliverablesView
        {...baseProps}
        items={[
          makeItem({
            id: "asg-1",
            title: "PCB layout",
            workType: "assignment",
            maxPoints: 40,
          }),
        ]}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    const urlInputs = screen.getAllByLabelText(/submission url/i);
    const noteInputs = screen.getAllByLabelText(/notes/i);
    const submitBtns = screen.getAllByRole("button", { name: /submit/i });

    await user.type(noteInputs[0], "v2 layout");
    await user.click(submitBtns[0]);
    expect(mockSubmit).not.toHaveBeenCalled();

    await user.type(urlInputs[0], "https://github.com/embs/pcb");
    await user.click(submitBtns[0]);

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        taskId: "asg-1",
        submissionUrl: "https://github.com/embs/pcb",
        submissionText: "v2 layout",
      })
    );
  });

  it("shows the submitted link for an assignment awaiting review", () => {
    render(
      <MemberDeliverablesView
        {...baseProps}
        items={[
          makeItem({
            id: "asg-2",
            title: "Poster",
            workType: "assignment",
            status: "in_progress",
            submissionUrl: "https://figma.com/file/abc",
          }),
        ]}
      />
    );
    const links = screen.getAllByRole("link", { name: /submitted link/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "https://figma.com/file/abc");
  });
});
