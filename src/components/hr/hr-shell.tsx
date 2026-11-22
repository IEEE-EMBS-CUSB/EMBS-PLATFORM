"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown,
  Menu,
  MoreHorizontal,
  Shield,
  Trophy,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { EmbsMark } from "@/components/brand/embs-mark";
import {
  HrNav,
  getVisibleHrNavItems,
  resolveHrTabFromPathname,
  type HrTabKey,
} from "@/components/hr/hr-nav";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import { NavLinkPendingIndicator } from "@/components/layout/nav-link-pending";
import { Badge } from "@/components/ui/badge";
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

export interface HrShellProps {
  activeTab?: HrTabKey;
  activeSeasonName?: string;
  currentUserRole?: MembershipRole;
  userName?: string;
  userCommitteeName?: string;
  contexts?: readonly ContextPickerOption[];
  activeMembershipId?: string | null;
  children: ReactNode;
}

const ROLE_META: Record<
  MembershipRole,
  { label: string; headerBadge: string; sidebarBadge: string }
> = {
  master_admin: {
    label: "Master Authority",
    headerBadge: "bg-[#002855] text-[#ffc627] border-[#ffc627]/40",
    sidebarBadge: "bg-[#002855] text-[#ffc627]",
  },
  director: {
    label: "Director Console",
    headerBadge: "bg-[#5a1b63] text-white border-white/20",
    sidebarBadge: "bg-[#5a1b63] text-white",
  },
  hr_admin: {
    label: "HR Administration",
    headerBadge: "bg-white/15 text-white border-white/20",
    sidebarBadge: "bg-[#772583] text-white",
  },
  hr_member: {
    label: "Committee HR",
    headerBadge: "bg-[#007377] text-white border-white/20",
    sidebarBadge: "bg-[#007377] text-white",
  },
  committee_head: {
    label: "Head Console",
    headerBadge: "bg-[#00629b] text-white border-white/20",
    sidebarBadge: "bg-[#00629b] text-white",
  },
  member: {
    label: "Member",
    headerBadge: "bg-white/15 text-white border-white/20",
    sidebarBadge: "bg-muted text-foreground",
  },
  attendee: {
    label: "Attendee",
    headerBadge: "bg-white/15 text-white border-white/20",
    sidebarBadge: "bg-muted text-foreground",
  },
};

export function HrShell({
  activeTab,
  activeSeasonName = "Active Season",
  currentUserRole = "hr_admin",
  userName,
  userCommitteeName,
  contexts = [],
  activeMembershipId,
  children,
}: HrShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isMaster = currentUserRole === "master_admin";
  const resolvedTab = activeTab ?? resolveHrTabFromPathname(pathname);
  const visibleItems = getVisibleHrNavItems(currentUserRole);
  const hasOverflowTabs = visibleItems.length > 4;
  const primaryMobileTabs = hasOverflowTabs
    ? visibleItems.slice(0, 4)
    : visibleItems;
  const isOverflowTabActive =
    hasOverflowTabs &&
    visibleItems.slice(4).some((item) => item.key === resolvedTab);

  const currentRoleInfo = ROLE_META[currentUserRole] ?? {
    label: "HR Operations",
    headerBadge: "bg-white/15 text-white border-white/20",
    sidebarBadge: "bg-[#772583] text-white",
  };
  const fallbackContextLabel = userCommitteeName
    ? `${currentRoleInfo.label} · ${userCommitteeName}`
    : currentRoleInfo.label;
  const hasInteractiveContextSwitcher = buildContextPickerModel({
    contexts,
    activeMembershipId,
    activePortal: "hr",
    fallbackLabel: fallbackContextLabel,
  }).isInteractive;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#5a1b63]"
      >
        Skip to main content
      </a>

      {/* Locked IEEE EMBS solid #772583 header */}
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <EmbsMark inverted />
            </Link>
            <div
              className="hidden h-5 w-px bg-white/25 sm:block"
              aria-hidden="true"
            />
            <div className="hidden items-center gap-2 sm:flex min-w-0">
              <Badge
                className={cn(
                  "shrink-0 gap-1 border text-xs font-bold",
                  currentRoleInfo.headerBadge
                )}
              >
                {isMaster ? (
                  <Crown
                    className="h-3 w-3 text-[#ffc627]"
                    aria-hidden="true"
                  />
                ) : (
                  <Shield className="h-3 w-3" aria-hidden="true" />
                )}
                {currentRoleInfo.label}
              </Badge>
              <span className="hidden truncate text-xs text-white/75 md:inline">
                Season:{" "}
                <strong className="font-semibold text-white">
                  {activeSeasonName}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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
                    aria-label="Open HR navigation"
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
                  {userName && (
                    <p className="font-heading text-sm font-bold text-[#002855]">
                      {userName}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      className={cn(
                        "text-[11px] font-semibold",
                        currentRoleInfo.sidebarBadge
                      )}
                    >
                      {currentRoleInfo.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {activeSeasonName}
                    </span>
                  </div>
                  {userCommitteeName && !hasInteractiveContextSwitcher && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {userCommitteeName}
                    </p>
                  )}
                  {hasInteractiveContextSwitcher && (
                    <div className="mt-2.5">
                      <ContextSwitcher
                        contexts={contexts}
                        activeMembershipId={activeMembershipId}
                        activePortal="hr"
                        variant="mobile"
                        fallbackLabel={fallbackContextLabel}
                        onSwitched={() => setMobileOpen(false)}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <HrNav
                    activeTab={resolvedTab}
                    currentUserRole={currentUserRole}
                    onNavigate={() => setMobileOpen(false)}
                  />
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

      {/* Mobile 1-tap context switcher bar (only shown when user has multiple views/roles) */}
      {hasInteractiveContextSwitcher && (
        <div className="border-b border-border bg-[#f8f9fb] px-4 py-2 lg:hidden">
          <div className="mx-auto max-w-7xl">
            <ContextSwitcher
              contexts={contexts}
              activeMembershipId={activeMembershipId}
              activePortal="hr"
              variant="mobile"
              fallbackLabel={fallbackContextLabel}
            />
          </div>
        </div>
      )}

      {/* Persistent desktop sidebar + main operational workspace */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pt-5 pb-24 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-white p-4">
            <div className="border-b border-border px-1 pb-3.5">
              {userName && (
                <p className="font-heading text-sm font-bold text-[#002855]">
                  {userName}
                </p>
              )}
              <ContextSwitcher
                contexts={contexts}
                activeMembershipId={activeMembershipId}
                activePortal="hr"
                variant="desktop"
                fallbackLabel={fallbackContextLabel}
                className="mt-1"
              />
              <p className="mt-1.5 text-[11px] font-medium text-[#00629b]">
                {activeSeasonName}
              </p>
            </div>
            <HrNav activeTab={resolvedTab} currentUserRole={currentUserRole} />
          </div>
        </aside>

        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>

      {/* Thumbs-first mobile bottom navigation bar */}
      <nav
        aria-label="Mobile HR navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{
            gridTemplateColumns: `repeat(${
              primaryMobileTabs.length + (hasOverflowTabs ? 1 : 0)
            }, minmax(0, 1fr))`,
          }}
        >
          {primaryMobileTabs.map((item) => {
            const Icon = item.icon;
            const active = resolvedTab === item.key;

            return (
              <Link
                key={item.key}
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
                <span className="truncate">{item.mobileLabel}</span>
                <NavLinkPendingIndicator className="absolute top-2 right-2 ml-0 h-1.5 w-1.5" />
              </Link>
            );
          })}

          {hasOverflowTabs && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="More modules"
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-all duration-150 active:scale-95",
                isOverflowTabActive
                  ? "font-semibold text-[#772583]"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              {isOverflowTabActive && (
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
