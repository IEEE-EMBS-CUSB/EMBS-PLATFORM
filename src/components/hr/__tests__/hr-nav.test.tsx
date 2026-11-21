import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HrNav } from "@/components/hr/hr-nav";

describe("HrNav Component", () => {
  it("renders all core HR operational links with active indicator for master_admin", () => {
    render(<HrNav activeTab="overview" currentUserRole="master_admin" />);

    expect(screen.getByRole("link", { name: /overview/i })).toHaveAttribute(
      "href",
      "/hr"
    );
    expect(screen.getByRole("link", { name: /seasons/i })).toHaveAttribute(
      "href",
      "/hr/seasons"
    );
    expect(
      screen.getByRole("link", { name: /committees/i })
    ).toHaveAttribute("href", "/hr/committees");
    expect(screen.getByRole("link", { name: /roster/i })).toHaveAttribute(
      "href",
      "/hr/roster"
    );
    expect(screen.getByRole("link", { name: /attendance/i })).toHaveAttribute(
      "href",
      "/hr/attendance"
    );
    expect(screen.getByRole("link", { name: /tasks & assignments/i })).toHaveAttribute(
      "href",
      "/hr/tasks"
    );
    expect(screen.getByRole("link", { name: /points ledger/i })).toHaveAttribute(
      "href",
      "/hr/ledger"
    );
    expect(screen.getByRole("link", { name: /feedback/i })).toHaveAttribute(
      "href",
      "/hr/feedback"
    );
    expect(screen.getByRole("link", { name: /publishing/i })).toHaveAttribute(
      "href",
      "/hr/publishing"
    );
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });

  it("filters out seasons for hr_admin (only master can manage seasons)", () => {
    render(<HrNav activeTab="overview" currentUserRole="hr_admin" />);

    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /committees/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /roster/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks & assignments/i })).toBeInTheDocument();
  });

  it("filters navigation links for director (assignments, committees, roster, ledger, feedback, overview)", () => {
    render(<HrNav activeTab="tasks" currentUserRole="director" />);

    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^assignments$/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /committees/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /roster/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /points ledger/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /feedback/i })).toBeInTheDocument();

    // Director does NOT see seasons, attendance, publishing, or removed events
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /attendance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /publishing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });

  it("filters navigation links for hr_member (overview, attendance, tasks, ledger)", () => {
    render(<HrNav activeTab="attendance" currentUserRole="hr_member" />);

    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^tasks$/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /points ledger/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /committees/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /publishing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });

  it("filters navigation links for committee_head (sessions/attendance, assignments, ledger, feedback, overview)", () => {
    render(<HrNav activeTab="tasks" currentUserRole="committee_head" />);

    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^assignments$/i })).toHaveAttribute("href", "/hr/tasks");
    expect(screen.getByRole("link", { name: /points ledger/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /feedback/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /committees/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /publishing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });
});
