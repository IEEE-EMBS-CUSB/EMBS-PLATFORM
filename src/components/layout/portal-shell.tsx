"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Award,
  BarChart3,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { EmbsMark } from "@/components/brand/embs-mark";
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
    href: "/member/tasks",
    label: "Tasks",
    mobileLabel: "Tasks",
    icon: CheckSquare,
  },
  {
    href: "/member/activities",
    label: "Activities",
    mobileLabel: "Activities",
    icon: FolderKanban,
  },
  {
    href: "/member/evaluations",
    label: "Evaluations",
    mobileLabel: "Eval",
    icon: Award,
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
  children: ReactNode;
}

export function PortalShell({
  portalType,
  userName,
  subtitle,
  currentUserRole,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems =
    portalType === "member" ? MEMBER_NAV_ITEMS : ATTENDEE_NAV_ITEMS;
  const primaryMobileTabs =
    portalType === "member" ? MEMBER_NAV_ITEMS.slice(0, 4) : ATTENDEE_NAV_ITEMS;
  const portalLabel =
    portalType === "member" ? "Member portal" : "Attendee portal";

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
              "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:min-h-9",
              active
                ? "bg-[#772583] text-white font-semibold"
                : "text-foreground/85 hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
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

      {/* Solid #772583 portal top bar with locked logo position */}
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <EmbsMark inverted />
            </Link>

            <span
              className="hidden h-5 w-px bg-white/25 sm:inline-block"
              aria-hidden="true"
            />
            <span className="hidden text-xs font-semibold text-white/85 sm:inline-block">
              {portalLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentUserRole &&
              currentUserRole !== "member" &&
              currentUserRole !== "attendee" && (
                <Link
                  href="/hr"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
                >
                  <Shield className="h-3.5 w-3.5 text-[#ffc627]" aria-hidden="true" />
                  <span>
                    {currentUserRole === "committee_head"
                      ? "Leader View"
                      : "Management Console"}
                  </span>
                </Link>
              )}

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
              <SheetContent side="right" className="w-72 p-4">
                <SheetHeader className="p-0 text-left">
                  <SheetTitle>
                    <EmbsMark compact />
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-5 border-b border-border pb-4">
                  <p className="text-sm font-semibold text-[#002855]">
                    {userName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subtitle}
                  </p>
                </div>
                <div className="mt-4">
                  {navList(() => setMobileOpen(false))}
                </div>
                <div className="mt-6 space-y-2 border-t border-border pt-4">
                  {currentUserRole &&
                    currentUserRole !== "member" &&
                    currentUserRole !== "attendee" && (
                      <Link
                        href="/hr"
                        onClick={() => setMobileOpen(false)}
                        className="flex min-h-11 items-center gap-2 rounded-md bg-[#f5edf7] px-3 py-2 text-sm font-semibold text-[#5a1b63] hover:bg-[#ead8ee]"
                      >
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        {currentUserRole === "committee_head"
                          ? "Leader View"
                          : "Management Console"}
                      </Link>
                    )}
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
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 pt-5 pb-24 sm:px-6 lg:grid-cols-12 lg:py-9">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-white p-4">
            <div className="border-b border-border px-1 pb-3.5">
              <p className="font-heading text-sm font-bold text-[#002855]">
                {userName}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </div>
            {navList()}
            {currentUserRole &&
              currentUserRole !== "member" &&
              currentUserRole !== "attendee" && (
                <div className="border-t border-border pt-3">
                  <Link
                    href="/hr"
                    className="flex min-h-9 items-center gap-2 rounded-md bg-[#f5edf7] px-3 py-2 text-xs font-semibold text-[#5a1b63] transition-colors hover:bg-[#ead8ee]"
                  >
                    <Shield className="h-4 w-4 text-[#772583]" aria-hidden="true" />
                    <span>
                      {currentUserRole === "committee_head"
                        ? "Switch to Leader View"
                        : "Management Console"}
                    </span>
                  </Link>
                </div>
              )}
          </div>
        </aside>

        <main id="main-content" className="min-w-0 lg:col-span-9">
          {children}
        </main>
      </div>

      {/* Thumbs-first mobile bottom navigation bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                    ? "text-[#772583] font-semibold"
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
                  ? "text-[#772583] font-semibold"
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
