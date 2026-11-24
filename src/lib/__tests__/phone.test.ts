import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  formatPhoneDisplay,
  normalizePhoneNumber,
  parseLoginIdentifier,
} from "@/lib/phone";

describe("Phone number normalization, WhatsApp URLs, and login identifier parsing", () => {
  it("normalizes Egyptian local and international formats to canonical E.164", () => {
    expect(normalizePhoneNumber("01012345678")).toBe("+201012345678");
    expect(normalizePhoneNumber("011 2345 6789")).toBe("+201123456789");
    expect(normalizePhoneNumber("012-3456-7890")).toBe("+201234567890");
    expect(normalizePhoneNumber("01598765432")).toBe("+201598765432");
    expect(normalizePhoneNumber("+20 101 234 5678")).toBe("+201012345678");
    expect(normalizePhoneNumber("201012345678")).toBe("+201012345678");
    expect(normalizePhoneNumber("00201012345678")).toBe("+201012345678");
  });

  it("normalizes non-Egyptian international E.164 numbers and rejects invalid strings", () => {
    expect(normalizePhoneNumber("+1 (415) 555-0199")).toBe("+14155550199");
    expect(normalizePhoneNumber("0044 7911 123456")).toBe("+447911123456");

    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("   ")).toBeNull();
    expect(normalizePhoneNumber("12345")).toBeNull();
    expect(normalizePhoneNumber("010abc45678")).toBeNull();
    expect(normalizePhoneNumber("+12345678901234567")).toBeNull();
  });

  it("builds direct wa.me WhatsApp message links without leading plus", () => {
    expect(buildWhatsAppUrl("01012345678")).toBe("https://wa.me/201012345678");
    expect(buildWhatsAppUrl("+20 112 345 6789")).toBe("https://wa.me/201123456789");
    expect(buildWhatsAppUrl("+1 (415) 555-0199")).toBe("https://wa.me/14155550199");
    expect(buildWhatsAppUrl("invalid")).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
  });

  it("formats Egyptian and international phone numbers cleanly for display", () => {
    expect(formatPhoneDisplay("+201012345678")).toBe("+20 101 234 5678");
    expect(formatPhoneDisplay("01012345678")).toBe("+20 101 234 5678");
    expect(formatPhoneDisplay("+14155550199")).toBe("+14155550199");
  });

  it("parses login identifiers as either normalized email or canonical phone number", () => {
    expect(parseLoginIdentifier("  Salma@CU.edu.eg ")).toEqual({
      kind: "email",
      value: "salma@cu.edu.eg",
    });
    expect(parseLoginIdentifier("010 1234 5678")).toEqual({
      kind: "phone",
      value: "+201012345678",
    });
    expect(parseLoginIdentifier("+201012345678")).toEqual({
      kind: "phone",
      value: "+201012345678",
    });
    expect(parseLoginIdentifier("not-an-email-or-phone")).toBeNull();
    expect(parseLoginIdentifier("")).toBeNull();
  });
});
