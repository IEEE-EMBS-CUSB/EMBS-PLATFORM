import type { ReactNode } from "react";
import Link from "next/link";
import { Crown, Shield, Trophy } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { EmbsMark } from "@/components/brand/embs-mark";
import { Badge } from "@/components/ui/badge";
import { HrNav, type HrTabKey } from "@/components/hr/hr-nav";
import type { MembershipRole } from "@/lib/auth-helpers";

export interface HrShellProps {
  activeTab: HrTabKey;
  activeSeasonName?: string;
  currentUserRole?: MembershipRole;
  userName?: string;
  userCommitteeName?: string;
  children: ReactNode;
}

export function HrShell({
  activeTab,
  activeSeasonName = "Active Season",
  currentUserRole = "hr_admin",
  userName,
  userCommitteeName,
  children,
}: HrShellProps) {
  const isMaster = currentUserRole === "master_admin";

  const roleLabelMap: Record<MembershipRole, { label: string; badge: string }> = {
    master_admin: {
      label: "Master Authority",
      badge: "bg-[#002855] text-[#ffc627] border-[#ffc627]/40",
    },
    director: {
      label: "Director Console",
      badge: "bg-[#5a1b63] text-white border-white/20",
    },
    hr_admin: {
      label: "HR Administration",
      badge: "bg-white/15 text-white border-white/20",
    },
    hr_member: {
      label: "Committee HR",
      badge: "bg-[#007377] text-white border-white/20",
    },
    committee_head: {
      label: "Head Console",
      badge: "bg-[#00629b] text-white border-white/20",
    },
    member: {
      label: "Member",
      badge: "bg-white/15 text-white border-white/20",
    },
    attendee: {
      label: "Attendee",
      badge: "bg-white/15 text-white border-white/20",
    },
  };

  const currentRoleInfo = roleLabelMap[currentUserRole] ?? {
    label: "HR Operations",
    badge: "bg-white/15 text-white border-white/20",
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fb]">
      {/* Locked IEEE EMBS solid header */}
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <EmbsMark inverted />
            </Link>
            <div
              className="hidden h-5 w-px bg-white/25 sm:block"
              aria-hidden="true"
            />
            <div className="hidden items-center gap-2 sm:flex">
              <Badge
                className={`text-xs font-bold gap-1 border ${currentRoleInfo.badge}`}
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
              {userCommitteeName && (
                <span className="text-xs text-white/80">
                  {userCommitteeName}
                </span>
              )}
              <span className="text-xs text-white/60">
                Season:{" "}
                <strong className="text-white">{activeSeasonName}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName && (
              <span className="hidden font-heading text-xs font-bold text-white/95 sm:inline-block">
                {userName}
              </span>
            )}

            <Link
              href="/leaderboards"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white md:inline-flex"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Leaderboard</span>
            </Link>

            <LogoutButton className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
          </div>
        </div>

        {/* Compact mobile context strip */}
        <div className="flex items-center justify-between gap-2 border-t border-white/15 bg-[#5a1b63] px-4 py-1.5 text-[11px] text-white/90 sm:hidden">
          <span className="font-semibold truncate">
            {currentRoleInfo.label}
            {userCommitteeName ? ` · ${userCommitteeName}` : ""}
          </span>
          <span className="shrink-0 text-white/75">{activeSeasonName}</span>
        </div>
      </header>

      {/* Tab navigation */}
      <HrNav activeTab={activeTab} currentUserRole={currentUserRole} />

      {/* Main content */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
