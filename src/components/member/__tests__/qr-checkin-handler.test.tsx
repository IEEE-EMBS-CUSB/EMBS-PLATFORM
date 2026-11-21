import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QrCheckinHandler } from "@/components/member/qr-checkin-handler";
import { buildCheckinQrUrl } from "@/lib/checkin-url";

describe("QR Check-in deep-link flow", () => {
  afterEach(() => {
    cleanup();
  });

  it("builds a full /checkin?code=... URL for QR codes", () => {
    expect(buildCheckinQrUrl("https://embs.vercel.app", "847291")).toBe(
      "https://embs.vercel.app/checkin?code=847291"
    );
  });

  it("auto-submits scanned session code on mount and redirects to the user's attendance page", async () => {
    const onCheckin = vi.fn().mockResolvedValue({
      ok: true,
      sessionTitle: "AI Workshop #3",
      pointsAwarded: 15,
      isPunctual: true,
    });
    const onNavigate = vi.fn();

    render(
      <QrCheckinHandler
        initialCode="847291"
        destinationPath="/member/attendance"
        onCheckin={onCheckin}
        onNavigate={onNavigate}
      />
    );

    await waitFor(() => {
      expect(onCheckin).toHaveBeenCalledTimes(1);
      expect(onCheckin).toHaveBeenCalledWith("847291");
    });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(
        "/member/attendance?checkedIn=AI+Workshop+%233&points=15&punctual=1"
      );
    });
  });

  it("allows inline retry with a fresh code if the scanned code expired while logging in", async () => {
    const user = userEvent.setup();
    const onCheckin = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: "Invalid check-in code or check-in is not currently open.",
      })
      .mockResolvedValueOnce({
        ok: true,
        sessionTitle: "AI Workshop #3",
        pointsAwarded: 10,
        isPunctual: false,
      });
    const onNavigate = vi.fn();

    render(
      <QrCheckinHandler
        initialCode="111111"
        destinationPath="/member/attendance"
        onCheckin={onCheckin}
        onNavigate={onNavigate}
      />
    );

    expect(
      await screen.findByText(/invalid check-in code/i)
    ).toBeInTheDocument();

    const input = screen.getByLabelText(/6-digit check-in code/i);
    await user.clear(input);
    await user.type(input, "999888");
    await user.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(onCheckin).toHaveBeenLastCalledWith("999888");
      expect(onNavigate).toHaveBeenCalledWith(
        "/member/attendance?checkedIn=AI+Workshop+%233&points=10&punctual=0"
      );
    });
  });
});
