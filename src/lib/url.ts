/**
 * Validates that a URL uses an explicit http:// or https:// scheme.
 * Safe for use in both client and server modules to guard external links.
 */
export function isSafeHttpUrl(rawUrl: string | null | undefined): rawUrl is string {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
