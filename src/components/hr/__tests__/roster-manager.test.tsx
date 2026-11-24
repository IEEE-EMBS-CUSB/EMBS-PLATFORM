import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

    const table = screen.getByRole("table");
    expect(within(table).getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(within(table).queryByText("Mariam Yassin")).not.toBeInTheDocument();
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

    expect(screen.queryByText(/Master Authority/i)).not.toBeInTheDocument();
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

    expect(screen.queryByText(/HR Admin Access/i)).not.toBeInTheDocument();
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

  it("allows Master Admin to assign a Director to a committee track inline and when adding a new director", async () => {
    const user = userEvent.setup();
    const handleAssignTrack = vi.fn().mockResolvedValue({ ok: true });
    const handleAdd = vi.fn().mockResolvedValue({ ok: true });

    const sampleTracks = [
      { id: "trk-tech", name: "Technical" },
      { id: "trk-creative", name: "Creative" },
      { id: "trk-ops", name: "Operations" },
    ];

    const membersWithDirector = [
      ...sampleMembers,
      {
        id: "m-dir",
        fullName: "Karim Nabil",
        email: "karim@cu.edu.eg",
        committeeId: null,
        committeeName: "Unassigned",
        managedTrackId: null,
        managedTrackName: null,
        role: "director" as const,
        isActive: true,
      },
    ];

    render(
      <RosterManagerView
        members={membersWithDirector}
        availableTracks={sampleTracks}
        currentUserRole="master_admin"
        onAssignDirectorTrack={handleAssignTrack}
        onAddMember={handleAdd}
      />
    );

    const trackSelect = screen.getByLabelText(
      /assign director track for karim nabil/i
    );
    await user.selectOptions(trackSelect, "trk-tech");
    expect(handleAssignTrack).toHaveBeenCalledWith("m-dir", "trk-tech");

    // Open Add Member modal and select Director role -> Managed Track picker appears
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.type(screen.getByPlaceholderText(/ahmed mostafa/i), "Nour Director");
    await user.type(
      screen.getByPlaceholderText(/ahmed.mostafa@cu.edu.eg/i),
      "nour.dir@cu.edu.eg"
    );
    const modalRoleSelect = screen.getByLabelText(/member role/i);
    await user.selectOptions(modalRoleSelect, "director");

    const modalTrackSelect = screen.getByLabelText(/managed committee track/i);
    await user.selectOptions(modalTrackSelect, "trk-ops");
    await user.click(screen.getByRole("button", { name: /^add to roster$/i }));

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Nour Director",
        role: "director",
        managedTrackId: "trk-ops",
        committeeId: null,
      })
    );
  });

  it("uses uniform white styling for director selector, removes Super Admin/Committee HR tags, supports multi-facet filters, and integrates search-to-add with directory autofill & multi-role clarity", async () => {
    const user = userEvent.setup();
    const richMembers = [
      {
        id: "m-master",
        personId: "p-master",
        fullName: "Master User",
        email: "master@cu.edu.eg",
        committeeId: null,
        committeeName: "Unassigned",
        role: "master_admin" as const,
        isActive: true,
      },
      {
        id: "m-dir",
        personId: "p-dir",
        fullName: "Karim Director",
        email: "karim@cu.edu.eg",
        committeeId: null,
        committeeName: "Unassigned",
        managedTrackId: "trk-tech",
        managedTrackName: "Technical",
        trackId: "trk-tech",
        role: "director" as const,
        isActive: true,
      },
      {
        id: "m-hr-1",
        personId: "p-multi",
        fullName: "Laila MultiHat",
        email: "laila@cu.edu.eg",
        committeeId: "comm-ai-ml",
        committeeName: "Tracks AI and Machine Learning",
        trackId: "trk-tech",
        role: "hr_member" as const,
        isActive: true,
      },
      {
        id: "m-mem-2",
        personId: "p-multi",
        fullName: "Laila MultiHat",
        email: "laila@cu.edu.eg",
        committeeId: "comm-graphic",
        committeeName: "Graphic Design",
        trackId: "trk-creative",
        role: "member" as const,
        isActive: true,
      },
    ];

    render(
      <RosterManagerView
        members={richMembers}
        peopleDirectory={[
          { id: "p-alumni", fullName: "Youssef Alumni", email: "youssef@cu.edu.eg" },
        ]}
        availableCommittees={[
          { id: "comm-ai-ml", name: "AI and Machine Learning", trackId: "trk-tech" },
          { id: "comm-graphic", name: "Graphic Design", trackId: "trk-creative" },
        ]}
        availableTracks={[
          { id: "trk-tech", name: "Technical" },
          { id: "trk-creative", name: "Creative" },
        ]}
        currentUserRole="master_admin"
      />
    );

    // Unnecessary tags removed
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Committee HR")).not.toBeInTheDocument();

    // Uniform white styling on director selector
    const dirSelect = screen.getByLabelText(/assign director track for karim director/i);
    expect(dirSelect.className).toContain("bg-white");
    expect(dirSelect.className).not.toContain("bg-[#f5edf7]");

    // Multi-role indicator visible for Laila MultiHat
    expect(screen.getAllByText("2 roles").length).toBe(2);

    // Highlighted HR Member Committee Assignments section visible
    expect(screen.getByText(/HR Member Committee Assignments/i)).toBeInTheDocument();

    // Filter by role = director
    await user.selectOptions(screen.getByLabelText("Filter by role"), "director");
    expect(screen.getByText("Karim Director")).toBeInTheDocument();
    expect(screen.queryByText("Master User")).not.toBeInTheDocument();

    // Reset filters
    await user.click(screen.getByRole("button", { name: /reset filters/i }));
    expect(screen.getByText("Master User")).toBeInTheDocument();

    // Search for existing person in peopleDirectory (not yet in season) -> click to autofill Add modal
    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    await user.type(searchInput, "Youssef");
    const autofillOpt = screen.getByRole("option", { name: /Youssef Alumni/i });
    await user.click(autofillOpt);

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Youssef Alumni");
    expect(screen.getByLabelText(/email address/i)).toHaveValue("youssef@cu.edu.eg");
    await user.click(screen.getByRole("button", { name: /close add member modal/i }));

    // Search for non-existent member -> inline Add option prefills modal
    await user.clear(searchInput);
    await user.type(searchInput, "brandnew@cu.edu.eg");
    await user.click(
      screen.getByRole("option", { name: /add .*brandnew@cu\.edu\.eg.* as new member/i })
    );
    expect(screen.getByLabelText(/email address/i)).toHaveValue("brandnew@cu.edu.eg");
  });

  it("shows Google-style search suggestions with active members, directory matches, and default-Enter add-new-member even when matches exist", async () => {
    const user = userEvent.setup();
    render(
      <RosterManagerView
        members={[
          {
            id: "m-1",
            personId: "p-1",
            fullName: "Nourhan Khaled",
            email: "nourhan@cu.edu.eg",
            committeeName: "AI and Machine Learning",
            role: "member",
            isActive: true,
          },
        ]}
        peopleDirectory={[
          {
            id: "p-2",
            fullName: "Nour Eldin",
            email: "nour.eldin@cu.edu.eg",
          },
        ]}
        currentUserRole="master_admin"
      />
    );

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    await user.type(searchInput, "Nour");

    // Dropdown immediately opens showing BOTH existing active match, inactive directory match, AND add-new option
    const listbox = screen.getByRole("listbox", { name: /roster search suggestions/i });
    expect(listbox).toBeInTheDocument();
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBe(3);
    expect(options[0]).toHaveTextContent(/Nourhan Khaled/i);
    expect(options[1]).toHaveTextContent(/Nour Eldin/i);
    expect(options[2]).toHaveTextContent(/Add .*Nour.* as new member/i);

    // Pressing Enter directly (default without arrowing down) opens Add Member modal prefilled with "Nour"
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("dialog", { name: /add member to roster/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Nour");

    // Close modal, refocus search, ArrowDown twice to select the directory match ("Nour Eldin"), press Enter
    await user.click(screen.getByRole("button", { name: /close add member modal/i }));
    await user.click(searchInput);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Nour Eldin");
    expect(screen.getByLabelText(/email address/i)).toHaveValue("nour.eldin@cu.edu.eg");
  });

  it("renders clickable WhatsApp phone links and keeps a disabled greyed-out Remove button on Master Admin rows for alignment", () => {
    render(
      <RosterManagerView
        currentUserRole="master_admin"
        members={[
          {
            id: "m-master",
            personId: "p-master",
            fullName: "Sheref Master",
            email: "master@embs.test",
            phoneNumber: "+201012345678",
            committeeName: "Unassigned",
            role: "master_admin",
            isActive: true,
          },
          {
            id: "m-head",
            personId: "p-head",
            fullName: "Salma AI Head",
            email: "head.ai@embs.test",
            phoneNumber: "+201123456789",
            committeeName: "AI and Machine Learning",
            role: "committee_head",
            isActive: true,
          },
        ]}
      />
    );

    const waLink = screen.getByRole("link", {
      name: /message sheref master on whatsapp/i,
    });
    expect(waLink).toHaveAttribute("href", "https://wa.me/201012345678");
    expect(waLink).toHaveAttribute("target", "_blank");

    // Both rows have a Remove button so columns stay aligned; master_admin's is disabled
    const masterRow = screen.getByText("Sheref Master").closest("tr")!;
    const headRow = screen.getByText("Salma AI Head").closest("tr")!;

    const masterRemoveBtn = within(masterRow).getByRole("button", {
      name: /remove/i,
    });
    expect(masterRemoveBtn).toBeDisabled();

    const headRemoveBtn = within(headRow).getByRole("button", {
      name: /remove/i,
    });
    expect(headRemoveBtn).not.toBeDisabled();
  });
});
