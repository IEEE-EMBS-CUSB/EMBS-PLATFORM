import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PointsLedgerView,
  type LedgerEntryItem,
  type MemberOption,
} from "../points-ledger-view";

const mockMembers: MemberOption[] = [
  {
    id: "mem-1",
    fullName: "Salma El-Sayed",
    committeeName: "AI & Machine Learning",
    email: "salma@cusb.org",
  },
  {
    id: "mem-2",
    fullName: "Ziad Hany",
    committeeName: "Web Development",
    email: "ziad@cusb.org",
  },
];

const mockEntries: LedgerEntryItem[] = [
  {
    id: "led-1",
    membershipId: "mem-1",
    memberName: "Salma El-Sayed",
    memberEmail: "salma@cusb.org",
    committeeName: "AI & Machine Learning",
    month: "2026-10",
    sourceType: "manual_override",
    points: 15,
    reason: "Outstanding support during workshop setup",
    createdByName: "HR Admin",
    createdAt: "2026-10-15T12:00:00Z",
  },
  {
    id: "led-2",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    month: "2026-10",
    sourceType: "attendance",
    points: 15,
    reason: "Attended Web Track Session #1 with punctuality bonus",
    createdByName: "System QR Check-In",
    createdAt: "2026-10-10T18:00:00Z",
  },
  {
    id: "led-3",
    membershipId: "mem-2",
    memberName: "Ziad Hany",
    memberEmail: "ziad@cusb.org",
    committeeName: "Web Development",
    month: "2026-10",
    sourceType: "manual_override",
    points: -5,
    reason: "Late submission without prior notice",
    createdByName: "HR Admin",
    createdAt: "2026-10-20T10:00:00Z",
  },
];

describe("PointsLedgerView", () => {
  it("renders ledger table with transactions, reasons, and point badges", () => {
    render(
      <PointsLedgerView
        entries={mockEntries}
        members={mockMembers}
      />
    );

    expect(
      screen.getByRole("heading", { name: /point override ledger/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getAllByText("Ziad Hany")).toHaveLength(2);
    expect(
      screen.getByText("Outstanding support during workshop setup")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Late submission without prior notice")
    ).toBeInTheDocument();

    // Point badges
    expect(screen.getAllByText("+15 pts")).toHaveLength(2);
    expect(screen.getByText("-5 pts")).toBeInTheDocument();
  });

  it("filters ledger entries by search query and source type", async () => {
    const user = userEvent.setup();
    render(
      <PointsLedgerView
        entries={mockEntries}
        members={mockMembers}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search by member or reason/i);
    await user.type(searchInput, "workshop setup");

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.queryByText("Late submission without prior notice")).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText("Late submission without prior notice")).toBeInTheDocument();
  });

  it("opens modal without Board Scope dropdown and posts directly to member's committee board + global", async () => {
    const user = userEvent.setup();
    const onAddEntry = vi.fn().mockResolvedValue({ ok: true, id: "led-new" });
    render(
      <PointsLedgerView
        entries={mockEntries}
        members={mockMembers}
        onAddEntry={onAddEntry}
      />
    );

    const adjustBtn = screen.getByRole("button", { name: /adjust points/i });
    await user.click(adjustBtn);

    // Dialog opens and never renders a Board Scope dropdown
    expect(
      screen.getByRole("heading", { name: /log point adjustment/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/board scope/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/org-wide/i)).not.toBeInTheDocument();

    // Select member via searchable combobox
    const combo = screen.getByRole("combobox", { name: /select member/i });
    await user.click(combo);
    await user.type(combo, "Salma");
    await user.click(screen.getByRole("option", { name: /salma el-sayed/i }));

    // Enter points delta
    const pointsInput = screen.getByLabelText(/points adjustment/i);
    await user.clear(pointsInput);
    await user.type(pointsInput, "20");

    // Enter reason
    const reasonInput = screen.getByLabelText(/reason/i);
    await user.type(reasonInput, "Exceptional hackathon mentorship");

    // Submit adjustment
    const submitBtn = screen.getByRole("button", { name: /save adjustment/i });
    await user.click(submitBtn);

    expect(onAddEntry).toHaveBeenCalledTimes(1);
    const payload = onAddEntry.mock.calls[0][0];
    expect(payload).toMatchObject({
      membershipId: "mem-1",
      points: 20,
      reason: "Exceptional hackathon mentorship",
    });
    expect(payload).not.toHaveProperty("postingScope");

    // Modal closes and entry is listed
    expect(
      screen.queryByRole("heading", { name: /log point adjustment/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Exceptional hackathon mentorship")
    ).toBeInTheDocument();
    expect(screen.getByText("+20 pts")).toBeInTheDocument();
  });

  it("renders read-only audit view without Adjust Points button for Directors", () => {
    render(
      <PointsLedgerView
        entries={mockEntries}
        members={mockMembers}
        readOnly={true}
        scopedTrackName="Technical Track"
      />
    );

    expect(
      screen.queryByRole("button", { name: /adjust points/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/read-only audit view/i)).toBeInTheDocument();
    expect(screen.getByText(/technical track/i)).toBeInTheDocument();
    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
  });
});
