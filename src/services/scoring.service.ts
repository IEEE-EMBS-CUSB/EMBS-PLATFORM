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
  overall?: PreviousBoardRankRef[];
  committees?: Record<string, PreviousBoardRankRef[]>;
  heads?: PreviousBoardRankRef[];
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
  overallEntries: BoardStandingEntry[];
  committeeEntries: Record<string, BoardStandingEntry[]>;
  headsEntries: BoardStandingEntry[];
}

const BOARD_ROLE_PRIORITY: Record<string, number> = {
  master_admin: 0,
  director: 1,
  hr_admin: 2,
  committee_head: 3,
  Head: 3,
  hr_member: 4,
  member: 5,
  Member: 5,
  attendee: 6,
};

/**
 * Overall chapter rankings include regular members and HR members only,
 * filtering out committee heads, HR admins, directors, master admins, and attendees.
 */
export function isOverallEligibleRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return (
    normalized === "member" ||
    normalized === "hr_member" ||
    normalized === "hr member"
  );
}

export function isHeadRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === "committee_head" || normalized === "head";
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
 * Computes global, per-committee, and heads leaderboards strictly following Spec §4:
 * - Global/Overall board: includes `member` and `hr_member` memberships only (filtering out
 *     `committee_head`, `hr_admin`, `director`, `master_admin`, and `attendee`). Counts each
 *     eligible person ONCE per season/month using their eligible member/hr_member scoped points
 *     plus their open ledger points (never inflated by head/admin hats).
 * - Per-committee board C: counts each eligible person in committee C ONCE with:
 *     (person's committee-scoped ledger points for committee C) + (person's open ledger points).
 * - Heads board: counts each `committee_head` ONCE with head-stamped points + open ledger points.
 * - Open/global points count ONCE globally and ONCE per eligible board even for multi-hat persons.
 * - No board ever sums another board.
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

  // Exclude attendees from standard member global/committee boards (attendee board is Priority 5)
  const eligibleMembers = members.filter((m) => m.role !== "attendee");
  const membershipById = new Map<string, ScoringMembershipRef>();
  const membershipsByPerson = new Map<string, ScoringMembershipRef[]>();
  const overallHatsByPerson = new Map<string, ScoringMembershipRef[]>();

  for (const m of eligibleMembers) {
    membershipById.set(m.id, m);
    const list = membershipsByPerson.get(m.personId) ?? [];
    list.push(m);
    membershipsByPerson.set(m.personId, list);

    if (isOverallEligibleRole(m.role)) {
      const overallList = overallHatsByPerson.get(m.personId) ?? [];
      overallList.push(m);
      overallHatsByPerson.set(m.personId, overallList);
    }
  }

  // Partition ledger points per person:
  // 1. overallScopedPointsByPerson: non-open ledger rows stamped specifically to a member or hr_member membership
  // 2. openTotalByPerson: sum of every "open" ledger row once per person
  // 3. committeePointsByPersonAndComm: committee-scoped ledger rows keyed by `${personId}::${committeeId}`
  // 4. headScopedPointsByPerson: non-open ledger rows stamped specifically to a committee_head membership
  const overallScopedPointsByPerson = new Map<string, number>();
  const openTotalByPerson = new Map<string, number>();
  const committeePointsByPersonAndComm = new Map<string, number>();
  const headScopedPointsByPerson = new Map<string, number>();

  for (const entry of ledgerEntries) {
    const stampedMembership = membershipById.get(entry.membershipId);
    const personId = entry.personId ?? stampedMembership?.personId;
    if (!personId || !membershipsByPerson.has(personId)) {
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
    } else {
      const targetCommitteeId =
        entry.committeeId !== undefined
          ? entry.committeeId
          : stampedMembership?.committeeId ?? null;
      if (targetCommitteeId) {
        const key = `${personId}::${targetCommitteeId}`;
        committeePointsByPersonAndComm.set(
          key,
          (committeePointsByPersonAndComm.get(key) ?? 0) + entry.points
        );
      }
      if (stampedMembership && isOverallEligibleRole(stampedMembership.role)) {
        overallScopedPointsByPerson.set(
          personId,
          (overallScopedPointsByPerson.get(personId) ?? 0) + entry.points
        );
      }
      if (stampedMembership && isHeadRole(stampedMembership.role)) {
        headScopedPointsByPerson.set(
          personId,
          (headScopedPointsByPerson.get(personId) ?? 0) + entry.points
        );
      }
    }
  }

  // 1. Build Global/Overall Board (one row per distinct person holding a member or hr_member hat)
  const prevOverall = buildPreviousRankLookup(previousSnapshot?.overall);
  const overallRaw: Array<Omit<BoardStandingEntry, "rank" | "previousRank">> =
    [];

  for (const [personId, hats] of overallHatsByPerson.entries()) {
    const primaryHat = [...hats].sort(
      (a, b) =>
        (BOARD_ROLE_PRIORITY[a.role] ?? 99) -
        (BOARD_ROLE_PRIORITY[b.role] ?? 99)
    )[0];
    const overallScopedPts = overallScopedPointsByPerson.get(personId) ?? 0;
    const openPts = openTotalByPerson.get(personId) ?? 0;

    overallRaw.push({
      memberId: primaryHat.id,
      personId,
      memberName: primaryHat.fullName,
      committeeSlug: primaryHat.committeeSlug ?? "unassigned",
      committeeName: primaryHat.committeeName ?? "Unassigned",
      role: primaryHat.role,
      monthlyScore: overallScopedPts + openPts,
    });
  }

  overallRaw.sort(sortScoreDescending);
  const overallEntries: BoardStandingEntry[] = overallRaw
    .slice(0, topLimit)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      previousRank:
        prevOverall.byPerson.get(item.personId) ??
        prevOverall.byMember.get(item.memberId) ??
        null,
    }));

  // 2. Build Per-Committee Boards (one row per distinct person holding an eligible hat in that committee)
  const committeeMeta = new Map<
    string,
    { id: string; slug: string; name: string }
  >();
  const hatsByCommitteeSlug = new Map<
    string,
    Map<string, ScoringMembershipRef>
  >();

  for (const m of eligibleMembers) {
    if (!m.committeeId || !m.committeeSlug || m.committeeSlug === "unassigned") {
      continue;
    }
    committeeMeta.set(m.committeeSlug, {
      id: m.committeeId,
      slug: m.committeeSlug,
      name: m.committeeName ?? m.committeeSlug,
    });
    const perPerson =
      hatsByCommitteeSlug.get(m.committeeSlug) ??
      new Map<string, ScoringMembershipRef>();
    const existing = perPerson.get(m.personId);
    if (
      !existing ||
      (BOARD_ROLE_PRIORITY[m.role] ?? 99) <
        (BOARD_ROLE_PRIORITY[existing.role] ?? 99)
    ) {
      perPerson.set(m.personId, m);
    }
    hatsByCommitteeSlug.set(m.committeeSlug, perPerson);
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

  // 3. Build Heads-Only Board (committee_head memberships only: head-stamped points + open points once per person)
  const headHatByPerson = new Map<string, ScoringMembershipRef>();
  for (const m of eligibleMembers) {
    if (!isHeadRole(m.role)) continue;
    if (!headHatByPerson.has(m.personId)) {
      headHatByPerson.set(m.personId, m);
    }
  }

  const prevHeads = buildPreviousRankLookup(previousSnapshot?.heads);
  const headsRaw: Array<Omit<BoardStandingEntry, "rank" | "previousRank">> = [];
  for (const [personId, hat] of headHatByPerson.entries()) {
    const headScopedPts = headScopedPointsByPerson.get(personId) ?? 0;
    const openPts = openTotalByPerson.get(personId) ?? 0;
    headsRaw.push({
      memberId: hat.id,
      personId,
      memberName: hat.fullName,
      committeeSlug: hat.committeeSlug ?? "unassigned",
      committeeName: hat.committeeName ?? "Unassigned",
      role: hat.role,
      monthlyScore: headScopedPts + openPts,
    });
  }

  headsRaw.sort(sortScoreDescending);
  const headsEntries: BoardStandingEntry[] = headsRaw
    .slice(0, topLimit)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      previousRank:
        prevHeads.byPerson.get(item.personId) ??
        prevHeads.byMember.get(item.memberId) ??
        null,
    }));

  return {
    month,
    overallEntries,
    committeeEntries,
    headsEntries,
  };
}
