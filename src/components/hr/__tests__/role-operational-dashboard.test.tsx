import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleOperationalDashboard } from "@/components/hr/role-operational-dashboard";

describe("RoleOperationalDashboard Component", () => {
  const sampleHeadDirectives = [
    {
      id: "t-1",
      title: "Draft Q2 Committee Roadmap & Milestones",
      assignedByName: "Khaled Mansour",
      assignerRole: "director" as const,
      dueAt: new Date("2026-11-30"),
      maxPoints: 100,
      status: "in_progress" as const,
    },
  ];

  it("renders distinct dual-section view for committee_head (personal deliverables vs committee management)", () => {
    render(
      <RoleOperationalDashboard
        currentUserRole="committee_head"
        userName="Salma El-Sayed"
        committeeName="AI and Machine Learning"
        assignedTasks={sampleHeadDirectives}
      />
    );

    // Section 1: Personal assignments from Director
    expect(screen.getByText(/My Assignments \(From Director\)/i)).toBeInTheDocument();
    expect(screen.getByText("Draft Q2 Committee Roadmap & Milestones")).toBeInTheDocument();
    expect(screen.getByText(/Assigned by Director Khaled Mansour/i)).toBeInTheDocument();

    // Section 2: Committee Management Console
    expect(screen.getByText(/Committee Leadership Console/i)).toBeInTheDocument();
    expect(screen.getByText("AI and Machine Learning")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create committee assignments/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /grade deliverables/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /award committee bonus/i })).toHaveAttribute("href", "/hr/ledger");

    // Must NOT contain restricted modules
    expect(screen.queryByText(/season rollover/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/publish monthly snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/csv bulk whitelist import/i)).not.toBeInTheDocument();
  });

  it("renders distinct dual-section view for director (executive roadmap vs heads delegation board)", () => {
    render(
      <RoleOperationalDashboard
        currentUserRole="director"
        userName="Khaled Mansour"
        assignedTasks={[]}
      />
    );

    expect(screen.getByText(/Executive Directives & Roadmap/i)).toBeInTheDocument();
    expect(screen.getByText(/Committee Overseer & Heads Delegation/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /delegate assignments to heads/i })).toHaveAttribute("href", "/hr/tasks");

    // Director cannot manage seasons or attendance
    expect(screen.queryByText(/season rollover/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live qr check-in/i)).not.toBeInTheDocument();
  });

  it("renders distinct dual-section view for hr_admin (director tasks vs HR operations)", () => {
    render(
      <RoleOperationalDashboard
        currentUserRole="hr_admin"
        userName="Sara Hassan"
        assignedTasks={sampleHeadDirectives}
      />
    );

    // Section 1: Tasks from Director
    expect(screen.getByText(/Directives from Director/i)).toBeInTheDocument();

    // Section 2: HR Management Console
    expect(screen.getByText(/Human Resources Operations Console/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /assign hr members/i })).toHaveAttribute("href", "/hr/roster");
    expect(screen.getByRole("link", { name: /publish monthly leaderboard/i })).toHaveAttribute("href", "/hr/publishing");

    // HR Admin cannot manage seasons (only master)
    expect(screen.queryByText(/season rollover/i)).not.toBeInTheDocument();
  });

  it("renders Master Authority governance console for master_admin", () => {
    render(
      <RoleOperationalDashboard
        currentUserRole="master_admin"
        userName="Master Administrator"
      />
    );

    expect(screen.getByText(/Master Authority & Chapter Governance/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /season lifecycle & clone/i })).toHaveAttribute("href", "/hr/seasons");
    expect(screen.getByRole("link", { name: /roster whitelist & roles/i })).toHaveAttribute("href", "/hr/roster");
  });

  it("renders scoped attendance desk for hr_member", () => {
    render(
      <RoleOperationalDashboard
        currentUserRole="hr_member"
        userName="Laila Amr"
        committeeName="AI and Machine Learning"
        assignedTasks={[]}
      />
    );

    expect(screen.getByText(/Committee HR Operations/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /live qr check-in/i })).toHaveAttribute("href", "/hr/attendance");
    expect(screen.getByRole("link", { name: /manage tasks/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /award attendance points/i })).toHaveAttribute("href", "/hr/ledger");

    // HR Member cannot see tasks grading, seasons, or publishing
    expect(screen.queryByText(/grade deliverables/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/season rollover/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/publish monthly leaderboard/i)).not.toBeInTheDocument();
  });
});
