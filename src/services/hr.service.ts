import crypto from "crypto";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";
import {
  computeMonthlyBoards,
  type LedgerPostingScope,
} from "@/services/scoring.service";

export interface ParsedCsvRosterRecord {
  fullName: string;
  email: string;
  committeeSlug: string | null;
  role: MembershipRole;
  phoneNumber?: string | null;
}

export interface CsvLineError {
  line: number;
  message: string;
}

export interface CsvRosterParseResult {
  validRecords: ParsedCsvRosterRecord[];
  errors: CsvLineError[];
}

const VALID_ROLES = new Set<MembershipRole>([
  "master_admin",
  "director",
  "hr_admin",
  "hr_member",
  "committee_head",
  "member",
  "attendee",
]);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
export function parseRosterCsv(csvContent: string): CsvRosterParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const validRecords: ParsedCsvRosterRecord[] = [];
  const errors: CsvLineError[] = [];

  if (lines.length === 0) {
    return { validRecords, errors };
  }

  // Header detection
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("email") || firstLine.includes("full_name");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const startLineNum = hasHeader ? 2 : 1;

  dataLines.forEach((line, idx) => {
    const lineNum = startLineNum + idx;
    const parts = parseCsvLine(line);

    if (parts.length < 4) {
      errors.push({
        line: lineNum,
        message:
          "Incomplete line. Expected 4 columns: full_name, email, committee_slug, role.",
      });
      return;
    }

    const [fullName, rawEmail, rawSlug, rawRole, rawPhone] = parts;

    if (!fullName) {
      errors.push({ line: lineNum, message: "Missing full_name." });
      return;
    }

    if (!rawEmail || !rawEmail.includes("@")) {
      errors.push({ line: lineNum, message: "Missing or invalid email." });
      return;
    }

    const role = rawRole.toLowerCase() as MembershipRole;
    if (!VALID_ROLES.has(role)) {
      errors.push({
        line: lineNum,
        message: `Invalid role "${rawRole}". Expected one of: master_admin, director, hr_admin, hr_member, committee_head, member, attendee.`,
      });
      return;
    }

    validRecords.push({
      fullName,
      email: normalizeEmail(rawEmail),
      committeeSlug: rawSlug && rawSlug.length > 0 ? rawSlug.toLowerCase() : null,
      role,
      ...(rawPhone && rawPhone.trim().length > 0
        ? { phoneNumber: rawPhone.trim() }
        : {}),
    });
  });

  return { validRecords, errors };
}

/**
 * Generates an expiring 6-digit numeric check-in code for a live QR check-in session.
 */
export function generateSessionCheckinCode(expiryMinutes = 15): {
  code: string;
  expiresAt: Date;
} {
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return { code, expiresAt };
}

export interface MemberRef {
  id: string;
  personId?: string;
  fullName: string;
  committeeId: string | null;
  committeeSlug: string | null;
  committeeName: string | null;
  role: string;
}

export interface LedgerPointRef {
  membershipId: string;
  personId?: string;
  postingScope?: LedgerPostingScope;
  committeeId?: string | null;
  points: number;
}

export interface PreviousRankRef {
  memberId: string;
  personId?: string;
  rank: number;
}

export interface PreviousSnapshotRef {
  committees?: Record<string, PreviousRankRef[]>;
}

export interface CalculatedSnapshotEntry {
  rank: number;
  previousRank: number | null;
  memberId: string;
  personId?: string;
  memberName: string;
  committeeSlug: string;
  committeeName: string;
  role: string;
  monthlyScore: number;
}

export interface DraftSnapshotResult {
  month: string;
  committeeEntries: Record<string, CalculatedSnapshotEntry[]>;
}

/**
 * Calculates a draft monthly snapshot from score ledger points using the
 * per-committee Spec §4 scoring engine (members & HR members only).
 */
export function calculateDraftMonthlySnapshot(input: {
  month: string;
  members: MemberRef[];
  ledgerEntries: LedgerPointRef[];
  previousSnapshot?: PreviousSnapshotRef;
}): DraftSnapshotResult {
  const { month, members, ledgerEntries, previousSnapshot } = input;
  return computeMonthlyBoards({
    month,
    members: members.map((m) => ({
      ...m,
      personId: m.personId ?? m.id,
    })),
    ledgerEntries,
    previousSnapshot,
  });
}
