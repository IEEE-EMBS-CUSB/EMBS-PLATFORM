import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalShell } from "@/components/layout/portal-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/attendee",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/context", () => ({
  switchActiveContextAction: vi.fn().mockResolvedValue({
    ok: true,
    redirectTo: "/hr",
  }),
}));

describe("Attendee PortalShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders only attendee navigation links and logout without member-only sections or public IDs", () => {
    render(
      <PortalShell
        portalType="attendee"
        userName="Mariam Hesham"
        subtitle="Biomedical AI Foundations Track · Fall 2026 Cohort"
      >
        <div>Attendee dashboard content</div>
      </PortalShell>
    );

    expect(screen.getAllByText("Mariam Hesham").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/EMBS-A-|A001/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i })
    ).toBeInTheDocument();

    for (const label of ["Dashboard", "Attendance", "Assignments"]) {
      expect(
        screen.getAllByRole("link", { name: label }).length
      ).toBeGreaterThanOrEqual(1);
    }

    for (const forbiddenLabel of [
      "Performance",
      "Activities",
      "Evaluations",
      "Feedback",
      "Tasks",
    ]) {
      expect(
        screen.queryByRole("link", { name: forbiddenLabel })
      ).not.toBeInTheDocument();
    }
  });

  it("shows ContextSwitcher on /attendee when a multi-hat user also holds another role", async () => {
    const user = userEvent.setup();
    render(
      <PortalShell
        portalType="attendee"
        userName="Salma El-Sayed"
        subtitle="Robotics · Attendee"
        activeMembershipId="m-att-rob"
        contexts={[
          {
            membershipId: "m-head-pr",
            role: "committee_head",
            committeeName: "PR",
            trackedCommitteeName: null,
            managedTrackName: null,
          },
          {
            membershipId: "m-att-rob",
            role: "attendee",
            committeeName: "Robotics",
            trackedCommitteeName: null,
            managedTrackName: null,
          },
        ]}
      >
        <div>Attendee dashboard content</div>
      </PortalShell>
    );

    const header = screen.getByRole("banner");
    const switcher = within(header).getByRole("button", {
      name: /switch role or view: robotics · attendee · attendee portal/i,
    });
    await user.click(switcher);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("PR · Head")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^manage committee$/i })).toBeInTheDocument();
  });
});
