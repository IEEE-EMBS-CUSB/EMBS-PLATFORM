"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { EmbsMark } from "@/components/brand/embs-mark";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import { NavLinkPendingIndicator } from "@/components/layout/nav-link-pending";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  buildContextPickerModel,
  type ContextPickerOption,
} from "@/lib/context-picker";
import { cn } from "@/lib/utils";
import type { ParticipantType } from "@/types";

interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  exact?: boolean;
}

const MEMBER_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/member",
    label: "Dashboard",
    mobileLabel: "Home",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/member/performance",
    label: "Performance",
    mobileLabel: "Score",
    icon: BarChart3,
  },
  {
    href: "/member/attendance",
    label: "Attendance",
    mobileLabel: "Attend",
    icon: CalendarCheck,
  },
  {
    href: "/member/assignments",
    label: "Assignments",
    mobileLabel: "Assign",
    icon: ClipboardList,
  },
  {
    href: "/member/tasks",
    label: "Tasks",
    mobileLabel: "Tasks",
    icon: CheckSquare,
  },
  {
    href: "/member/feedback",
    label: "Feedback",
    mobileLabel: "Feedback",
    icon: MessageSquare,
  },
];

const ATTENDEE_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/attendee",
    label: "Dashboard",
    mobileLabel: "Home",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/attendee/attendance",
    label: "Attendance",
    mobileLabel: "Sessions",
    icon: CalendarCheck,
  },
  {
    href: "/attendee/assignments",
    label: "Assignments",
    mobileLabel: "Assignments",
    icon: ClipboardCheck,
  },
];

interface PortalShellProps {
  portalType: ParticipantType;
  userName: string;
  subtitle: string;
  currentUserRole?: MembershipRole;
  contexts?: readonly ContextPickerOption[];
  activeMembershipId?: string | null;
  children: ReactNode;
}

export function PortalShell({
  portalType,
  userName,
  subtitle,
  currentUserRole,
  contexts = [],
  activeMembershipId,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems =
    portalType === "member" ? MEMBER_NAV_ITEMS : ATTENDEE_NAV_ITEMS;
  const primaryMobileTabs =
    portalType === "member" ? MEMBER_NAV_ITEMS.slice(0, 4) : ATTENDEE_NAV_ITEMS;
  const portalLabel =
    portalType === "attendee"
      ? "Attendee portal"
      : currentUserRole === "committee_head" || currentUserRole === "hr_member"
        ? "My work"
        : "Member portal";

  const pickerModel = buildContextPickerModel({
    contexts,
    activeMembershipId,
    activePortal: portalType,
    fallbackLabel: subtitle,
  });

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const isSecondaryMemberRouteActive =
    portalType === "member" &&
    MEMBER_NAV_ITEMS.slice(4).some((item) => isActive(item));

  const navList = (onNavigate?: () => void) => (
    <nav aria-label={portalLabel} className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b] lg:min-h-9",
              active
                ? "bg-[#772583] font-semibold text-white"
                : "text-foreground/85 hover:bg-[#f5edf7] hover:text-[#5a1b63]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
            <NavLinkPendingIndicator />
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#5a1b63]"
      >
        Skip to main content
      </a>

      {/* Solid #772583 portal top bar with unified Hat Switcher */}
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <EmbsMark inverted />
            </Link>

            <span
              className="h-5 w-px shrink-0 bg-white/25"
              aria-hidden="true"
            />
            <ContextSwitcher
              contexts={contexts}
              activeMembershipId={activeMembershipId}
              activePortal={portalType}
              variant="header"
              fallbackLabel={portalLabel}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/leaderboards"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white md:inline-flex"
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span>Leaderboard</span>
            </Link>
            <LogoutButton className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" />

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white lg:hidden"
                    aria-label="Open portal navigation"
                  />
                }
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 overflow-y-auto p-4">
                <SheetHeader className="p-0 text-left">
                  <SheetTitle>
                    <EmbsMark compact />
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-5 border-b border-border pb-4">
                  <p className="font-heading text-sm font-bold text-[#002855]">
                    {userName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pickerModel.activeTriggerLabel || subtitle}
                  </p>
                </div>
                <div className="mt-4">
                  {navList(() => setMobileOpen(false))}
                </div>
                <div className="mt-6 space-y-2 border-t border-border pt-4">
                  <Link
                    href="/leaderboards"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#00629b] hover:bg-[#ebf3f8]"
                  >
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    Leaderboard
                  </Link>
                  <LogoutButton className="h-11 w-full justify-center" />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main workspace grid */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pt-5 pb-24 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-white p-4">
            <div className="border-b border-border px-1 pb-3.5">
              <p className="font-heading text-sm font-bold text-[#002855]">
                {userName}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {pickerModel.activeHeading || subtitle}
              </p>
            </div>
            {navList()}
          </div>
        </aside>

        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>

      {/* Thumbs-first mobile bottom navigation bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        <div
          className={cn(
            "mx-auto grid max-w-lg",
            portalType === "member" ? "grid-cols-5" : "grid-cols-3"
          )}
        >
          {primaryMobileTabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-all duration-150 active:scale-95",
                  active
                    ? "font-semibold text-[#772583]"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-[#772583]"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.mobileLabel}</span>
                <NavLinkPendingIndicator className="absolute top-2 right-2 ml-0 h-1.5 w-1.5" />
              </Link>
            );
          })}

          {portalType === "member" && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-all duration-150 active:scale-95",
                isSecondaryMemberRouteActive
                  ? "font-semibold text-[#772583]"
                  : "text-muted-foreground active:text-foreground"
              )}
              aria-label="More sections"
            >
              {isSecondaryMemberRouteActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-[#772583]"
                />
              )}
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
