import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionResourceLinks } from "@/components/data-display/session-resource-links";

describe("SessionResourceLinks", () => {
  it("renders clickable Slide Deck and Web Conferencing links for valid http(s) URLs", () => {
    render(
      <SessionResourceLinks
        slideDeckUrl="https://docs.google.com/presentation/d/abc123"
        webConferencingUrl="https://meet.google.com/abc-defg-hij"
      />
    );

    const slideLink = screen.getByRole("link", { name: /slide deck/i });
    expect(slideLink).toHaveAttribute(
      "href",
      "https://docs.google.com/presentation/d/abc123"
    );
    expect(slideLink).toHaveAttribute("target", "_blank");
    expect(slideLink).toHaveAttribute("rel", "noopener noreferrer");

    const meetingLink = screen.getByRole("link", { name: /join meeting/i });
    expect(meetingLink).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij"
    );
    expect(meetingLink).toHaveAttribute("target", "_blank");
    expect(meetingLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("refuses to render unsafe javascript: or invalid URLs", () => {
    const { container } = render(
      <SessionResourceLinks
        slideDeckUrl="javascript:alert(1)"
        webConferencingUrl="not-a-valid-url"
      />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
