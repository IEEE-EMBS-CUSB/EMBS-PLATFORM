import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Megaphone,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAccessHrModule } from "@/lib/permissions";

export type HrTabKey =
  | "overview"
  | "seasons"
  | "committees"
  | "roster"
  | "attendance"
  | "tasks"
  | "ledger"
  | "feedback"
  | "publishing"
  | "events";

interface HrNavProps {
  activeTab: HrTabKey;
  currentUserRole?: MembershipRole;
}

const HR_NAV_ITEMS: {
  key: HrTabKey;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "overview", label: "Overview", href: "/hr", icon: LayoutDashboard },
  { key: "seasons", label: "Seasons", href: "/hr/seasons", icon: History },
  {
    key: "committees",
    label: "Committees",
    href: "/hr/committees",
    icon: ShieldCheck,
  },
  { key: "roster", label: "Roster", href: "/hr/roster", icon: Users },
  {
    key: "attendance",
    label: "Attendance",
    href: "/hr/attendance",
    icon: QrCode,
  },
  { key: "tasks", label: "Tasks", href: "/hr/tasks", icon: CheckSquare },
  {
    key: "ledger",
    label: "Points Ledger",
    href: "/hr/ledger",
    icon: FileSpreadsheet,
  },
  {
    key: "feedback",
    label: "Feedback",
    href: "/hr/feedback",
    icon: Megaphone,
  },
  {
    key: "publishing",
    label: "Publishing",
    href: "/hr/publishing",
    icon: CalendarDays,
  },
  {
    key: "events",
    label: "Events",
    href: "/hr/events",
    icon: CalendarDays,
  },
];

export function HrNav({ activeTab, currentUserRole = "hr_admin" }: HrNavProps) {
  const visibleItems = HR_NAV_ITEMS.filter((item) => {
    if (item.key === "overview") return true;
    return canAccessHrModule(currentUserRole, item.key);
  });

  return (
    <nav
      aria-label="HR Operations navigation"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mb-px flex space-x-1 overflow-x-auto py-2 sm:space-x-2">
          {visibleItems.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b]",
                  isActive
                    ? "bg-[#772583] text-white shadow-xs"
                    : "text-foreground/75 hover:bg-[#f5edf7]/80 hover:text-[#772583]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
