import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { MembershipRole, SeasonStatus } from "@/lib/auth-helpers";

export type ContextViewMode = "manage" | "personal";

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

function toEligibleOption(c: RawContextCandidate): EligibleContextOption {
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
 * 2. Otherwise (alumni), active memberships from the single most recent archived season are eligible.
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

  const archivedActive = candidates.filter(
    (c) => c.seasonStatus === "archived" && c.isActive
  );
  if (archivedActive.length === 0) return [];

  const latestStartMs = Math.max(
    ...archivedActive.map((c) => c.seasonStartDate.getTime())
  );
  return archivedActive
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
  targetMembershipId: string
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

    return filterEligibleSeasonContexts(
      rows.map((r) => ({
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
        managedTrackId: r.managedTrackId ?? null,
        managedTrackName: r.managedTrackName ?? null,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }))
    );
  } catch {
    return [];
  }
}

/**
 * Server-side ownership and eligibility check before switching a session's active membership.
 */
export async function validateMembershipSwitch(
  personId: string,
  targetMembershipId: string
): Promise<ContextSwitchResult> {
  const eligible = await listEligibleContextsForPerson(personId);
  return resolveContextSwitch(eligible, targetMembershipId);
}
