import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PortalShell } from "@/components/layout/portal-shell";
import { HrShell } from "@/components/hr/hr-shell";
import { getSeenStorageKey } from "@/lib/nav-notifications";

let mockPathname = "/member";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/context", () => ({
  switchActiveContextAction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Navigation Notification Badges (Desktop Sidebar + Mobile Bottom Bar)", () => {
  beforeEach(() => {
    mockPathname = "/member";
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders action counts and unseen recent feedback badges in PortalShell, and clears feedback badge in localStorage when visiting /member/feedback", () => {
    const recentDate = new Date(Date.now() - 60_000).toISOString();
    const badges = {
      "/member/assignments": { count: 3, tone: "purple" as const },
      "/member/tasks": { count: 2, tone: "purple" as const },
      "/member/feedback": {
        count: 1,
        tone: "red" as const,
        seenKey: "member_feedback:person-1",
        recentItemDates: [recentDate],
        recentWarningDates: [recentDate],
      },
    };

    const { rerender } = render(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI · Member"
        navBadges={badges}
      >
        <div>Body</div>
      </PortalShell>
    );

    const sidebar = screen.getByRole("complementary");
    expect(
      within(sidebar).getByRole("link", { name: /assignments.*3/i })
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: /tasks.*2/i })
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: /feedback.*1/i })
    ).toBeInTheDocument();

    // Mobile bottom bar shows overflow badge on "More" (Tasks 2 + Feedback 1 = 3)
    const mobileNav = screen.getByRole("navigation", {
      name: /mobile navigation/i,
    });
    expect(
      within(mobileNav).getByRole("button", { name: /more sections/i })
    ).toHaveTextContent("3");

    // Navigate to /member/feedback -> marks seen in localStorage and clears Feedback badge
    mockPathname = "/member/feedback";
    rerender(
      <PortalShell
        portalType="member"
        userName="Salma El-Sayed"
        subtitle="AI · Member"
        navBadges={badges}
      >
        <div>Feedback Page</div>
      </PortalShell>
    );

    expect(
      window.localStorage.getItem(getSeenStorageKey("member_feedback:person-1"))
    ).not.toBeNull();
    expect(
      within(sidebar).queryByRole("link", { name: /feedback.*1/i })
    ).not.toBeInTheDocument();
  });

  it("renders operational notification badges in HrShell sidebar and mobile bottom bar", () => {
    mockPathname = "/hr";
    render(
      <HrShell
        currentUserRole="hr_admin"
        userName="Sara Hassan"
        navBadges={{
          "/hr/tasks": { count: 4, tone: "purple" },
          "/hr/publishing": { count: 1, tone: "amber" },
          "/hr/attendance": { count: 1, tone: "green" },
        }}
      >
        <div>HR Body</div>
      </HrShell>
    );

    const sidebar = screen.getByRole("complementary");
    expect(
      within(sidebar).getByRole("link", { name: /tasks & work.*4/i })
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: /publishing.*1/i })
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: /attendance.*1/i })
    ).toBeInTheDocument();

    // Mobile bottom bar shows badges on primary tabs and overflow badge on More
    const mobileNav = screen.getByRole("navigation", {
      name: /mobile hr navigation/i,
    });
    expect(
      within(mobileNav).getByRole("button", { name: /more modules/i })
    ).toHaveTextContent("6");
  });
});
