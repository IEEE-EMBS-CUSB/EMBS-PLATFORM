import crypto from "crypto";

/**
 * Hashes a plaintext password using Node's cryptographic scrypt algorithm with a random 16-byte salt.
 * Returns format: `${salt}:${derivedKeyHex}`.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored `${salt}:${key}` hash.
 * Employs timing-safe equality comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, combinedHash?: string | null): boolean {
  if (!combinedHash || !combinedHash.includes(":")) return false;
  const [salt, key] = combinedHash.split(":");
  if (!salt || !key) return false;

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (derivedKey.length !== keyBuffer.length) return false;

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Generates a high-entropy, easy-to-read pre-assigned password for newly added roster members.
 * Format: EMBS-2026-XXXXXXXX (8 chars from unambiguous 32-char alphabet, ~40 bits entropy)
 */
export function generatePreassignedPassword(seasonYear = "2026"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `EMBS-${seasonYear}-${suffix}`;
}

/**
 * Resolves the server-side default temporary password for newly added roster members
 * and HR/Master password resets. Reads `DEFAULT_MEMBER_PASSWORD` at call time so
 * operators can update it via environment configuration without code changes.
 * Falls back to a random pre-assigned password when unset.
 */
export function getDefaultMemberPassword(): string {
  const configured = process.env.DEFAULT_MEMBER_PASSWORD?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }
  return generatePreassignedPassword();
}

/**
 * Validates new password strength when user sets their password on first login.
 */
export function isPasswordStrong(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return {
      valid: false,
      reason: "Password must be at least 8 characters long.",
    };
  }
  return { valid: true };
}
