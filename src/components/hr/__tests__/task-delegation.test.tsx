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

  it("allows a Director to create assignments for Committee Heads, HR Admins, and Members without type toggle", async () => {
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

    expect(screen.getByText(/Delegate Assignments/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^task$/i })).not.toBeInTheDocument();

    const titleInput = screen.getByLabelText(/assignment title/i);
    await user.type(titleInput, "Finalize Midterm Curriculum");

    const assigneeSelect = screen.getByLabelText(/assign to/i);
    // Director can now assign assignments to Committee Heads, HR Admins, AND regular members
    expect(screen.getByRole("option", { name: /Salma El-Sayed \(Head\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Sara Hassan \(HR Admin\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Omar Tarek \(Member\)/i })).toBeInTheDocument();

    await user.selectOptions(assigneeSelect, "m-mem-1");

    const submitBtn = screen.getByRole("button", { name: /create assignment/i });
    await user.click(submitBtn);

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Finalize Midterm Curriculum",
        assignedToMembershipId: "m-mem-1",
        workType: "assignment",
      })
    );
  });

  it("scopes HR Admin assignments to HR committee while letting HR Admin assign tasks to everyone including heads-only with HR-only mode", async () => {
    const user = userEvent.setup();
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

    // HR Admin can receive assignments from Director
    expect(screen.getByText("Draft Q2 Committee Roadmap & Milestones")).toBeInTheDocument();

    // HR Admin sees both Assignment and Task type buttons
    const assignmentBtn = screen.getByRole("button", { name: /^assignment$/i });
    const taskBtn = screen.getByRole("button", { name: /^task$/i });
    expect(assignmentBtn).toBeInTheDocument();
    expect(taskBtn).toBeInTheDocument();

    // Under Assignment mode, HR Admin can ONLY assign to HR Members
    await user.click(assignmentBtn);
    expect(screen.getByRole("option", { name: /Laila Amr \(HR Member\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Salma El-Sayed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Omar Tarek/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/assignment title/i), "Audit Sheet Review");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "m-hr-mem");
    await user.click(screen.getByRole("button", { name: /create assignment/i }));

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Audit Sheet Review",
        assignedToMembershipId: "m-hr-mem",
        workType: "assignment",
      })
    );

    // Switch to Task mode: HR Admin can target everyone, including Heads-Only group, and choose HR-Only verification
    await user.click(taskBtn);
    expect(screen.getByRole("option", { name: /Salma El-Sayed \(Head\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Omar Tarek \(Member\)/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^group$/i }));
    const groupSelect = screen.getByLabelText(/target group/i);
    expect(screen.getByRole("option", { name: /all committee heads/i })).toBeInTheDocument();
    await user.selectOptions(groupSelect, "all_heads");

    // Pick HR-Only completion mode
    await user.click(screen.getByRole("button", { name: /hr-only/i }));

    await user.type(screen.getByLabelText(/task title/i), "Submit Monthly Head Report");
    await user.click(screen.getByRole("button", { name: /create group task/i }));

    expect(handleCreateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Submit Monthly Head Report",
        workType: "task",
        targetType: "group",
        targetGroup: "all_heads",
        completionMode: "hr_only",
      })
    );
  });

  it("allows an HR Member to create committee tasks (locked to Task type)", async () => {
    const user = userEvent.setup();
    const handleCreateTask = vi.fn();

    render(
      <TaskDelegationView
        currentUserRole="hr_member"
        currentUserId="m-hr-mem"
        currentUserCommitteeId="comm-ai"
        assignedToMe={[]}
        eligibleMembers={sampleMembers}
        onCreateTask={handleCreateTask}
      />
    );

    expect(screen.queryByRole("button", { name: /^assignment$/i })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/task title/i), "Submit Monthly Report");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "m-mem-1");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Submit Monthly Report",
        assignedToMembershipId: "m-mem-1",
        workType: "task",
      })
    );
  });

  it("allows assigning group assignments (e.g. all heads across chapter)", async () => {
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
    const groupTabBtn = screen.getByRole("button", { name: /group/i });
    await user.click(groupTabBtn);

    const titleInput = screen.getByLabelText(/assignment title/i);
    await user.type(titleInput, "Quarterly OKR Planning");

    const groupSelect = screen.getByLabelText(/target group/i);
    await user.selectOptions(groupSelect, "all_heads");

    const submitBtn = screen.getByRole("button", { name: /create group assignment/i });
    await user.click(submitBtn);

    expect(handleCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Quarterly OKR Planning",
        targetType: "group",
        targetGroup: "all_heads",
        workType: "assignment",
      })
    );
  });
});
