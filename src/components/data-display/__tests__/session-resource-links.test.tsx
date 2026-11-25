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
        locationUrl="javascript:alert(3)"
      />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders offline location address and map link cleanly", () => {
    render(
      <SessionResourceLinks
        sessionMode="offline"
        slideDeckUrl="https://docs.google.com/presentation/d/offline-slides"
        locationUrl="https://maps.google.com/?q=Cairo+University"
        locationAddress="Faculty of Engineering, Building B, Room 204"
      />
    );

    const mapLink = screen.getByRole("link", {
      name: /faculty of engineering, building b, room 204/i,
    });
    expect(mapLink).toHaveAttribute(
      "href",
      "https://maps.google.com/?q=Cairo+University"
    );
    expect(mapLink).toHaveAttribute("target", "_blank");
    expect(mapLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders offline address text as a non-link label when no map link is provided", () => {
    render(
      <SessionResourceLinks
        sessionMode="offline"
        locationAddress="Main Campus Auditorium"
      />
    );

    expect(screen.getByText("Main Campus Auditorium")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
