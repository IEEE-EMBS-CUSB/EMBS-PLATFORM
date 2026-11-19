import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "@/components/auth/logout-button";
import * as navigation from "@/lib/navigation";

describe("LogoutButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/session and performs a full navigation to /access so portal state never stays stuck", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const navSpy = vi
      .spyOn(navigation, "navigateHard")
      .mockImplementation(() => {});

    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
    expect(navSpy).toHaveBeenCalledWith("/login");
  });
});
