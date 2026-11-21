import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HrShell } from "@/components/hr/hr-shell";

describe("HrShell Component", () => {
  it("renders unified brand header with sign-out button, user identity, and role-scoped tabs", () => {
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

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getAllByText(/Head Console/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();

    // Operational roles operate within /hr and do not render a dead /member redirect button
    expect(
      screen.queryByRole("link", { name: /personal portal/i })
    ).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
  });

  it("renders Master Authority header for master_admin with seasons access", () => {
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
    expect(screen.getAllByText(/Master Authority/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /seasons/i })).toBeInTheDocument();
  });
});
