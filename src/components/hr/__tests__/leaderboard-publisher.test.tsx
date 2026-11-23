import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LeaderboardPublisherView,
  type SnapshotDisplayData,
} from "../leaderboard-publisher-view";
import {
  classifyPublishingMonthState,
  pickDefaultPublishingMonth,
} from "@/lib/publishing-state";

const mockSnapshot: SnapshotDisplayData = {
  month: "2026-10",
  status: "draft",
  committeeEntries: {
    ai: [
      {
        rank: 1,
        previousRank: 3,
        memberId: "mem-1",
        memberName: "Salma El-Sayed",
        committeeSlug: "ai",
        committeeName: "AI & Machine Learning",
        role: "member",
        monthlyScore: 195,
      },
    ],
    web: [
      {
        rank: 1,
        previousRank: 2,
        memberId: "mem-2",
        memberName: "Ziad Hany",
        committeeSlug: "web",
        committeeName: "Web Development",
        role: "member",
        monthlyScore: 180,
      },
      {
        rank: 2,
        previousRank: 1,
        memberId: "mem-3",
        memberName: "Omar Tarek",
        committeeSlug: "web",
        committeeName: "Web Development",
        role: "member",
        monthlyScore: 165,
      },
    ],
  },
};

describe("Publishing Month State Helpers", () => {
  it("classifies published, due_review, and in_progress months deterministically", () => {
    expect(classifyPublishingMonthState("2026-09", "published", "2026-11")).toBe(
      "published"
    );
    expect(classifyPublishingMonthState("2026-10", "draft", "2026-11")).toBe(
      "due_review"
    );
    expect(classifyPublishingMonthState("2026-11", "draft", "2026-11")).toBe(
      "in_progress"
    );
  });

  it("picks the most recent due_review month over an in_progress current month", () => {
    expect(
      pickDefaultPublishingMonth(
        [
          { month: "2026-11", status: "draft" },
          { month: "2026-10", status: "draft" },
          { month: "2026-09", status: "published" },
        ],
        "2026-11"
      )
    ).toBe("2026-10");

    expect(
      pickDefaultPublishingMonth(
        [
          { month: "2026-11", status: "draft" },
          { month: "2026-10", status: "published" },
        ],
        "2026-11"
      )
    ).toBe("2026-11");
  });
});

describe("LeaderboardPublisherView", () => {
  it("renders a completed past draft month as Ready to Review & Publish with Committee Leaders and By Committee tabs only", () => {
    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-11", "2026-10", "2026-09"]}
        currentMonth="2026-11"
      />
    );

    expect(
      screen.getByRole("heading", { name: /monthly leaderboard publisher/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/ready to review & publish/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /committee leaders/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /by committee/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /overall rankings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /committee heads/i })
    ).not.toBeInTheDocument();

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    expect(screen.getByText("Ziad Hany")).toBeInTheDocument();
    expect(screen.getByText("195 pts")).toBeInTheDocument();
    expect(screen.getByText("180 pts")).toBeInTheDocument();

    expect(screen.getByText("▲ 2")).toBeInTheDocument();
    expect(screen.getByText("▲ 1")).toBeInTheDocument();
  });

  it("publishes and locks a due_review month directly when HR clicks Publish & Freeze Rankings", async () => {
    const user = userEvent.setup();
    const handlePublish = vi.fn().mockResolvedValue({ ok: true });

    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-10", "2026-09"]}
        currentMonth="2026-11"
        onPublish={handlePublish}
      />
    );

    const publishBtn = screen.getByRole("button", {
      name: /publish & freeze rankings/i,
    });
    await user.click(publishBtn);

    expect(handlePublish).toHaveBeenCalledWith("2026-10");
    expect(screen.getAllByText("Published & Locked")).toHaveLength(2);
  });

  it("shows calm In Progress state for the current month and requires explicit confirmation to Publish Early", async () => {
    const user = userEvent.setup();
    const handlePublish = vi.fn().mockResolvedValue({ ok: true });

    render(
      <LeaderboardPublisherView
        snapshot={{ ...mockSnapshot, month: "2026-11", status: "draft" }}
        availableMonths={["2026-11", "2026-10"]}
        currentMonth="2026-11"
        onPublish={handlePublish}
      />
    );

    expect(
      screen.getByText(/in progress — wait for month end/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /publish & freeze rankings/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /publish early/i }));
    expect(handlePublish).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /publish november 2026 early/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /confirm publish early/i })
    );
    expect(handlePublish).toHaveBeenCalledWith("2026-11");
  });

  it("displays publishedAt date and publishedByName for already published months", () => {
    render(
      <LeaderboardPublisherView
        snapshot={{
          ...mockSnapshot,
          status: "published",
          publishedAt: "2026-11-01",
          publishedByName: "Sara Hassan",
        }}
        availableMonths={["2026-10"]}
        currentMonth="2026-11"
      />
    );

    expect(screen.getByText(/2026-11-01/i)).toBeInTheDocument();
    expect(screen.getByText(/sara hassan/i)).toBeInTheDocument();
  });

  it("switches to By Committee tab and displays per-committee member rankings", async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardPublisherView
        snapshot={mockSnapshot}
        availableMonths={["2026-10", "2026-09"]}
        currentMonth="2026-11"
      />
    );

    await user.click(screen.getByRole("button", { name: /by committee/i }));
    expect(screen.getByText("AI & Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();
    expect(screen.getByText("165 pts")).toBeInTheDocument();
  });
});
