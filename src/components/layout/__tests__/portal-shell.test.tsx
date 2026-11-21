import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PortalShell } from "@/components/layout/portal-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/member",
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PortalShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all member navigation links, user name, and a visible logout button without exposing member IDs", () => {
    render(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI and Machine Learning · Senior Member"
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

  it("places Leader View switch in sidebar (not header) for committee heads", () => {
    render(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI and Machine Learning · Head"
        currentUserRole="committee_head"
      >
        <div>Member dashboard content</div>
      </PortalShell>
    );

    const header = screen.getByRole("banner");
    expect(
      within(header).queryByRole("link", { name: /leader view/i })
    ).not.toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    const leaderViewLink = within(sidebar).getByRole("link", {
      name: /leader view/i,
    });
    expect(leaderViewLink).toHaveAttribute("href", "/hr");
  });
});
