export type MembershipRole =
  | "master_admin"
  | "director"
  | "hr_admin"
  | "hr_member"
  | "committee_head"
  | "member"
  | "attendee";

export type SeasonStatus = "draft" | "active" | "archived";

export interface RosterMembershipRecord {
  id: string;
  seasonId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
  isActive: boolean;
  seasonStatus: SeasonStatus;
}

export interface WhitelistCheckResult {
  allowed: boolean;
  isAlumni: boolean;
  reason?: string;
  membership?: RosterMembershipRecord;
}

/**
 * Normalizes email addresses by trimming whitespace and lowercasing.
 * Must be used across all roster inserts, CSV imports, and login authorization lookups.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Checks whether a role is an operational/leadership staff role with access to /hr modules.
 */
export function isOperationalRole(role?: MembershipRole): boolean {
  return (
    role === "master_admin" ||
    role === "director" ||
    role === "hr_admin" ||
    role === "committee_head" ||
    role === "hr_member"
  );
}

/**
 * Returns the default landing path for a given roster role.
 */
export function getRoleLandingPath(role?: MembershipRole): string {
  switch (role) {
    case "master_admin":
    case "director":
    case "hr_admin":
    case "hr_member":
    case "committee_head":
      return "/hr";
    case "attendee":
      return "/attendee";
    case "member":
    default:
      return "/member";
  }
}

/**
 * Validates whether an email belongs to an active member/attendee or an alumni
 * with archived records.
 */
export function checkRosterWhitelist(
  rawEmail: string,
  memberships: readonly RosterMembershipRecord[]
): WhitelistCheckResult {
  const normalized = normalizeEmail(rawEmail);

  // Look for memberships matching the normalized email
  const userMemberships = memberships.filter(
    (m) => normalizeEmail(m.email) === normalized
  );

  if (userMemberships.length === 0) {
    return {
      allowed: false,
      isAlumni: false,
      reason: `Email ${normalized} is not found on the roster. Please contact your HR lead to request access.`,
    };
  }

  // Prioritize active season membership
  const activeSeasonMembership = userMemberships.find(
    (m) => m.seasonStatus === "active"
  );

  if (activeSeasonMembership) {
    if (!activeSeasonMembership.isActive) {
      return {
        allowed: false,
        isAlumni: false,
        reason:
          "Your membership profile is currently inactive or deactivated. Please contact your HR lead.",
        membership: activeSeasonMembership,
      };
    }

    return {
      allowed: true,
      isAlumni: false,
      membership: activeSeasonMembership,
    };
  }

  // Check for historical alumni membership (archived season)
  const archivedMembership = userMemberships.find(
    (m) => m.seasonStatus === "archived" && m.isActive
  );

  if (archivedMembership) {
    return {
      allowed: true,
      isAlumni: true,
      membership: archivedMembership,
    };
  }

  return {
    allowed: false,
    isAlumni: false,
    reason: "No active or archived season memberships found for this account.",
  };
}
