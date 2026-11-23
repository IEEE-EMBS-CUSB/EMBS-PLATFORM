import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Check, KeyRound, Trophy } from "lucide-react";
import { CommitteeLeadersShowcase } from "@/components/data-display/committee-leaders-showcase";
import { buttonVariants } from "@/components/ui/button";
import { getServerSession } from "@/lib/session-cookie";
import { cn } from "@/lib/utils";
import { getRoleLandingPath, isOperationalRole } from "@/lib/auth-helpers";
import { getCommitteeLeaders } from "@/services/leaderboard.service";
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
  const committeeLeaders = await getCommitteeLeaders();
  const latestMonthLabel = committeeLeaders[0]?.monthLabel ?? "Current";
  const latestMonth = committeeLeaders[0]?.month;

  return (
    <div>
      {/* Focused hero */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="max-w-2xl space-y-5">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#002855] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              IEEE EMBS CUSB Portal
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Monthly committee standings, attendance, tasks, and evaluations
              for Cairo University Student Branch.
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
                <span>Committee Leaderboards</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live Committee #1 Leaders Spotlight */}
      {committeeLeaders.length > 0 && (
        <CommitteeLeadersShowcase
          spotlights={committeeLeaders}
          monthLabel={latestMonthLabel}
          month={latestMonth}
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
