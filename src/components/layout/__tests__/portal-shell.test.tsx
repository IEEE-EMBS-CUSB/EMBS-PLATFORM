import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalShell } from "@/components/layout/portal-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/member",
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

describe("PortalShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all member navigation links, user name, plain label for single-context members, and visible logout without exposing member IDs", () => {
    render(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI and Machine Learning · Member"
        activeMembershipId="m-1"
        contexts={[
          {
            membershipId: "m-1",
            role: "member",
            committeeName: "AI and Machine Learning",
            trackedCommitteeName: null,
            managedTrackName: null,
          },
        ]}
      >
        <div>Member dashboard content</div>
      </PortalShell>
    );

    expect(screen.getAllByText("Salma El-Sayed").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryByText(/EMBS-M-|M001/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more sections/i })
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    expect(
      within(sidebar).queryByRole("button", { name: /switch role or view/i })
    ).not.toBeInTheDocument();

    for (const label of [
      "Dashboard",
      "Performance",
      "Attendance",
      "Assignments",
      "Tasks",
      "Evaluations",
      "Feedback",
    ]) {
      expect(
        screen.getAllByRole("link", { name: label }).length
      ).toBeGreaterThanOrEqual(1);
    }

    expect(
      screen.queryByRole("link", { name: /activities/i })
    ).not.toBeInTheDocument();
  });

  it("places ContextSwitcher in sidebar (not header) for committee heads on /member and keeps role labeled Head", async () => {
    const user = userEvent.setup();
    render(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI and Machine Learning · Head"
        currentUserRole="committee_head"
        activeMembershipId="m-head-ai"
        contexts={[
          {
            membershipId: "m-head-ai",
            role: "committee_head",
            committeeName: "AI and Machine Learning",
            trackedCommitteeName: null,
            managedTrackName: null,
          },
        ]}
      >
        <div>Member dashboard content</div>
      </PortalShell>
    );

    const header = screen.getByRole("banner");
    expect(
      within(header).queryByRole("button", { name: /switch role or view/i })
    ).not.toBeInTheDocument();
    expect(within(header).queryByText(/member portal/i)).not.toBeInTheDocument();
    expect(within(header).getByText("My work")).toBeInTheDocument();
    expect(screen.queryByText(/leader view/i)).not.toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    const switcher = within(sidebar).getByRole("button", {
      name: /switch role or view: ai and machine learning · head · my work/i,
    });
    await user.click(switcher);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^my work$/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(
      within(dialog).getByRole("button", { name: /^manage committee$/i })
    ).toBeInTheDocument();
  });
});
