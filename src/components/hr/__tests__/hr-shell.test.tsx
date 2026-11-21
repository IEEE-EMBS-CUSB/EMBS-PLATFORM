import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HrShell } from "@/components/hr/hr-shell";

let mockPathname = "/hr";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("HrShell Component", () => {
  afterEach(() => {
    cleanup();
    mockPathname = "/hr";
  });

  it("renders unified brand header with sign-out button, user identity, and role-scoped tabs", () => {
    render(
      <HrShell
        currentUserRole="committee_head"
        userName="Salma El-Sayed"
        userCommitteeName="AI and Machine Learning"
      >
        <div>Content</div>
      </HrShell>
    );

    expect(screen.getAllByText("Salma El-Sayed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Head Console/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();

    // Committee heads can switch to Member View (/member) to inspect assignments given to them
    const memberViewLinks = screen.getAllByRole("link", {
      name: /member view/i,
    });
    expect(memberViewLinks.length).toBeGreaterThan(0);
    expect(memberViewLinks[0]).toHaveAttribute("href", "/member");

    expect(
      screen.getAllByRole("link", { name: /assignments/i }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /events/i })).not.toBeInTheDocument();
  });

  it("renders persistent desktop sidebar, mobile bottom nav, and derives active route from pathname", () => {
    mockPathname = "/hr/roster";

    render(
      <HrShell
        currentUserRole="master_admin"
        userName="Master Administrator"
        activeSeasonName="Spring 2026"
      >
        <div>Roster Content</div>
      </HrShell>
    );

    expect(screen.getAllByText("Master Administrator").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Master Authority/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /member view/i })
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
