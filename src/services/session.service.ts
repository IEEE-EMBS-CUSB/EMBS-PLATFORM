import * as store from "@/db/store";
import type { MembershipRole } from "@/lib/auth-helpers";
import type {
  AccessKeyStatus,
  AccessKeyVerificationResult,
  ParticipantType,
  SessionUser,
} from "@/types";

export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

interface AccessKeyRecord {
  accessKey: string;
  participantId: string;
  participantType: ParticipantType;
  status: AccessKeyStatus;
  keyVersion: number;
}

const STATIC_ACCESS_KEYS: readonly AccessKeyRecord[] = [
  {
    accessKey: "EMBS-MEM-2026-SALMA",
    participantId: "mem-101",
    participantType: "member",
    status: "active",
    keyVersion: 2,
  },
  {
    accessKey: "EMBS-MEM-2026-OMAR",
    participantId: "mem-102",
    participantType: "member",
    status: "active",
    keyVersion: 1,
  },
  {
    accessKey: "EMBS-MEM-2026-NOUR",
    participantId: "mem-103",
    participantType: "member",
    status: "active",
    keyVersion: 1,
  },
  {
    accessKey: "EMBS-ATT-2026-MARIAM",
    participantId: "att-201",
    participantType: "attendee",
    status: "active",
    keyVersion: 1,
  },
  {
    accessKey: "EMBS-ATT-2026-YOUSSEF",
    participantId: "att-202",
    participantType: "attendee",
    status: "active",
    keyVersion: 1,
  },
  {
    accessKey: "EMBS-MEM-2026-REVOKED",
    participantId: "mem-101",
    participantType: "member",
    status: "revoked",
    keyVersion: 1,
  },
];

function findActiveAccessKeyVersion(
  participantId: string,
  participantType: ParticipantType
): number | null {
  const hasLegacyRecord = STATIC_ACCESS_KEYS.some(
    (entry) =>
      entry.participantId === participantId &&
      entry.participantType === participantType
  );

  if (!hasLegacyRecord) {
    // Database-backed membership sessions default to active key version 1
    return 1;
  }

  const match = STATIC_ACCESS_KEYS.find(
    (entry) =>
      entry.participantId === participantId &&
      entry.participantType === participantType &&
      entry.status === "active"
  );
  return match ? match.keyVersion : null;
}

function computeExpirationIso(from: Date): string {
  return new Date(from.getTime() + SESSION_DURATION_SECONDS * 1000).toISOString();
}

function resolveParticipantIdentity(
  participantId: string,
  participantType: ParticipantType
): { displayId: string; fullName: string } | null {
  if (participantType === "member") {
    const member = store.getMemberProfile(participantId);
    return member
      ? {
          displayId: member.displayId,
          fullName: member.fullName,
        }
      : null;
  }

  const attendee = store.getAttendeeProfile(participantId);
  return attendee
    ? {
        displayId: attendee.displayId,
        fullName: attendee.fullName,
      }
    : null;
}

function createOpaqueSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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

  const record = STATIC_ACCESS_KEYS.find(
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

  return Buffer.from(payload, "utf8").toString("base64url");
}

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
