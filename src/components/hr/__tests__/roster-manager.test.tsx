import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RosterManagerView } from "@/components/hr/roster-manager-view";

describe("RosterManagerView Component", () => {
  const sampleMembers = [
    {
      id: "m-1",
      fullName: "Salma El-Sayed",
      email: "salma.elsayed@cu.edu.eg",
      committeeName: "AI and Machine Learning",
      role: "committee_head" as const,
      isActive: true,
    },
    {
      id: "m-2",
      fullName: "Mariam Yassin",
      email: "mariam.yassin@gmail.com",
      committeeName: "Unassigned",
      role: "attendee" as const,
      isActive: true,
    },
  ];

  it("renders roster members and allows searching", async () => {
    const user = userEvent.setup();
    render(<RosterManagerView members={sampleMembers} />);

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Mariam Yassin")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    await user.type(searchInput, "Salma");

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.queryByText("Mariam Yassin")).not.toBeInTheDocument();
  });

  it("opens CSV Bulk Import modal and parses preview", async () => {
    const user = userEvent.setup();
    render(<RosterManagerView members={sampleMembers} />);

    const importButton = screen.getByRole("button", {
      name: /csv bulk import/i,
    });
    await user.click(importButton);

    expect(
      screen.getByText(/paste csv content with headers/i)
    ).toBeInTheDocument();
  });

  it("allows Master Admin to reassign member roles", async () => {
    const user = userEvent.setup();
    const handleRole = vi.fn();
    render(
      <RosterManagerView
        members={sampleMembers}
        currentUserRole="master_admin"
        onAssignRole={handleRole}
      />
    );

    expect(screen.getAllByText(/Master Authority/i).length).toBeGreaterThanOrEqual(1);
    const roleSelect = screen.getByLabelText("Assign role for Salma El-Sayed");
    await user.selectOptions(roleSelect, "hr_admin");

    expect(handleRole).toHaveBeenCalledWith("m-1", "hr_admin");
  });

  it("allows HR Admin to assign HR members to committees", async () => {
    const user = userEvent.setup();
    const handleCommittee = vi.fn();
    const membersWithHr = [
      ...sampleMembers,
      {
        id: "m-3",
        fullName: "Laila Amr",
        email: "laila@cu.edu.eg",
        committeeId: null,
        committeeName: "Unassigned",
        role: "hr_member" as const,
        isActive: true,
      },
    ];

    render(
      <RosterManagerView
        members={membersWithHr}
        currentUserRole="hr_admin"
        onAssignCommittee={handleCommittee}
      />
    );

    expect(screen.getByText(/HR Admin Access/i)).toBeInTheDocument();
    const commSelect = screen.getByLabelText("Assign committee for Laila Amr");
    await user.selectOptions(commSelect, "comm-ai-ml");

    expect(handleCommittee).toHaveBeenCalledWith("m-3", "comm-ai-ml");
  });

  it("allows Master Admin or HR Admin to reset member password to generate a temporary pre-assigned password", async () => {
    const user = userEvent.setup();
    const handleReset = vi.fn().mockResolvedValue({
      ok: true,
      tempPassword: "EMBS-2026-TEST",
    });

    render(
      <RosterManagerView
        members={sampleMembers}
        currentUserRole="master_admin"
        onResetPassword={handleReset}
      />
    );

    const resetButton = screen.getByRole("button", {
      name: /reset password for Salma El-Sayed/i,
    });
    await user.click(resetButton);

    expect(handleReset).toHaveBeenCalledWith("m-1");
    expect(await screen.findByText("EMBS-2026-TEST")).toBeInTheDocument();
    expect(screen.getByText(/temporary password generated/i)).toBeInTheDocument();
  });

  it("allows Master Admin to add a new member through the Add Member modal", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn().mockResolvedValue({ ok: true });

    render(
      <RosterManagerView
        members={sampleMembers}
        currentUserRole="master_admin"
        onAddMember={handleAdd}
      />
    );

    const addBtn = screen.getByRole("button", { name: /add member/i });
    await user.click(addBtn);

    expect(screen.getByRole("dialog", { name: /add member to roster/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/ahmed mostafa/i);
    const emailInput = screen.getByPlaceholderText(/ahmed.mostafa@cu.edu.eg/i);

    await user.type(nameInput, "New Candidate");
    await user.type(emailInput, "new.candidate@cu.edu.eg");

    const submitBtn = screen.getByRole("button", { name: /^add to roster$/i });
    await user.click(submitBtn);

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "New Candidate",
        email: "new.candidate@cu.edu.eg",
      })
    );
    expect(await screen.findByText("New Candidate")).toBeInTheDocument();
  });

  it("allows Master Admin to remove a non-master member from the roster", async () => {
    const user = userEvent.setup();
    const handleRemove = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <RosterManagerView
        members={sampleMembers}
        currentUserRole="master_admin"
        onRemoveMember={handleRemove}
      />
    );

    const removeBtn = screen.getByRole("button", {
      name: /remove salma el-sayed from roster/i,
    });
    await user.click(removeBtn);

    expect(handleRemove).toHaveBeenCalledWith("m-1");
    expect(screen.queryByText("salma.elsayed@cu.edu.eg")).not.toBeInTheDocument();
  });
});
