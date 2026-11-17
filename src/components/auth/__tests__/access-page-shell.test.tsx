import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AccessPageShell } from "@/components/auth/access-page-shell";

describe("AccessPageShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("links the top-right back button to Home (/) rather than Leaderboard", () => {
    render(<AccessPageShell heading="Portal access" />);

    const homeLink = screen.getByRole("link", { name: /^home$/i });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("link", { name: /leaderboard/i })
    ).not.toBeInTheDocument();
  });
});
