import { normalizeEmail } from "@/lib/auth-helpers";

/**
 * Normalizes a phone number into canonical E.164 format (`+<digits>`).
 * - Accepts spaces, hyphens, parentheses, and dots as formatting characters.
 * - Converts Egyptian local mobile numbers (`010/011/012/015` + 8 digits, 11 digits total)
 *   into `+201XXXXXXXXX` so Cairo University members can type local numbers naturally.
 * - Converts `00`-prefixed international dialing format into `+<digits>`.
 * - Converts bare `201XXXXXXXXX` (12 digits) into `+201XXXXXXXXX`.
 * - Enforces E.164 digit length bounds (8..15 digits) and rejects letters/symbols.
 */
export function normalizePhoneNumber(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Allow only digits, leading +, spaces, hyphens, parentheses, and dots
  if (!/^[+\d\s().-]+$/.test(trimmed)) {
    return null;
  }

  const hasPlus = trimmed.startsWith("+");
  // Reject '+' appearing anywhere other than the start
  if (trimmed.indexOf("+", 1) !== -1) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  let canonicalDigits: string;

  if (hasPlus) {
    // International E.164: must not start with 0 after '+'
    if (digits.startsWith("0")) return null;
    canonicalDigits = digits;
  } else if (digits.startsWith("00")) {
    const stripped = digits.slice(2);
    if (!stripped || stripped.startsWith("0")) return null;
    canonicalDigits = stripped;
  } else if (/^01[0125]\d{8}$/.test(digits)) {
    // Egyptian local 11-digit mobile (010, 011, 012, 015)
    canonicalDigits = `20${digits.slice(1)}`;
  } else if (/^201[0125]\d{8}$/.test(digits)) {
    // Egyptian mobile with country code but without leading '+'
    canonicalDigits = digits;
  } else {
    // Reject ambiguous local numbers without country code unless E.164 length and non-zero start
    if (digits.startsWith("0")) return null;
    canonicalDigits = digits;
  }

  if (canonicalDigits.length < 8 || canonicalDigits.length > 15) {
    return null;
  }

  return `+${canonicalDigits}`;
}

/**
 * Builds a direct WhatsApp click-to-chat URL (`https://wa.me/<digits>`).
 * Returns null if the phone number is empty or invalid.
 */
export function buildWhatsAppUrl(
  phoneNumber: string | null | undefined
): string | null {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;
  return `https://wa.me/${normalized.slice(1)}`;
}

/**
 * Formats a normalized phone number for readable UI display.
 * Egyptian numbers (`+201XXXXXXXXX`) render as `+20 1XX XXX XXXX`.
 */
export function formatPhoneDisplay(
  phoneNumber: string | null | undefined
): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return phoneNumber?.trim() ?? "";
  if (/^\+201[0125]\d{8}$/.test(normalized)) {
    const local = normalized.slice(3); // 10 digits: 1XX XXX XXXX
    return `+20 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return normalized;
}

export type ParsedLoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

/**
 * Parses a login identifier as either an email address or a canonical E.164 phone number.
 */
export function parseLoginIdentifier(
  raw: string | null | undefined
): ParsedLoginIdentifier | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const email = normalizeEmail(trimmed);
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain || !domain.includes(".")) {
      return null;
    }
    return { kind: "email", value: email };
  }

  const phone = normalizePhoneNumber(trimmed);
  if (phone) {
    return { kind: "phone", value: phone };
  }

  return null;
}
