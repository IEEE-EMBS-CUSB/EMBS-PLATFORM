import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Check, KeyRound, Trophy } from "lucide-react";
import { CommitteeLeadersShowcase } from "@/components/data-display/committee-leaders-showcase";
import { buttonVariants } from "@/components/ui/button";
import { getServerSession } from "@/lib/session-cookie";
import { cn } from "@/lib/utils";
import { getRoleLandingPath, isOperationalRole } from "@/lib/auth-helpers";
import {
  getCommitteeLeaders,
  getOverallLeaderboard,
} from "@/services/leaderboard.service";
import { getOperationalUserProfile } from "@/services/member.service";

function DefaultPrimaryPortalCta() {
  return (
    <Link
      href="/login"
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-11 gap-2 bg-[#772583] px-5 text-sm font-semibold text-white hover:bg-[#5a1b63]"
      )}
    >
      <KeyRound className="h-4 w-4" aria-hidden="true" />
      <span>Portal sign in</span>
    </Link>
  );
}

async function SessionAwarePrimaryPortalCta() {
  const session = await getServerSession();
  if (!session) return <DefaultPrimaryPortalCta />;

  let href = session.participantType === "member" ? "/member" : "/attendee";
  try {
    const opProfile = await getOperationalUserProfile(session.participantId);
    if (opProfile && isOperationalRole(opProfile.role)) {
      href = getRoleLandingPath(opProfile.role);
    }
  } catch {
    // Fall back to default
  }

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-11 gap-2 bg-[#772583] px-5 text-sm font-semibold text-white hover:bg-[#5a1b63]"
      )}
    >
      <span>Open my dashboard</span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

async function SessionAwareRoleLink({
  role,
  className,
}: {
  role: "member" | "attendee";
  className: string;
}) {
  const session = await getServerSession();
  const isSignedInAsRole = session?.participantType === role;
  let href = isSignedInAsRole ? `/${role}` : "/login";
  if (isSignedInAsRole && role === "member") {
    try {
      const opProfile = await getOperationalUserProfile(session.participantId);
      if (opProfile && isOperationalRole(opProfile.role)) {
        href = getRoleLandingPath(opProfile.role);
      }
    } catch {
      // Fall back to default
    }
  }
  const label = isSignedInAsRole
    ? `Open ${role} dashboard`
    : role === "member"
      ? "Member access"
      : "Attendee access";

  return (
    <Link href={href} className={className}>
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

const MEMBER_HIGHLIGHTS = [
  "Monthly score breakdown and overall / committee ranking",
  "Meeting, workshop, and event attendance with bonus points",
  "Tasks with effort, quality ratings, and task points",
  "Seasonal HR evaluation and published review notes",
] as const;

const ATTENDEE_HIGHLIGHTS = [
  "Track completion progress across sessions and assignments",
  "Session attendance log with presenters and dates",
  "Assignment marks and instructor remarks",
] as const;

export default async function HomePage() {
  const [latestLeaderboard, committeeLeaders] = await Promise.all([
    getOverallLeaderboard(),
    getCommitteeLeaders(),
  ]);

  const topFive = latestLeaderboard?.entries.slice(0, 5) ?? [];

  return (
    <div>
      {/* Focused hero + live standings */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-16">
          <div className="space-y-5 lg:col-span-7">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#002855] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              IEEE EMBS CUSB Portal
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Monthly standings, attendance, tasks, and evaluations for Cairo
              University Student Branch.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Suspense fallback={<DefaultPrimaryPortalCta />}>
                <SessionAwarePrimaryPortalCta />
              </Suspense>
              <Link
                href="/leaderboards"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 gap-2 border-[#00629b]/30 px-5 text-sm font-semibold text-[#002855] hover:bg-[#ebf3f8]"
                )}
              >
                <Trophy className="h-4 w-4 text-[#00629b]" aria-hidden="true" />
                <span>Leaderboard</span>
              </Link>
            </div>
          </div>

          {/* Live Top 5 standings */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border bg-[#f8f9fb] px-4 py-3">
                <h2 className="font-heading text-sm font-bold text-[#002855]">
                  {latestLeaderboard
                    ? `${latestLeaderboard.monthLabel} Top 5`
                    : "Current Standings"}
                </h2>
                <Link
                  href="/leaderboards"
                  className="text-xs font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
                >
                  Full top 10
                </Link>
              </div>

              {topFive.length > 0 ? (
                <ol className="divide-y divide-border">
                  {topFive.map((entry) => (
                    <li
                      key={entry.memberId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded font-heading text-xs font-bold tabular-nums",
                            entry.rank === 1
                              ? "bg-[#ffc627]/35 text-[#002855] ring-1 ring-[#ffc627]/80"
                              : entry.rank === 2
                                ? "bg-[#f5edf7] text-[#5a1b63]"
                                : entry.rank === 3
                                  ? "bg-[#ebf3f8] text-[#002855]"
                                  : "text-muted-foreground"
                          )}
                        >
                          {entry.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {entry.memberName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {entry.committeeName}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                        {entry.monthlyScore}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No published rankings yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Live Committee #1 Leaders Spotlight */}
      {committeeLeaders.length > 0 && (
        <CommitteeLeadersShowcase
          spotlights={committeeLeaders}
          monthLabel={latestLeaderboard?.monthLabel ?? "Current"}
        />
      )}

      {/* Member & Attendee workspace breakdown */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-lg border border-border bg-[#f8f9fb]/60 p-6">
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Member portal
                </h2>
                <ul className="space-y-2.5 text-sm text-foreground/85">
                  {MEMBER_HIGHLIGHTS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#772583]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <Suspense
                  fallback={
                    <Link
                      href="/login"
                      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#772583] hover:text-[#5a1b63] hover:underline"
                    >
                      Member access
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  }
                >
                  <SessionAwareRoleLink
                    role="member"
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#772583] hover:text-[#5a1b63] hover:underline"
                  />
                </Suspense>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-border bg-[#f8f9fb]/60 p-6">
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Attendee portal
                </h2>
                <ul className="space-y-2.5 text-sm text-foreground/85">
                  {ATTENDEE_HIGHLIGHTS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <Suspense
                  fallback={
                    <Link
                      href="/login"
                      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
                    >
                      Attendee access
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  }
                >
                  <SessionAwareRoleLink
                    role="attendee"
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#00629b] hover:text-[#002855] hover:underline"
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
