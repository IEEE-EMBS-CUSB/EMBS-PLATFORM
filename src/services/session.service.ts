import {
  findActiveAccessKeyVersion,
  MOCK_ACCESS_KEYS,
} from "@/data/mock/access-keys";
import { MOCK_ATTENDEES } from "@/data/mock/attendees";
import { MOCK_MEMBERS } from "@/data/mock/members";
import type {
  AccessKeyVerificationResult,
  ParticipantType,
  SessionUser,
} from "@/types";

export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

function computeExpirationIso(from: Date): string {
  return new Date(from.getTime() + SESSION_DURATION_SECONDS * 1000).toISOString();
}

function resolveParticipantIdentity(
  participantId: string,
  participantType: ParticipantType
): { displayId: string; fullName: string } | null {
  if (participantType === "member") {
    const member = MOCK_MEMBERS[participantId];
    return member
      ? {
          displayId: member.profile.displayId,
          fullName: member.profile.fullName,
        }
      : null;
  }

  const attendee = MOCK_ATTENDEES[participantId];
  return attendee
    ? {
        displayId: attendee.profile.displayId,
        fullName: attendee.profile.fullName,
      }
    : null;
}

function createOpaqueSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Simulates server-side access-key verification for the frontend prototype.
 * Identifies participant type automatically and never includes the raw key in the result.
 */
export async function verifyAccessKey(
  rawAccessKey: string,
  now: Date = new Date()
): Promise<AccessKeyVerificationResult> {
  const normalized = rawAccessKey.trim().toUpperCase();

  if (!normalized) {
    return {
      ok: false,
      code: "EMPTY_KEY",
      message: "Enter the access key provided by HR to continue.",
    };
  }

  const record = MOCK_ACCESS_KEYS.find(
    (entry) => entry.accessKey.toUpperCase() === normalized
  );

  if (!record) {
    return {
      ok: false,
      code: "INVALID_KEY",
      message:
        "We could not recognize that access key. Check for typos or contact HR.",
    };
  }

  if (record.status === "revoked") {
    return {
      ok: false,
      code: "REVOKED_KEY",
      message:
        "This access key has been revoked. Request your regenerated key from HR.",
    };
  }

  const identity = resolveParticipantIdentity(
    record.participantId,
    record.participantType
  );

  if (!identity) {
    return {
      ok: false,
      code: "INVALID_KEY",
      message:
        "No portal profile is linked to this access key yet. Please contact HR.",
    };
  }

  const user: SessionUser = {
    sessionId: createOpaqueSessionId(),
    participantId: record.participantId,
    displayId: identity.displayId,
    fullName: identity.fullName,
    participantType: record.participantType,
    keyVersion: record.keyVersion,
    issuedAt: now.toISOString(),
    expiresAt: computeExpirationIso(now),
  };

  return {
    ok: true,
    user,
    redirectTo:
      record.participantType === "member" ? "/member" : "/attendee",
  };
}

/**
 * Encodes a prototype session payload for storage inside an HttpOnly cookie.
 * Stores opaque session metadata only — never the bearer access key.
 */
export function encodeSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    sid: user.sessionId,
    pid: user.participantId,
    did: user.displayId,
    name: user.fullName,
    role: user.participantType,
    kv: user.keyVersion,
    iat: user.issuedAt,
    exp: user.expiresAt,
  });

  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decodes and validates a prototype session token, including expiration
 * and active key-version check so HR revocations invalidate existing sessions.
 */
export function decodeSessionToken(
  token: string,
  now: Date = new Date()
): SessionUser | null {
  if (!token || typeof token !== "string") return null;

  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
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

    const activeVersion = findActiveAccessKeyVersion(parsed.pid, parsed.role);
    if (activeVersion === null || activeVersion !== parsed.kv) {
      return null;
    }

    return {
      sessionId: parsed.sid,
      participantId: parsed.pid,
      displayId: parsed.did,
      fullName: parsed.name,
      participantType: parsed.role,
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
