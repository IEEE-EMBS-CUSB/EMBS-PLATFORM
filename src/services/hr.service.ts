import crypto from "crypto";
import { normalizeEmail, type MembershipRole } from "@/lib/auth-helpers";

export interface ParsedCsvRosterRecord {
  fullName: string;
  email: string;
  committeeSlug: string | null;
  role: MembershipRole;
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

    const [fullName, rawEmail, rawSlug, rawRole] = parts;

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
  fullName: string;
  committeeId: string | null;
  committeeSlug: string | null;
  committeeName: string | null;
  role: string;
}

export interface LedgerPointRef {
  membershipId: string;
  points: number;
}

export interface PreviousRankRef {
  memberId: string;
  rank: number;
}

export interface PreviousSnapshotRef {
  overall?: PreviousRankRef[];
  committees?: Record<string, PreviousRankRef[]>;
}

export interface CalculatedSnapshotEntry {
  rank: number;
  previousRank: number | null;
  memberId: string;
  memberName: string;
  committeeSlug: string;
  committeeName: string;
  role: string;
  monthlyScore: number;
}

export interface DraftSnapshotResult {
  month: string;
  overallEntries: CalculatedSnapshotEntry[];
  committeeEntries: Record<string, CalculatedSnapshotEntry[]>;
}

/**
 * Calculates a draft monthly snapshot from score ledger points,
 * computing overall ranks and committee-local rank movement trends.
 */
export function calculateDraftMonthlySnapshot(input: {
  month: string;
  members: MemberRef[];
  ledgerEntries: LedgerPointRef[];
  previousSnapshot?: PreviousSnapshotRef;
}): DraftSnapshotResult {
  const { month, members, ledgerEntries, previousSnapshot } = input;

  // Aggregate current month points per member
  const pointsMap = new Map<string, number>();
  for (const entry of ledgerEntries) {
    pointsMap.set(
      entry.membershipId,
      (pointsMap.get(entry.membershipId) ?? 0) + entry.points
    );
  }

  // Build member score list
  const memberScores = members.map((m) => ({
    memberId: m.id,
    memberName: m.fullName,
    committeeSlug: m.committeeSlug ?? "unassigned",
    committeeName: m.committeeName ?? "Unassigned",
    role: m.role,
    monthlyScore: pointsMap.get(m.id) ?? 0,
  }));

  // Sort overall descending by score
  memberScores.sort((a, b) => {
    if (b.monthlyScore !== a.monthlyScore) {
      return b.monthlyScore - a.monthlyScore;
    }
    return a.memberName.localeCompare(b.memberName);
  });

  const prevOverallMap = new Map<string, number>();
  if (previousSnapshot?.overall) {
    for (const prev of previousSnapshot.overall) {
      prevOverallMap.set(prev.memberId, prev.rank);
    }
  }

  const overallEntries: CalculatedSnapshotEntry[] = memberScores
    .slice(0, 10)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      previousRank: prevOverallMap.get(item.memberId) ?? null,
    }));

  // Build committee-specific leaderboards
  const committeeEntries: Record<string, CalculatedSnapshotEntry[]> = {};
  const committeeGroups = new Map<string, typeof memberScores>();

  for (const member of memberScores) {
    if (member.committeeSlug === "unassigned") continue;
    const group = committeeGroups.get(member.committeeSlug) ?? [];
    group.push(member);
    committeeGroups.set(member.committeeSlug, group);
  }

  for (const [slug, group] of committeeGroups.entries()) {
    // Sort group descending
    group.sort((a, b) => {
      if (b.monthlyScore !== a.monthlyScore) {
        return b.monthlyScore - a.monthlyScore;
      }
      return a.memberName.localeCompare(b.memberName);
    });

    const prevCommMap = new Map<string, number>();
    if (previousSnapshot?.committees?.[slug]) {
      for (const prev of previousSnapshot.committees[slug]) {
        prevCommMap.set(prev.memberId, prev.rank);
      }
    }

    committeeEntries[slug] = group.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      previousRank: prevCommMap.get(item.memberId) ?? null,
    }));
  }

  return {
    month,
    overallEntries,
    committeeEntries,
  };
}
