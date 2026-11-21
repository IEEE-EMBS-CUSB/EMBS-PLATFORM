/**
 * Builds the deep-link URL embedded in projected session QR codes.
 */
export function buildCheckinQrUrl(origin: string, code: string): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/checkin?code=${encodeURIComponent(code.trim())}`;
}

/**
 * Validates a post-login redirect target so open-redirect attacks are impossible.
 * Only relative app paths starting with a single `/` are accepted.
 */
export function sanitizeNextPath(next?: string | null): string | null {
  if (!next || typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\") || /[\r\n\0]/.test(trimmed)) return null;
  // Prevent redirecting back to auth pages in a loop
  if (trimmed === "/login" || trimmed.startsWith("/login?")) return null;
  return trimmed;
}
