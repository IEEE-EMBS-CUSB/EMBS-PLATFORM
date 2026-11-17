import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
      "Tasks",
      "Activities",
      "Evaluations",
      "Feedback",
    ]) {
      expect(
        screen.getAllByRole("link", { name: label }).length
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
