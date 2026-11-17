import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessKeyForm } from "@/components/auth/access-key-form";
import * as navigation from "@/lib/navigation";

describe("AccessKeyForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("renders a single clean access-key field without email, password, manual role selector, or filler copy", () => {
    render(<AccessKeyForm />);

    expect(screen.getByLabelText(/^access key$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/shared lab computer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/30 days/i)).not.toBeInTheDocument();
  });

  it("submits via POST /api/session, never writes to browser storage, and performs a full navigation on success", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          participantType: "member",
          redirectTo: "/member",
          user: { fullName: "Salma El-Sayed", participantType: "member" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const navSpy = vi
      .spyOn(navigation, "navigateHard")
      .mockImplementation(() => {});

    render(<AccessKeyForm />);
    await user.type(
      screen.getByLabelText(/^access key$/i),
      "EMBS-MEM-2026-SALMA"
    );
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(await screen.findByText(/welcome, salma/i)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(navSpy).toHaveBeenCalledWith("/member");
  });

  it("displays an accessible error alert when the access key is revoked", async () => {
    const user = userEvent.setup();
    const navSpy = vi
      .spyOn(navigation, "navigateHard")
      .mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          code: "REVOKED_KEY",
          message:
            "This access key has been revoked. Request your regenerated key from HR.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    );

    render(<AccessKeyForm />);
    await user.type(
      screen.getByLabelText(/^access key$/i),
      "EMBS-MEM-2026-REVOKED"
    );
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/revoked/i);
    expect(navSpy).not.toHaveBeenCalled();
  });

  it("handles non-JSON 500 server responses gracefully without crashing", async () => {
    const user = userEvent.setup();
    const navSpy = vi
      .spyOn(navigation, "navigateHard")
      .mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    render(<AccessKeyForm />);
    await user.type(
      screen.getByLabelText(/^access key$/i),
      "EMBS-MEM-2026-SALMA"
    );
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /verification service error/i
    );
    expect(navSpy).not.toHaveBeenCalled();
  });
});
