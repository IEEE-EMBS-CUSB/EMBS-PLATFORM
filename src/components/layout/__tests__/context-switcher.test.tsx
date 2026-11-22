import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import type { ContextPickerOption } from "@/lib/context-picker";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

const mockSwitchAction = vi.fn();
vi.mock("@/app/actions/context", () => ({
  switchActiveContextAction: (...args: unknown[]) => mockSwitchAction(...args),
}));

describe("ContextSwitcher", () => {
  afterEach(() => {
    cleanup();
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockSwitchAction.mockReset();
  });

  it("renders a plain non-interactive label for single-context users", () => {
    const singleMember: ContextPickerOption[] = [
      {
        membershipId: "m-1",
        role: "member",
        committeeName: "AI and Machine Learning",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
    ];

    render(
      <ContextSwitcher
        contexts={singleMember}
        activeMembershipId="m-1"
        activePortal="member"
        variant="desktop"
      />
    );

    expect(
      screen.getByText("AI and Machine Learning · Member")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens desktop popover with grouped role headings, active checkmark, and switches context via server action", async () => {
    const user = userEvent.setup();
    mockSwitchAction.mockResolvedValueOnce({
      ok: true,
      activeMembershipId: "m-head-pr",
      redirectTo: "/member",
    });

    const contexts: ContextPickerOption[] = [
      {
        membershipId: "m-head-pr",
        role: "committee_head",
        committeeName: "PR",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
      {
        membershipId: "m-mem-ai",
        role: "member",
        committeeName: "AI",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
    ];

    render(
      <ContextSwitcher
        contexts={contexts}
        activeMembershipId="m-head-pr"
        activePortal="hr"
        variant="desktop"
      />
    );

    const trigger = screen.getByRole("button", {
      name: /switch role or view: pr · head · manage committee/i,
    });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("PR · Head")).toBeInTheDocument();
    expect(within(dialog).getByText("AI · Member")).toBeInTheDocument();

    const manageOption = within(dialog).getByRole("button", {
      name: /^manage committee$/i,
    });
    expect(manageOption).toHaveAttribute("aria-current", "true");

    const myWorkOptions = within(dialog).getAllByRole("button", {
      name: /^my work$/i,
    });
    expect(myWorkOptions).toHaveLength(2);

    // Click PR Head -> My work
    await user.click(myWorkOptions[0]);

    await waitFor(() => {
      expect(mockSwitchAction).toHaveBeenCalledWith("m-head-pr", "personal");
    });
    expect(mockPush).toHaveBeenCalledWith("/member");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("opens bottom sheet on mobile variant and shows inline alert when switch fails", async () => {
    const user = userEvent.setup();
    mockSwitchAction.mockResolvedValueOnce({
      ok: false,
      error: "Unauthorized: context no longer active.",
    });

    const contexts: ContextPickerOption[] = [
      {
        membershipId: "m-hr-1",
        role: "hr_member",
        committeeName: "Human Resources",
        trackedCommitteeName: "PR",
        managedTrackName: null,
      },
    ];

    render(
      <ContextSwitcher
        contexts={contexts}
        activeMembershipId="m-hr-1"
        activePortal="hr"
        variant="mobile"
      />
    );

    const trigger = screen.getByRole("button", {
      name: /switch role or view: hr · member · track pr/i,
    });
    await user.click(trigger);

    expect(screen.getByText("Switch role & view")).toBeInTheDocument();
    const myWorkBtn = screen.getByRole("button", { name: /my work/i });
    await user.click(myWorkBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /context no longer active/i
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
