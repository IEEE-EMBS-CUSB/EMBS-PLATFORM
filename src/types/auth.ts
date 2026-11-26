import type { ParticipantType } from "./common";
import type { MembershipRole } from "@/lib/auth-helpers";

export type AccessKeyStatus = "active" | "revoked";

/**
 * Authenticated session identity exposed to server layouts and portal views.
 * Never includes the raw access key credential.
 */
export interface SessionUser {
  sessionId: string;
  personId: string;
  participantId: string;
  displayId: string;
  fullName: string;
  participantType: ParticipantType;
  membershipRole?: MembershipRole;
  trackedCommitteeId?: string | null;
  keyVersion: number;
  issuedAt: string;
  expiresAt: string;
}

export type AccessKeyErrorCode = "EMPTY_KEY" | "INVALID_KEY" | "REVOKED_KEY";

export type AccessKeyVerificationResult =
  | {
      ok: true;
      user: SessionUser;
      redirectTo: "/member" | "/attendee";
    }
  | {
      ok: false;
      code: AccessKeyErrorCode;
      message: string;
    };
