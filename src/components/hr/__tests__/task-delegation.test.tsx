import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDelegationView } from "@/components/hr/task-delegation-view";

describe("TaskDelegationView Component", () => {
  const sampleAssignedToMe = [
    {
      id: "task-dir-1",
      title: "Draft Q2 Committee Roadmap & Milestones",
      assignedByName: "Khaled Mansour",
      assignerRole: "director" as const,
      dueAt: new Date("2026-11-30"),
      maxPoints: 100,
      status: "in_progress" as const,
    },
  ];

  const sampleMembers = [
    {
      id: "m-head-1",
      fullName: "Salma El-Sayed",
      role: "committee_head" as const,
      committeeId: "comm-ai",
      committeeName: "AI and Machine Learning",
    },
    {
      id: "m-hr-admin",
      fullName: "Sara Hassan",
      role: "hr_admin" as const,
      committeeId: "comm-hr",
      committeeName: "Human Resources",
    },
    {
      id: "m-hr-mem",
      fullName: "Laila Amr",
      role: "hr_member" as const,
      committeeId: "comm-ai",
      committeeName: "AI and Machine Learning",
    },
    {
      id: "m-mem-1",
      fullName: "Omar Tarek",
      role: "member" as const,
      committeeId: "comm-ai",
      committeeName: "AI and Machine Learning",
    },
  ];

  it("displays tasks assigned to the current committee head by their director", () => {
    render(
      <TaskDelegationView
        currentUserRole="committee_head"
        currentUserId="m-head-1"
        assignedToMe={sampleAssignedToMe}
        eligibleMembers={sampleMembers}
      />
    );

    expect(
      screen.getByText("Draft Q2 Committee Roadmap & Milestones")
    ).toBeInTheDocument();
    expect(screen.getByText(/Assigned by Director Khaled Mansour/i)).toBeInTheDocument();
  });

  it("allows a Director to assign tasks to Committee Heads and HR Admins", async () => {
    const user = userEvent.setup();
    const handleCreateTask = vi.fn();

    render(
      <TaskDelegationView
        currentUserRole="director"
        currentUserId="usr-dir"
        assignedToMe={[]}
        eligibleMembers={sampleMembers}
        onCreateTask={handleCreateTask}
      />
    );

    expect(screen.getByText(/Delegate Tasks to Heads/i)).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/task title/i);
    await user.type(titleInput, "Finalize Midterm Curriculum");

    const assigneeSelect = screen.getByLabelText(/assign to/i);
    // Director can assign to Committee Heads and HR Admins, but not regular members
    expect(screen.getByRole("option", { name: /Salma El-Sayed \(Head\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Sara Hassan \(HR Admin\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Omar Tarek \(Member\)/i })).not.toBeInTheDocument();

    await user.selectOptions(assigneeSelect, "m-head-1");

    const submitBtn = screen.getByRole("button", { name: /assign task/i });
    await user.click(submitBtn);

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Finalize Midterm Curriculum",
        assignedToMembershipId: "m-head-1",
      })
    );
  });

  it("allows an HR Admin to assign tasks to HR members", () => {
    const handleCreateTask = vi.fn();

    render(
      <TaskDelegationView
        currentUserRole="hr_admin"
        currentUserId="m-hr-admin"
        assignedToMe={sampleAssignedToMe}
        eligibleMembers={sampleMembers}
        onCreateTask={handleCreateTask}
      />
    );

    // HR Admin can receive tasks from Director
    expect(screen.getByText("Draft Q2 Committee Roadmap & Milestones")).toBeInTheDocument();

    // HR Admin assigns to HR Member
    expect(screen.getByRole("option", { name: /Laila Amr \(HR Member\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Salma El-Sayed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Omar Tarek \(Member\)/i })).not.toBeInTheDocument();
  });

  it("allows assigning tasks to a group (e.g. all heads across chapter)", async () => {
    const user = userEvent.setup();
    const handleCreateTask = vi.fn();

    render(
      <TaskDelegationView
        currentUserRole="director"
        currentUserId="usr-dir"
        assignedToMe={[]}
        eligibleMembers={sampleMembers}
        onCreateTask={handleCreateTask}
      />
    );

    // Switch to Group mode
    const groupTabBtn = screen.getByRole("button", { name: /group assignment/i });
    await user.click(groupTabBtn);

    const titleInput = screen.getByLabelText(/task title/i);
    await user.type(titleInput, "Quarterly OKR Planning");

    const groupSelect = screen.getByLabelText(/target group/i);
    await user.selectOptions(groupSelect, "all_heads");

    const submitBtn = screen.getByRole("button", { name: /assign task/i });
    await user.click(submitBtn);

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Quarterly OKR Planning",
        targetType: "group",
        targetGroup: "all_heads",
      })
    );
  });
});
