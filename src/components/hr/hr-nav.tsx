"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckSquare,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Megaphone,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NavLinkPendingIndicator } from "@/components/layout/nav-link-pending";
import { NavBadgePill } from "@/components/layout/nav-badge";
import type { ResolvedNavBadge } from "@/lib/nav-notifications";
import { cn } from "@/lib/utils";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAccessHrModule } from "@/lib/permissions";

export type HrTabKey =
  | "overview"
  | "statistics"
  | "seasons"
  | "committees"
  | "roster"
  | "attendance"
  | "tasks"
  | "ledger"
  | "feedback"
  | "publishing";

export interface HrNavItem {
  key: HrTabKey;
  label: string;
  mobileLabel: string;
  href: string;
  icon: LucideIcon;
  section: "workspace" | "governance" | "operations";
}

export const HR_NAV_ITEMS: readonly HrNavItem[] = [
  {
    key: "overview",
    label: "Overview",
    mobileLabel: "Home",
    href: "/hr",
    icon: LayoutDashboard,
    section: "workspace",
  },
  {
    key: "statistics",
    label: "Statistics",
    mobileLabel: "Stats",
    href: "/hr/statistics",
    icon: BarChart3,
    section: "workspace",
  },
  {
    key: "seasons",
    label: "Seasons",
    mobileLabel: "Seasons",
    href: "/hr/seasons",
    icon: History,
    section: "governance",
  },
  {
    key: "committees",
    label: "Committees",
    mobileLabel: "Teams",
    href: "/hr/committees",
    icon: ShieldCheck,
    section: "governance",
  },
  {
    key: "roster",
    label: "Roster",
    mobileLabel: "Roster",
    href: "/hr/roster",
    icon: Users,
    section: "governance",
  },
  {
    key: "attendance",
    label: "Attendance",
    mobileLabel: "Attend",
    href: "/hr/attendance",
    icon: QrCode,
    section: "operations",
  },
  {
    key: "tasks",
    label: "Tasks & Work",
    mobileLabel: "Tasks",
    href: "/hr/tasks",
    icon: CheckSquare,
    section: "operations",
  },
  {
    key: "ledger",
    label: "Points Ledger",
    mobileLabel: "Ledger",
    href: "/hr/ledger",
    icon: FileSpreadsheet,
    section: "operations",
  },
  {
    key: "feedback",
    label: "Feedback",
    mobileLabel: "Feedback",
    href: "/hr/feedback",
    icon: Megaphone,
    section: "operations",
  },
  {
    key: "publishing",
    label: "Publishing",
    mobileLabel: "Publish",
    href: "/hr/publishing",
    icon: Trophy,
    section: "operations",
  },
];

function getWorkModuleLabels(role: MembershipRole): {
  label: string;
  mobileLabel: string;
} {
  if (role === "director" || role === "committee_head") {
    return { label: "Assignments", mobileLabel: "Assign" };
  }
  if (role === "hr_member") {
    return { label: "Tasks", mobileLabel: "Tasks" };
  }
  return { label: "Tasks & Work", mobileLabel: "Tasks" };
}

export function getVisibleHrNavItems(
  currentUserRole: MembershipRole = "hr_admin"
): HrNavItem[] {
  return HR_NAV_ITEMS.filter((item) => {
    if (item.key === "overview") return true;
    return canAccessHrModule(currentUserRole, item.key);
  }).map((item) => {
    if (item.key === "tasks") {
      return { ...item, ...getWorkModuleLabels(currentUserRole) };
    }
    return item;
  });
}

export function resolveHrTabFromPathname(pathname: string | null): HrTabKey {
  if (!pathname || pathname === "/hr") return "overview";
  const match = HR_NAV_ITEMS.find(
    (item) =>
      item.key !== "overview" &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  return match?.key ?? "overview";
}

interface HrNavProps {
  activeTab?: HrTabKey;
  currentUserRole?: MembershipRole;
  resolvedBadges?: Record<string, ResolvedNavBadge>;
  onNavigate?: () => void;
}

export function HrNav({
  activeTab,
  currentUserRole = "hr_admin",
  resolvedBadges,
  onNavigate,
}: HrNavProps) {
  const pathname = usePathname();
  const resolvedTab = activeTab ?? resolveHrTabFromPathname(pathname);
  const visibleItems = getVisibleHrNavItems(currentUserRole);

  return (
    <nav aria-label="HR Operations navigation" className="space-y-1">
      {visibleItems.map((item) => {
        const isActive = resolvedTab === item.key;
        const Icon = item.icon;
        const badge = resolvedBadges?.[item.href];

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b] lg:min-h-9",
              isActive
                ? "bg-[#772583] font-semibold text-white"
                : "text-foreground/85 hover:bg-[#f5edf7] hover:text-[#5a1b63]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
            {badge ? (
              <NavBadgePill badge={badge} active={isActive} />
            ) : (
              <NavLinkPendingIndicator />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
