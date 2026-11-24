import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../login-form";

describe("LoginForm (Pre-assigned Password & First-Login Reset)", () => {
  it("renders email and password inputs without public self-registration", () => {
    render(<LoginForm />);

    expect(
      screen.getByRole("heading", { name: /sign in to chapter portal/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();

    // Verify zero open registration links and no technical implementation copy
    expect(screen.queryByText(/sign up|create account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/zero emails sent/i)).not.toBeInTheDocument();
  });

  it("transitions to 'Set Permanent Password' screen on first login when mustChangePassword is true", async () => {
    const user = userEvent.setup();
    const handleLogin = vi.fn().mockResolvedValue({
      ok: true,
      mustChangePassword: true,
    });

    render(<LoginForm onLogin={handleLogin} />);

    await user.type(screen.getByLabelText(/email address/i), "salma@cu.edu.eg");
    await user.type(screen.getByLabelText(/^password/i), "EMBS-2026-TEMP");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(handleLogin).toHaveBeenCalledWith("salma@cu.edu.eg", "EMBS-2026-TEMP");
    expect(
      screen.getByText(/first time sign-in/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/new permanent password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it("completes first-login password change and triggers portal entry", async () => {
    const user = userEvent.setup();
    const handleLogin = vi.fn().mockResolvedValue({
      ok: true,
      mustChangePassword: true,
    });
    const handleChangePassword = vi.fn().mockResolvedValue({
      ok: true,
      redirectTo: "/hr",
    });

    render(
      <LoginForm
        onLogin={handleLogin}
        onChangePassword={handleChangePassword}
      />
    );

    // Initial sign-in
    await user.type(screen.getByLabelText(/email address/i), "salma@cu.edu.eg");
    await user.type(screen.getByLabelText(/^password/i), "EMBS-2026-TEMP");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Set new password
    await user.type(
      screen.getByLabelText(/new permanent password/i),
      "MySecretNewPassword2026!"
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "MySecretNewPassword2026!"
    );
    await user.click(
      screen.getByRole("button", { name: /save password & enter portal/i })
    );

    expect(handleChangePassword).toHaveBeenCalledWith(
      "salma@cu.edu.eg",
      "EMBS-2026-TEMP",
      "MySecretNewPassword2026!"
    );
  });

  it("displays error message when invalid credentials or non-whitelisted email is provided", async () => {
    const user = userEvent.setup();
    const handleLogin = vi.fn().mockResolvedValue({
      ok: false,
      error: "Invalid email or password.",
    });

    render(<LoginForm onLogin={handleLogin} />);

    await user.type(screen.getByLabelText(/email address/i), "stranger@gmail.com");
    await user.type(screen.getByLabelText(/^password/i), "WrongPassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it("replaces raw minified React server errors with a friendly alert message", async () => {
    const user = userEvent.setup();
    const handleLogin = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Minified React error #441; visit https://react.dev/errors/441 for the full message"
        )
      );

    render(<LoginForm onLogin={handleLogin} />);

    await user.type(screen.getByLabelText(/email address/i), "master@cu.edu.eg");
    await user.type(screen.getByLabelText(/^password/i), "SomePassword123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.queryByText(/minified react error/i)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to complete sign-in/i
    );
  });

  it("shows attendance check-in context and forwards nextPath on login", async () => {
    const user = userEvent.setup();
    const handleLogin = vi.fn().mockResolvedValue({
      ok: true,
      mustChangePassword: false,
      redirectTo: "/checkin?code=847291",
    });

    render(
      <LoginForm
        nextPath="/checkin?code=847291"
        onLogin={handleLogin}
      />
    );

    expect(
      screen.getByText(/sign in to record your attendance/i)
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), "salma@cu.edu.eg");
    await user.type(screen.getByLabelText(/^password/i), "MyPassword123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(handleLogin).toHaveBeenCalledWith(
      "salma@cu.edu.eg",
      "MyPassword123!",
      "/checkin?code=847291"
    );
  });
});
