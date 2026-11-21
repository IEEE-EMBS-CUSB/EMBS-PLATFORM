import crypto from "node:crypto";
import type { MembershipRole } from "@/lib/auth-helpers";
import type { ParticipantType, SessionUser } from "@/types";

export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

const DEV_FALLBACK_SESSION_SECRET = "embs-cusb-local-dev-session-secret-do-not-use-in-prod";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET (at least 16 characters) must be configured in production."
    );
  }
  return DEV_FALLBACK_SESSION_SECRET;
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
}

function verifySignature(payloadB64: string, signatureB64: string): boolean {
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signatureB64, "base64url");
  } catch {
    return false;
  }
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

function computeExpirationIso(from: Date): string {
  return new Date(from.getTime() + SESSION_DURATION_SECONDS * 1000).toISOString();
}

function createOpaqueSessionId(): string {
  return crypto.randomUUID();
}

export function createSessionForMember(member: {
  id: string;
  fullName: string;
  role: string;
}): SessionUser {
  const now = new Date();
  const participantType: ParticipantType =
    member.role === "attendee" ? "attendee" : "member";

  return {
    sessionId: createOpaqueSessionId(),
    participantId: member.id,
    displayId: member.id.slice(0, 8),
    fullName: member.fullName,
    participantType,
    membershipRole: member.role as MembershipRole,
    keyVersion: 1,
    issuedAt: now.toISOString(),
    expiresAt: computeExpirationIso(now),
  };
}

export function encodeSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    sid: user.sessionId,
    pid: user.participantId,
    did: user.displayId,
    name: user.fullName,
    role: user.participantType,
    mrole: user.membershipRole,
    kv: user.keyVersion,
    iat: user.issuedAt,
    exp: user.expiresAt,
  });

  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signatureB64 = signPayload(payloadB64);
  return `${payloadB64}.${signatureB64}`;
}

export function decodeSessionToken(
  token: string,
  now: Date = new Date()
): SessionUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  if (!verifySignature(payloadB64, signatureB64)) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (
      typeof parsed.sid !== "string" ||
      typeof parsed.pid !== "string" ||
      typeof parsed.did !== "string" ||
      typeof parsed.name !== "string" ||
      (parsed.role !== "member" && parsed.role !== "attendee") ||
      typeof parsed.kv !== "number" ||
      typeof parsed.iat !== "string" ||
      typeof parsed.exp !== "string"
    ) {
      return null;
    }

    const expiresAtMs = Date.parse(parsed.exp);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
      return null;
    }

    return {
      sessionId: parsed.sid,
      participantId: parsed.pid,
      displayId: parsed.did,
      fullName: parsed.name,
      participantType: parsed.role,
      membershipRole:
        typeof parsed.mrole === "string"
          ? (parsed.mrole as MembershipRole)
          : undefined,
      keyVersion: parsed.kv,
      issuedAt: parsed.iat,
      expiresAt: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function renewSessionUser(
  user: SessionUser,
  now: Date = new Date()
): SessionUser {
  return {
    ...user,
    expiresAt: computeExpirationIso(now),
  };
}
