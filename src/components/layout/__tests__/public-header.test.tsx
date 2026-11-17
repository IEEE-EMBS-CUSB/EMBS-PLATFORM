import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PublicHeader } from "@/components/layout/public-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("PublicHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses Home and Leaderboard labels without Overview or Archive links", () => {
    render(<PublicHeader session={null} />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "href",
      "/leaderboards"
    );
    expect(
      screen.queryByRole("link", { name: /overview|archive/i })
    ).not.toBeInTheDocument();
  });
});
