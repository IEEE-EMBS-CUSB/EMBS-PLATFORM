import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveCheckinCard } from "@/components/member/live-checkin-card";

describe("LiveCheckinCard Component", () => {
  it("allows member to enter 6-digit code and calls onCheckin", async () => {
    const user = userEvent.setup();
    const handleCheckin = vi.fn().mockResolvedValue({
      ok: true,
      pointsAwarded: 15,
      isPunctual: true,
      sessionTitle: "Deep Learning Workshop",
    });

    render(
      <LiveCheckinCard
        membershipId="mem-123"
        onCheckin={handleCheckin}
      />
    );

    expect(screen.getByText(/Live Session Check-In/i)).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/enter 6-digit check-in code/i);
    await user.type(codeInput, "847291");

    const submitBtn = screen.getByRole("button", { name: /check in/i });
    await user.click(submitBtn);

    expect(handleCheckin).toHaveBeenCalledWith("847291", "mem-123");
    expect(
      await screen.findByText(/checked in to deep learning workshop!/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/\+15 pts awarded/i)).toBeInTheDocument();
  });

  it("displays error message when check-in fails", async () => {
    const user = userEvent.setup();
    const handleCheckin = vi.fn().mockResolvedValue({
      ok: false,
      error: "This check-in window has expired.",
    });

    render(
      <LiveCheckinCard
        membershipId="mem-123"
        onCheckin={handleCheckin}
      />
    );

    const codeInput = screen.getByLabelText(/enter 6-digit check-in code/i);
    await user.type(codeInput, "999999");

    const submitBtn = screen.getByRole("button", { name: /check in/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/this check-in window has expired/i)
    ).toBeInTheDocument();
  });
});
