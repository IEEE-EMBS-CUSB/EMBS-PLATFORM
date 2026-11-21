import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskSubmitForm } from "@/components/member/task-submit-form";
import { EventLogForm } from "@/components/hr/event-log-form";

const mockSubmitTask = vi.fn();
vi.mock("@/app/hr/tasks/actions", () => ({
  submitTaskAction: (...args: unknown[]) => mockSubmitTask(...args),
}));

const mockLogEvent = vi.fn();
vi.mock("@/app/hr/events/actions", () => ({
  logEventAction: (...args: unknown[]) => mockLogEvent(...args),
}));

describe("TaskSubmitForm & EventLogForm", () => {
  it("TaskSubmitForm validates javascript: URLs and submits clean deliverables", async () => {
    const user = userEvent.setup();
    mockSubmitTask.mockResolvedValueOnce({ ok: true });

    render(<TaskSubmitForm taskId="task-123" />);

    await user.type(screen.getByLabelText(/submission url/i), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/http/i);
    expect(mockSubmitTask).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/submission url/i));
    await user.type(screen.getByLabelText(/submission notes/i), "Completed PCB layout");
    await user.type(screen.getByLabelText(/submission url/i), "https://github.com/embs/pcb");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockSubmitTask).toHaveBeenCalledWith({
        taskId: "task-123",
        submissionText: "Completed PCB layout",
        submissionUrl: "https://github.com/embs/pcb",
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/submitted/i);
  });

  it("EventLogForm submits event and displays awarded count or server error", async () => {
    const user = userEvent.setup();
    mockLogEvent.mockResolvedValueOnce({ ok: true, eventId: "ev-1", awarded: 12 });

    render(
      <EventLogForm
        committees={[{ id: "c-1", name: "AI & ML" }]}
        defaultDate="2026-11-21"
        isBranchWideAllowed={true}
      />
    );

    await user.type(screen.getByLabelText(/event title/i), "Hackathon Kickoff");
    await user.click(screen.getByRole("button", { name: /log event/i }));

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Hackathon Kickoff",
          eventDate: "2026-11-21",
          points: 10,
        })
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(/12 active member/i);
  });
});
