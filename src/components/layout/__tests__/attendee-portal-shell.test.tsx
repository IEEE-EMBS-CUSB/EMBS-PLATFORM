import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PortalShell } from "@/components/layout/portal-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/attendee",
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
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
});
