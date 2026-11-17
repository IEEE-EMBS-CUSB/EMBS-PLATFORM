import type { AccessKeyStatus, ParticipantType } from "@/types";

export interface MockAccessKeyRecord {
  /** Prototype-only bearer key. Never return this in responses, URLs, or client state. */
  accessKey: string;
  participantId: string;
  participantType: ParticipantType;
  status: AccessKeyStatus;
  keyVersion: number;
}

export const MOCK_ACCESS_KEYS: readonly MockAccessKeyRecord[] = [
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
] as const;

export function findActiveAccessKeyVersion(
  participantId: string,
  participantType: ParticipantType
): number | null {
  const active = MOCK_ACCESS_KEYS.find(
    (entry) =>
      entry.participantId === participantId &&
      entry.participantType === participantType &&
      entry.status === "active"
  );
  return active ? active.keyVersion : null;
}
