export type LedgerPostingScope = "committee" | "open";

export interface ScoringMembershipRef {
  id: string;
  personId: string;
  fullName: string;
  role: string;
  committeeId: string | null;
  committeeSlug: string | null;
  committeeName: string | null;
}

export interface ScoringLedgerRow {
  membershipId: string;
  personId?: string;
  postingScope?: LedgerPostingScope;
  committeeId?: string | null;
  points: number;
}

export interface PreviousBoardRankRef {
  memberId: string;
  personId?: string;
  rank: number;
}

export interface PreviousBoardsSnapshotRef {
  committees?: Record<string, PreviousBoardRankRef[]>;
}

export interface BoardStandingEntry {
  rank: number;
  previousRank: number | null;
  memberId: string;
  personId: string;
  memberName: string;
  committeeSlug: string;
  committeeName: string;
  role: string;
  monthlyScore: number;
}

export interface ComputedMonthlyBoards {
  month: string;
  committeeEntries: Record<string, BoardStandingEntry[]>;
}

const BOARD_ROLE_PRIORITY: Record<string, number> = {
  hr_member: 1,
  "HR Member": 1,
  member: 2,
  Member: 2,
};

const HR_COMMITTEE_SLUG = "human-resources";

/**
 * Per-committee leaderboards include regular members and HR members only,
 * filtering out committee heads, HR admins, directors, master admins, and attendees.
 */
export function isCommitteeBoardEligibleRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return (
    normalized === "member" ||
    normalized === "hr_member" ||
    normalized === "hr member"
  );
}

/**
 * HR members are ranked ONLY on the Human Resources committee board,
 * never on another (e.g. tracked/assigned) committee board.
 */
export function isHrMemberEligibleForCommittee(
  role: string,
  committeeSlug: string
): boolean {
  const normalized = role.trim().toLowerCase();
  if (normalized === "hr_member" || normalized === "hr member") {
    return committeeSlug === HR_COMMITTEE_SLUG;
  }
  return true;
}

function sortScoreDescending(
  a: { monthlyScore: number; memberName: string },
  b: { monthlyScore: number; memberName: string }
): number {
  if (b.monthlyScore !== a.monthlyScore) {
    return b.monthlyScore - a.monthlyScore;
  }
  return a.memberName.localeCompare(b.memberName);
}

function buildPreviousRankLookup(
  refs?: PreviousBoardRankRef[]
): { byPerson: Map<string, number>; byMember: Map<string, number> } {
  const byPerson = new Map<string, number>();
  const byMember = new Map<string, number>();
  if (!refs) return { byPerson, byMember };

  for (const r of refs) {
    byMember.set(r.memberId, r.rank);
    if (r.personId) {
      byPerson.set(r.personId, r.rank);
    }
  }
  return { byPerson, byMember };
}

/**
 * Computes per-committee leaderboards strictly following Spec §4:
 * - Includes `member` and `hr_member` memberships only (filtering out `committee_head`,
 *     `hr_admin`, `director`, `master_admin`, and `attendee`).
 * - `hr_member` memberships are ranked exclusively on the `human-resources` committee board,
 *     never on tracked/assigned committees.
 * - Per-committee board C counts each eligible person in committee C ONCE with:
 *     (person's committee-scoped ledger points for committee C) + (person's open ledger points).
 * - Open/global points count ONCE per eligible committee board even for multi-hat persons.
 */
export function computeMonthlyBoards(input: {
  month: string;
  members: readonly ScoringMembershipRef[];
  ledgerEntries: readonly ScoringLedgerRow[];
  previousSnapshot?: PreviousBoardsSnapshotRef;
  topLimit?: number;
}): ComputedMonthlyBoards {
  const { month, members, ledgerEntries, previousSnapshot, topLimit = 10 } =
    input;

  // Keep only member & hr_member hats; hr_member hats are strictly scoped to human-resources
  const eligibleMembers = members.filter(
    (m) =>
      isCommitteeBoardEligibleRole(m.role) &&
      m.committeeId !== null &&
      m.committeeSlug !== null &&
      m.committeeSlug !== "unassigned" &&
      isHrMemberEligibleForCommittee(m.role, m.committeeSlug)
  );

  const membershipById = new Map<string, ScoringMembershipRef>();
  const eligiblePersonIds = new Set<string>();

  for (const m of eligibleMembers) {
    membershipById.set(m.id, m);
    eligiblePersonIds.add(m.personId);
  }

  // Partition ledger points per eligible person:
  // 1. openTotalByPerson: sum of every "open" ledger row once per eligible person
  // 2. committeePointsByPersonAndComm: committee-scoped ledger rows stamped to an eligible membership
  const openTotalByPerson = new Map<string, number>();
  const committeePointsByPersonAndComm = new Map<string, number>();

  for (const entry of ledgerEntries) {
    const stampedMembership = membershipById.get(entry.membershipId);
    const personId = entry.personId ?? stampedMembership?.personId;
    if (!personId || !eligiblePersonIds.has(personId)) {
      continue;
    }

    const resolvedScope: LedgerPostingScope =
      entry.postingScope ??
      (stampedMembership?.committeeId === null ? "open" : "committee");

    if (resolvedScope === "open") {
      openTotalByPerson.set(
        personId,
        (openTotalByPerson.get(personId) ?? 0) + entry.points
      );
    } else if (stampedMembership) {
      const targetCommitteeId =
        entry.committeeId !== undefined
          ? entry.committeeId
          : stampedMembership.committeeId;
      if (targetCommitteeId) {
        const key = `${personId}::${targetCommitteeId}`;
        committeePointsByPersonAndComm.set(
          key,
          (committeePointsByPersonAndComm.get(key) ?? 0) + entry.points
        );
      }
    }
  }

  // Build Per-Committee Boards (one row per distinct eligible person in that committee)
  const committeeMeta = new Map<
    string,
    { id: string; slug: string; name: string }
  >();
  const hatsByCommitteeSlug = new Map<
    string,
    Map<string, ScoringMembershipRef>
  >();

  for (const m of eligibleMembers) {
    const slug = m.committeeSlug!;
    committeeMeta.set(slug, {
      id: m.committeeId!,
      slug,
      name: m.committeeName ?? slug,
    });
    const perPerson =
      hatsByCommitteeSlug.get(slug) ?? new Map<string, ScoringMembershipRef>();
    const existing = perPerson.get(m.personId);
    if (
      !existing ||
      (BOARD_ROLE_PRIORITY[m.role] ?? 99) <
        (BOARD_ROLE_PRIORITY[existing.role] ?? 99)
    ) {
      perPerson.set(m.personId, m);
    }
    hatsByCommitteeSlug.set(slug, perPerson);
  }

  const committeeEntries: Record<string, BoardStandingEntry[]> = {};
  for (const [slug, personHatMap] of hatsByCommitteeSlug.entries()) {
    const meta = committeeMeta.get(slug)!;
    const prevComm = buildPreviousRankLookup(
      previousSnapshot?.committees?.[slug]
    );

    const group: Array<Omit<BoardStandingEntry, "rank" | "previousRank">> = [];
    for (const [personId, hat] of personHatMap.entries()) {
      const committeeScopedPts =
        committeePointsByPersonAndComm.get(`${personId}::${meta.id}`) ?? 0;
      const openPts = openTotalByPerson.get(personId) ?? 0;

      group.push({
        memberId: hat.id,
        personId,
        memberName: hat.fullName,
        committeeSlug: meta.slug,
        committeeName: meta.name,
        role: hat.role,
        monthlyScore: committeeScopedPts + openPts,
      });
    }

    group.sort(sortScoreDescending);
    committeeEntries[slug] = group.slice(0, topLimit).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      previousRank:
        prevComm.byPerson.get(item.personId) ??
        prevComm.byMember.get(item.memberId) ??
        null,
    }));
  }

  return {
    month,
    committeeEntries,
  };
}
