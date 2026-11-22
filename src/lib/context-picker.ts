import type { MembershipRole } from "@/lib/auth-helpers";

export type ContextPickerViewMode = "manage" | "personal";
export type ActivePortalKind = "hr" | "member" | "attendee";

export interface ContextPickerOption {
  membershipId: string;
  role: MembershipRole;
  committeeName: string | null;
  trackedCommitteeName?: string | null;
  managedTrackName?: string | null;
}

export interface ContextPickerViewItem {
  key: string;
  membershipId: string;
  viewMode: ContextPickerViewMode;
  label: string;
  href: "/hr" | "/member" | "/attendee";
  isActive: boolean;
}

export interface ContextPickerGroup {
  membershipId: string;
  heading: string;
  role: MembershipRole;
  views: ContextPickerViewItem[];
}

export interface ContextPickerModel {
  groups: ContextPickerGroup[];
  activeTriggerLabel: string;
  isInteractive: boolean;
  totalOptions: number;
}

function formatRoleHeading(ctx: ContextPickerOption): string {
  switch (ctx.role) {
    case "committee_head":
      return ctx.committeeName ? `${ctx.committeeName} · Head` : "Head";
    case "hr_member":
      if (
        !ctx.committeeName ||
        ctx.committeeName.toLowerCase() === "human resources"
      ) {
        return "HR · Member";
      }
      return `${ctx.committeeName} · HR`;
    case "member":
      return ctx.committeeName ? `${ctx.committeeName} · Member` : "Member";
    case "attendee":
      return ctx.committeeName ? `${ctx.committeeName} · Attendee` : "Attendee";
    case "master_admin":
      return "Master Admin";
    case "director":
      return ctx.managedTrackName
        ? `${ctx.managedTrackName} · Director`
        : "Director";
    case "hr_admin":
      return "HR · Admin";
    default:
      return "Member";
  }
}

function buildViewsForContext(
  ctx: ContextPickerOption,
  isActiveMembership: boolean,
  activePortal: ActivePortalKind
): ContextPickerViewItem[] {
  switch (ctx.role) {
    case "committee_head":
      return [
        {
          key: `${ctx.membershipId}:personal`,
          membershipId: ctx.membershipId,
          viewMode: "personal",
          label: "My work",
          href: "/member",
          isActive: isActiveMembership && activePortal === "member",
        },
        {
          key: `${ctx.membershipId}:manage`,
          membershipId: ctx.membershipId,
          viewMode: "manage",
          label: "Manage committee",
          href: "/hr",
          isActive: isActiveMembership && activePortal === "hr",
        },
      ];
    case "hr_member":
      return [
        {
          key: `${ctx.membershipId}:personal`,
          membershipId: ctx.membershipId,
          viewMode: "personal",
          label: "My work",
          href: "/member",
          isActive: isActiveMembership && activePortal === "member",
        },
        {
          key: `${ctx.membershipId}:manage`,
          membershipId: ctx.membershipId,
          viewMode: "manage",
          label: ctx.trackedCommitteeName
            ? `Track ${ctx.trackedCommitteeName}`
            : "HR duties",
          href: "/hr",
          isActive: isActiveMembership && activePortal === "hr",
        },
      ];
    case "member":
      return [
        {
          key: `${ctx.membershipId}:personal`,
          membershipId: ctx.membershipId,
          viewMode: "personal",
          label: "My work",
          href: "/member",
          isActive: isActiveMembership && activePortal === "member",
        },
      ];
    case "attendee":
      return [
        {
          key: `${ctx.membershipId}:personal`,
          membershipId: ctx.membershipId,
          viewMode: "personal",
          label: "Attendee portal",
          href: "/attendee",
          isActive: isActiveMembership && activePortal === "attendee",
        },
      ];
    case "master_admin":
      return [
        {
          key: `${ctx.membershipId}:manage`,
          membershipId: ctx.membershipId,
          viewMode: "manage",
          label: "Admin console",
          href: "/hr",
          isActive: isActiveMembership && activePortal === "hr",
        },
      ];
    case "director":
      return [
        {
          key: `${ctx.membershipId}:manage`,
          membershipId: ctx.membershipId,
          viewMode: "manage",
          label: "Manage track",
          href: "/hr",
          isActive: isActiveMembership && activePortal === "hr",
        },
      ];
    case "hr_admin":
      return [
        {
          key: `${ctx.membershipId}:manage`,
          membershipId: ctx.membershipId,
          viewMode: "manage",
          label: "HR console",
          href: "/hr",
          isActive: isActiveMembership && activePortal === "hr",
        },
      ];
    default:
      return [];
  }
}

/**
 * Pure presentation model for the multi-role Context Switcher (Spec §5).
 * - Never labels a Head's personal view "Member".
 * - Marks single-context users (<= 1 view across all memberships) non-interactive.
 */
export function buildContextPickerModel(input: {
  contexts: readonly ContextPickerOption[];
  activeMembershipId?: string | null;
  activePortal: ActivePortalKind;
  fallbackLabel?: string;
}): ContextPickerModel {
  const { contexts, activeMembershipId, activePortal, fallbackLabel = "" } =
    input;

  if (contexts.length === 0) {
    return {
      groups: [],
      activeTriggerLabel: fallbackLabel,
      isInteractive: false,
      totalOptions: 0,
    };
  }

  const resolvedActiveId = activeMembershipId ?? contexts[0].membershipId;

  const groups: ContextPickerGroup[] = contexts.map((ctx) => {
    const isActiveMembership = ctx.membershipId === resolvedActiveId;
    return {
      membershipId: ctx.membershipId,
      heading: formatRoleHeading(ctx),
      role: ctx.role,
      views: buildViewsForContext(ctx, isActiveMembership, activePortal),
    };
  });

  const totalOptions = groups.reduce((acc, g) => acc + g.views.length, 0);
  const isInteractive = totalOptions > 1;

  if (!isInteractive) {
    return {
      groups,
      activeTriggerLabel: groups[0]?.heading ?? fallbackLabel,
      isInteractive: false,
      totalOptions,
    };
  }

  for (const group of groups) {
    const activeView = group.views.find((v) => v.isActive);
    if (activeView) {
      return {
        groups,
        activeTriggerLabel: `${group.heading} · ${activeView.label}`,
        isInteractive: true,
        totalOptions,
      };
    }
  }

  const fallbackGroup =
    groups.find((g) => g.membershipId === resolvedActiveId) ?? groups[0];
  const fallbackView = fallbackGroup.views[0];
  return {
    groups,
    activeTriggerLabel: fallbackView
      ? `${fallbackGroup.heading} · ${fallbackView.label}`
      : fallbackGroup.heading,
    isInteractive: true,
    totalOptions,
  };
}
