import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { MembershipRole, SeasonStatus } from "@/lib/auth-helpers";
import type { ContextPickerOption } from "@/lib/context-picker";

export type ContextViewMode = "manage" | "personal";

export interface TrackedCommitteeRef {
  id: string;
  name: string;
}

export interface RawContextCandidate {
  membershipId: string;
  personId: string;
  seasonId: string;
  seasonName: string;
  seasonStatus: SeasonStatus;
  seasonStartDate: Date;
  role: MembershipRole;
  committeeId: string | null;
  committeeName: string | null;
  committeeSlug: string | null;
  trackedCommitteeId?: string | null;
  trackedCommitteeName?: string | null;
  trackedCommittees?: TrackedCommitteeRef[];
  managedTrackId: string | null;
  managedTrackName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface EligibleContextOption {
  membershipId: string;
  personId: string;
  seasonId: string;
  seasonName: string;
  seasonStatus: SeasonStatus;
  role: MembershipRole;
  committeeId: string | null;
  committeeName: string | null;
  committeeSlug: string | null;
  trackedCommitteeId?: string | null;
  trackedCommitteeName?: string | null;
  trackedCommittees?: TrackedCommitteeRef[];
  managedTrackId: string | null;
  managedTrackName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export type ContextSwitchResult =
  | {
      ok: true;
      context: EligibleContextOption;
    }
  | {
      ok: false;
      code: "FORBIDDEN";
      error: string;
    };

const ROLE_PRECEDENCE: Record<MembershipRole, number> = {
  master_admin: 0,
  director: 1,
  hr_admin: 2,
  committee_head: 3,
  hr_member: 4,
  member: 5,
  attendee: 6,
};

function compareContextPriority(
  a: Pick<RawContextCandidate, "role" | "createdAt">,
  b: Pick<RawContextCandidate, "role" | "createdAt">
): number {
  const roleDiff =
    (ROLE_PRECEDENCE[a.role] ?? 99) - (ROLE_PRECEDENCE[b.role] ?? 99);
  if (roleDiff !== 0) return roleDiff;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function resolveTrackedCommitteesForContext(
  c: Pick<
    EligibleContextOption,
    "trackedCommitteeId" | "trackedCommitteeName" | "trackedCommittees"
  >
): TrackedCommitteeRef[] {
  if (c.trackedCommittees && c.trackedCommittees.length > 0) {
    return c.trackedCommittees;
  }
  if (c.trackedCommitteeId) {
    return [
      {
        id: c.trackedCommitteeId,
        name: c.trackedCommitteeName ?? "Committee",
      },
    ];
  }
  return [];
}

function toEligibleOption(c: RawContextCandidate): EligibleContextOption {
  const trackedCommittees = resolveTrackedCommitteesForContext(c);
  const primaryTracked = trackedCommittees[0] ?? null;
  return {
    membershipId: c.membershipId,
    personId: c.personId,
    seasonId: c.seasonId,
    seasonName: c.seasonName,
    seasonStatus: c.seasonStatus,
    role: c.role,
    committeeId: c.committeeId,
    committeeName: c.committeeName,
    committeeSlug: c.committeeSlug,
    trackedCommitteeId: primaryTracked?.id ?? c.trackedCommitteeId ?? null,
    trackedCommitteeName:
      primaryTracked?.name ?? c.trackedCommitteeName ?? null,
    trackedCommittees,
    managedTrackId: c.managedTrackId,
    managedTrackName: c.managedTrackName,
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}

/**
 * Filters a person's raw membership rows down to their currently eligible contexts:
 * 1. If the person has any membership row in an active season, ONLY active memberships
 *    in that active season are eligible (deactivated active-season users never fall back to archived).
 * 2. Otherwise, archived-season accounts are locked out once a new season starts — EXCEPT
 *    `master_admin`, who remains exempt via their most recent active archived `master_admin` row.
 * 3. Draft seasons are never eligible.
 */
export function filterEligibleSeasonContexts(
  candidates: readonly RawContextCandidate[]
): EligibleContextOption[] {
  const activeSeasonRows = candidates.filter((c) => c.seasonStatus === "active");
  if (activeSeasonRows.length > 0) {
    return activeSeasonRows
      .filter((c) => c.isActive)
      .sort(compareContextPriority)
      .map(toEligibleOption);
  }

  const archivedMasterActive = candidates.filter(
    (c) =>
      c.seasonStatus === "archived" &&
      c.isActive &&
      c.role === "master_admin"
  );
  if (archivedMasterActive.length === 0) return [];

  const latestStartMs = Math.max(
    ...archivedMasterActive.map((c) => c.seasonStartDate.getTime())
  );
  return archivedMasterActive
    .filter((c) => c.seasonStartDate.getTime() === latestStartMs)
    .sort(compareContextPriority)
    .map(toEligibleOption);
}

/**
 * Selects the initial context for login/fallback:
 * Honors preferredMembershipId ONLY if it is present in the person's eligible contexts;
 * otherwise falls back to the highest-precedence eligible context.
 */
export function selectInitialLoginContext(
  candidates: readonly RawContextCandidate[],
  preferredMembershipId?: string | null
): EligibleContextOption | null {
  const eligible = filterEligibleSeasonContexts(candidates);
  if (eligible.length === 0) return null;

  if (preferredMembershipId) {
    const preferred = eligible.find(
      (c) => c.membershipId === preferredMembershipId
    );
    if (preferred) return preferred;
  }

  return eligible[0];
}

/**
 * Verifies that targetMembershipId is inside the person's server-derived eligible contexts.
 * Never falls back silently on an unauthorized switch attempt.
 */
export function resolveContextSwitch(
  eligibleContexts: readonly EligibleContextOption[],
  targetMembershipId: string,
  targetTrackedCommitteeId?: string | null
): ContextSwitchResult {
  const trimmed = targetMembershipId?.trim() ?? "";
  if (!trimmed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Unauthorized: a valid membership context must be specified.",
    };
  }

  const found = eligibleContexts.find((c) => c.membershipId === trimmed);
  if (!found) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "Unauthorized: you do not hold an active membership for the requested context.",
    };
  }

  const trimmedTracked = targetTrackedCommitteeId?.trim() || null;
  if (found.role === "hr_member") {
    const assigned = resolveTrackedCommitteesForContext(found);
    if (trimmedTracked) {
      const matched = assigned.find((c) => c.id === trimmedTracked);
      if (!matched) {
        return {
          ok: false,
          code: "FORBIDDEN",
          error:
            "Unauthorized: you are not assigned to track the requested committee.",
        };
      }
      return {
        ok: true,
        context: {
          ...found,
          trackedCommitteeId: matched.id,
          trackedCommitteeName: matched.name,
          trackedCommittees: assigned,
        },
      };
    }

    const first = assigned[0] ?? null;
    return {
      ok: true,
      context: {
        ...found,
        trackedCommitteeId: first?.id ?? null,
        trackedCommitteeName: first?.name ?? null,
        trackedCommittees: assigned,
      },
    };
  }

  return { ok: true, context: found };
}

/**
 * Returns the authoritative portal destination for a validated context and optional view mode.
 * Only roles with personal-work access (`committee_head`, `hr_member`, `member`) can land on `/member`.
 */
export function resolveDestinationForContext(
  context: Pick<EligibleContextOption, "role">,
  requestedView?: ContextViewMode
): "/hr" | "/member" | "/attendee" {
  switch (context.role) {
    case "attendee":
      return "/attendee";
    case "member":
      return "/member";
    case "committee_head":
    case "hr_member":
      return requestedView === "personal" ? "/member" : "/hr";
    case "master_admin":
    case "director":
    case "hr_admin":
    default:
      return "/hr";
  }
}

/**
 * Loads all currently eligible membership contexts for an active person from PostgreSQL.
 */
export async function listEligibleContextsForPerson(
  personId: string
): Promise<EligibleContextOption[]> {
  try {
    const [person] = await db
      .select({
        id: schema.persons.id,
        isActive: schema.persons.isActive,
        mustChangePassword: schema.persons.mustChangePassword,
      })
      .from(schema.persons)
      .where(eq(schema.persons.id, personId))
      .limit(1);

    if (!person || !person.isActive) return [];

    const rows = await db
      .select({
        membershipId: schema.rosterMemberships.id,
        personId: schema.rosterMemberships.personId,
        seasonId: schema.rosterMemberships.seasonId,
        seasonName: schema.seasons.name,
        seasonStatus: schema.seasons.status,
        seasonStartDate: schema.seasons.startDate,
        role: schema.rosterMemberships.role,
        committeeId: schema.rosterMemberships.committeeId,
        committeeName: schema.committees.name,
        committeeSlug: schema.committees.slug,
        trackedCommitteeId: schema.rosterMemberships.trackedCommitteeId,
        managedTrackId: schema.rosterMemberships.managedTrackId,
        managedTrackName: schema.committeeTracks.name,
        isActive: schema.rosterMemberships.isActive,
        createdAt: schema.rosterMemberships.createdAt,
      })
      .from(schema.rosterMemberships)
      .innerJoin(
        schema.seasons,
        eq(schema.rosterMemberships.seasonId, schema.seasons.id)
      )
      .leftJoin(
        schema.committees,
        eq(schema.rosterMemberships.committeeId, schema.committees.id)
      )
      .leftJoin(
        schema.committeeTracks,
        eq(schema.rosterMemberships.managedTrackId, schema.committeeTracks.id)
      )
      .where(eq(schema.rosterMemberships.personId, personId));

    const hrMembershipIds = rows
      .filter((r) => r.role === "hr_member")
      .map((r) => r.membershipId);

    const trackedByMembership = new Map<string, TrackedCommitteeRef[]>();
    if (hrMembershipIds.length > 0) {
      const joinRows = await db
        .select({
          membershipId: schema.hrMemberTrackedCommittees.membershipId,
          committeeId: schema.committees.id,
          committeeName: schema.committees.name,
        })
        .from(schema.hrMemberTrackedCommittees)
        .innerJoin(
          schema.committees,
          eq(schema.hrMemberTrackedCommittees.committeeId, schema.committees.id)
        )
        .where(
          inArray(schema.hrMemberTrackedCommittees.membershipId, hrMembershipIds)
        )
        .orderBy(asc(schema.committees.name));

      for (const jr of joinRows) {
        const list = trackedByMembership.get(jr.membershipId) ?? [];
        if (!list.some((item) => item.id === jr.committeeId)) {
          list.push({ id: jr.committeeId, name: jr.committeeName });
        }
        trackedByMembership.set(jr.membershipId, list);
      }
    }

    const legacyTrackedIds = Array.from(
      new Set(
        rows
          .filter(
            (r) =>
              r.trackedCommitteeId &&
              (trackedByMembership.get(r.membershipId)?.length ?? 0) === 0
          )
          .map((r) => r.trackedCommitteeId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const legacyTrackedNameById = new Map<string, string>();
    if (legacyTrackedIds.length > 0) {
      const trackedRows = await db
        .select({ id: schema.committees.id, name: schema.committees.name })
        .from(schema.committees)
        .where(inArray(schema.committees.id, legacyTrackedIds));
      for (const tc of trackedRows) {
        legacyTrackedNameById.set(tc.id, tc.name);
      }
    }

    return filterEligibleSeasonContexts(
      rows.map((r) => {
        const joinTracked = trackedByMembership.get(r.membershipId) ?? [];
        const resolvedTracked: TrackedCommitteeRef[] =
          joinTracked.length > 0
            ? joinTracked
            : r.trackedCommitteeId
              ? [
                  {
                    id: r.trackedCommitteeId,
                    name:
                      legacyTrackedNameById.get(r.trackedCommitteeId) ??
                      "Committee",
                  },
                ]
              : [];
        const primaryTracked = resolvedTracked[0] ?? null;

        return {
          membershipId: r.membershipId,
          personId: r.personId,
          seasonId: r.seasonId,
          seasonName: r.seasonName,
          seasonStatus: r.seasonStatus as SeasonStatus,
          seasonStartDate: r.seasonStartDate,
          role: r.role as MembershipRole,
          committeeId: r.committeeId,
          committeeName: r.committeeName ?? null,
          committeeSlug: r.committeeSlug ?? null,
          trackedCommitteeId: primaryTracked?.id ?? null,
          trackedCommitteeName: primaryTracked?.name ?? null,
          trackedCommittees: resolvedTracked,
          managedTrackId: r.managedTrackId ?? null,
          managedTrackName: r.managedTrackName ?? null,
          isActive: r.isActive,
          createdAt: r.createdAt,
        };
      })
    );
  } catch {
    return [];
  }
}

export function toContextPickerOptions(
  contexts: readonly EligibleContextOption[]
): ContextPickerOption[] {
  return contexts.map((c) => {
    const trackedCommittees = resolveTrackedCommitteesForContext(c);
    return {
      membershipId: c.membershipId,
      role: c.role,
      committeeName: c.committeeName,
      trackedCommitteeId: c.trackedCommitteeId ?? trackedCommittees[0]?.id ?? null,
      trackedCommitteeName:
        c.trackedCommitteeName ?? trackedCommittees[0]?.name ?? null,
      trackedCommittees,
      managedTrackName: c.managedTrackName ?? null,
    };
  });
}

/**
 * Server-side ownership and eligibility check before switching a session's active membership.
 */
export async function validateMembershipSwitch(
  personId: string,
  targetMembershipId: string,
  targetTrackedCommitteeId?: string | null
): Promise<ContextSwitchResult> {
  const eligible = await listEligibleContextsForPerson(personId);
  return resolveContextSwitch(
    eligible,
    targetMembershipId,
    targetTrackedCommitteeId
  );
}
