import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrShell } from "@/components/hr/hr-shell";

let mockPathname = "/hr";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/context", () => ({
  switchActiveContextAction: vi.fn().mockResolvedValue({
    ok: true,
    redirectTo: "/member",
  }),
}));

describe("HrShell Component", () => {
  afterEach(() => {
    cleanup();
    mockPathname = "/hr";
  });

  it("renders unified brand header and sidebar ContextSwitcher for committee heads without labeling personal work 'Member'", async () => {
    const user = userEvent.setup();
    render(
      <HrShell
        currentUserRole="committee_head"
        userName="Salma El-Sayed"
        userCommitteeName="AI and Machine Learning"
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
        <div>Content</div>
      </HrShell>
    );

    expect(screen.getAllByText("Salma El-Sayed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Head Console/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();

    // Never show legacy "Member View" wording anywhere (Spec §5)
    expect(screen.queryByText(/member view/i)).not.toBeInTheDocument();

    const header = screen.getByRole("banner");
    expect(
      within(header).queryByRole("button", { name: /switch role or view/i })
    ).not.toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    const switcher = within(sidebar).getByRole("button", {
      name: /switch role or view: ai and machine learning · head · manage committee/i,
    });
    await user.click(switcher);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("AI and Machine Learning · Head")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^my work$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^manage committee$/i })).toHaveAttribute(
      "aria-current",
      "true"
    );

    expect(
      screen.getAllByRole("link", { name: /assignments/i }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });

  it("gives hr_member a sidebar ContextSwitcher with My work and Track <Committee>", async () => {
    const user = userEvent.setup();
    render(
      <HrShell
        currentUserRole="hr_member"
        userName="Laila Amr"
        userCommitteeName="HR · Tracking PR"
        activeMembershipId="m-hr-1"
        contexts={[
          {
            membershipId: "m-hr-1",
            role: "hr_member",
            committeeName: "Human Resources",
            trackedCommitteeName: "PR",
            managedTrackName: null,
          },
        ]}
      >
        <div>HR Content</div>
      </HrShell>
    );

    const sidebar = screen.getByRole("complementary");
    const switcher = within(sidebar).getByRole("button", {
      name: /switch role or view: hr · member · track pr/i,
    });
    await user.click(switcher);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^my work$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^track pr$/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("renders plain non-interactive label for single-context master_admin and derives active route from pathname", () => {
    mockPathname = "/hr/roster";

    render(
      <HrShell
        currentUserRole="master_admin"
        userName="Master Administrator"
        activeSeasonName="Spring 2026"
        activeMembershipId="m-master"
        contexts={[
          {
            membershipId: "m-master",
            role: "master_admin",
            committeeName: null,
            trackedCommitteeName: null,
            managedTrackName: null,
          },
        ]}
      >
        <div>Roster Content</div>
      </HrShell>
    );

    expect(screen.getAllByText("Master Administrator").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Master Authority/i).length).toBeGreaterThan(0);
    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByText("Master Admin")).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("button", { name: /switch role or view/i })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /events/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /hr operations navigation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /mobile hr navigation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open hr navigation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more modules/i })
    ).toBeInTheDocument();

    const rosterLinks = screen.getAllByRole("link", { name: /roster/i });
    expect(rosterLinks.length).toBeGreaterThan(0);
    expect(
      rosterLinks.some((link) => link.getAttribute("aria-current") === "page")
    ).toBe(true);
  });
});
