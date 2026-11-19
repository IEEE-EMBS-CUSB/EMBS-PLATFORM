import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HrShell } from "@/components/hr/hr-shell";

describe("HrShell Component", () => {
  it("renders unified brand header with sign-out button, user identity, and personal portal link", () => {
    render(
      <HrShell
        activeTab="overview"
        currentUserRole="committee_head"
        userName="Salma El-Sayed"
        userCommitteeName="AI and Machine Learning"
      >
        <div>Content</div>
      </HrShell>
    );

    // Verify user identity
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText(/Head Console/i)).toBeInTheDocument();

    // Verify sign out button
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();

    // Verify personal portal link for dual-responsibility roles
    expect(
      screen.getByRole("link", { name: /personal portal/i })
    ).toHaveAttribute("href", "/member");

    // Verify tabs are present and filtered for committee head
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
  });

  it("renders Master Authority header for master_admin without personal portal link requirement", () => {
    render(
      <HrShell
        activeTab="overview"
        currentUserRole="master_admin"
        userName="Master Administrator"
      >
        <div>Content</div>
      </HrShell>
    );

    expect(screen.getByText("Master Administrator")).toBeInTheDocument();
    expect(screen.getByText(/Master Authority/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /seasons/i })).toBeInTheDocument();
  });
});
