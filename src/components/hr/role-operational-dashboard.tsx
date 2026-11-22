"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  Crown,
  FileSpreadsheet,
  Layers,
  Megaphone,
  QrCode,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MembershipRole } from "@/lib/auth-helpers";
import type { AssignedTaskItem } from "@/components/hr/task-delegation-view";

export interface DashboardKpis {
  activeMembers: number;
  committeeCount: number;
  hrOfficers: number;
  assignedTasksCount: number;
  pendingGradingCount: number;
  avgMemberPoints: number;
  sessionsCount: number;
  publishedMonthsCount: number;
}

interface RoleOperationalDashboardProps {
  currentUserRole: MembershipRole;
  userName?: string;
  committeeName?: string;
  assignedTasks?: AssignedTaskItem[];
  kpis?: DashboardKpis;
}

const DEFAULT_KPIS: DashboardKpis = {
  activeMembers: 0,
  committeeCount: 0,
  hrOfficers: 0,
  assignedTasksCount: 0,
  pendingGradingCount: 0,
  avgMemberPoints: 0,
  sessionsCount: 0,
  publishedMonthsCount: 0,
};

function formatAssignerPrefix(role: MembershipRole): string {
  switch (role) {
    case "master_admin":
      return "Master Admin";
    case "director":
      return "Director";
    case "hr_admin":
      return "HR Admin";
    case "committee_head":
      return "Committee Head";
    default:
      return "Leadership";
  }
}

export function RoleOperationalDashboard({
  currentUserRole,
  userName = "Officer",
  committeeName,
  assignedTasks = [],
  kpis = DEFAULT_KPIS,
}: RoleOperationalDashboardProps) {
  const renderAssignedTasksSection = (heading: string, subtitle: string) => (
    <div className="space-y-4">
      <div className="border-b border-border pb-2">
        <h2 className="font-heading text-lg font-bold text-[#002855]">
          {heading}
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {assignedTasks.length === 0 ? (
        <Card className="border-dashed border-border bg-white p-6 text-center shadow-xs">
          <p className="text-xs text-muted-foreground">
            No directives currently assigned. New tasks from leadership will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignedTasks.map((task) => (
            <Card
              key={task.id}
              className="border-border bg-white shadow-xs transition-all hover:border-[#772583]"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-[#772583] text-white text-[10px] font-semibold">
                    {task.status.replace("_", " ")}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-[#002855]">
                    {task.maxPoints} pts
                  </span>
                </div>
                <CardTitle className="mt-1 font-heading text-sm font-bold text-[#002855]">
                  {task.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground/85">
                  <UserCheck className="h-3.5 w-3.5 text-[#00629b]" />
                  <span>
                    Assigned by {formatAssignerPrefix(task.assignerRole)}
                    {task.assignedByName && task.assignedByName !== "Leadership"
                      ? ` ${task.assignedByName}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Due {new Date(task.dueAt).toLocaleDateString()}</span>
                  </div>
                  <Link
                    href="/hr/tasks"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className:
                        "h-7 border-[#772583]/30 px-2.5 text-[11px] font-semibold text-[#772583] hover:bg-[#772583] hover:text-white",
                    })}
                  >
                    Open &amp; Submit
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // 1. COMMITTEE HEAD VIEW
  if (currentUserRole === "committee_head") {
    return (
      <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-[#002855]">
                  Committee Leadership Console
                </h2>
                {committeeName && (
                  <Badge className="bg-[#00629b] text-white text-xs font-semibold">
                    {committeeName}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Welcome back, {userName}. Manage deliverables, submissions grading, and feedback for members in your committee.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Active Members</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.activeMembers}
                </p>
                <p className="mt-1 text-[11px] text-[#00629b]">
                  In {committeeName ?? "your committee"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Assigned Tasks</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.assignedTasksCount}
                </p>
                <p className="mt-1 text-[11px] text-[#1e6b0a]">Active deliverables</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Pending Grading</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                  {kpis.pendingGradingCount}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Submissions to score</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Avg Member Points</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.avgMemberPoints}
                </p>
                <p className="mt-1 text-[11px] text-[#007377]">Current season average</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Committee Assignments &amp; Bulk Grading
                </h3>
                <p className="text-xs text-muted-foreground">
                  Create committee assignments or tab across Effort, Quality, and Timeliness to grade members.
                </p>
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Link
                    href="/hr/tasks"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#00629b] text-xs font-semibold text-white hover:bg-[#002855]",
                    })}
                  >
                    Create Committee Assignments
                  </Link>
                  <Link
                    href="/hr/tasks#grading"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Grade Deliverables
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Committee Bonus &amp; Points
                </h3>
                <p className="text-xs text-muted-foreground">
                  Award custom bonus points with required justifications to members in your committee.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/ledger"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                    })}
                  >
                    Award Committee Bonus
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#007377]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Member Feedback &amp; Reviews
                </h3>
                <p className="text-xs text-muted-foreground">
                  Send public recognitions, excused-absence notes, and committee feedback to your members.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/feedback"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Give Member Feedback
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    );
  }

  // 2. DIRECTOR VIEW
  if (currentUserRole === "director") {
    return (
      <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-[#002855]">
                Committee Overseer & Heads Delegation
              </h2>
              <Badge className="bg-[#5a1b63] text-white text-xs font-bold border border-[#ffc627]/40">
                Director Authority
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Welcome back, Director {userName}. Supervise your {kpis.committeeCount || "chapter"} committees, assign deliverables to Committee Heads and Members, and audit track standings.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5a1b63]/10 text-[#5a1b63]">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Assignments Delegation
                </h3>
                <p className="text-xs text-muted-foreground">
                  Issue deadlines, roadmaps, and assignments to Committee Heads, HR Admin, and Members.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/tasks"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#5a1b63] text-xs font-semibold text-white hover:bg-[#002855]",
                    })}
                  >
                    Delegate Assignments to Heads &amp; Members
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Committees &amp; Tracks Review
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review Technical, Creative, Operations, and custom committee tracks for the active season.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/committees"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Review Committees
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Points Ledger Audit (Read-Only)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Inspect score derivation, bonus logs, and activity records filtered to your committees.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/ledger"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Points Ledger
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    );
  }

  // 3. HR ADMIN VIEW
  if (currentUserRole === "hr_admin") {
    return (
      <div className="space-y-10">
        {assignedTasks.length > 0 &&
          renderAssignedTasksSection(
            "Directives from Director",
            "Assignments delegated to HR Administration by your overseeing track director."
          )}

        <div
          className={
            assignedTasks.length > 0
              ? "space-y-6 border-t border-border pt-8"
              : "space-y-6"
          }
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-[#002855]">
                Human Resources Operations Console
              </h2>
              <Badge className="bg-[#772583] text-white text-xs font-semibold">
                HR Administration
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Welcome back, {userName}. Manage committee HR assignments, assign tasks to HR members, supervise attendance, and publish leaderboards.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Tracked Members</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.activeMembers}
                </p>
                <p className="mt-1 text-[11px] text-[#00629b]">
                  Across {kpis.committeeCount} committees
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">HR Officers</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#007377] tabular-nums">
                  {kpis.hrOfficers}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Assigned to committees</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Attendance Sessions</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.sessionsCount}
                </p>
                <p className="mt-1 text-[11px] text-[#1e6b0a]">Logged this season</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">Published Months</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                  {kpis.publishedMonthsCount}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Frozen leaderboard snapshots</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Roster &amp; Committee HR Assignments
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assign HR officers to specific committees and manage active roster membership.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/roster"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                    })}
                  >
                    Assign HR Members
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#007377]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Publish Monthly Leaderboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review ended months and permanently freeze deterministic leaderboard snapshots.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/publishing"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Publish Monthly Leaderboard
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Season Scoring &amp; Rules
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure attendance check-in rules, task defaults, assignment grading weights, and feedback caps.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/seasons"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Configure Season Settings
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // 4. MASTER ADMIN VIEW
  if (currentUserRole === "master_admin") {
    return (
      <div className="space-y-8">
        <div className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
              Master Authority &amp; Chapter Governance
            </h1>
            <Badge className="gap-1 border border-[#ffc627]/40 bg-[#002855] text-xs font-bold text-[#ffc627]">
              <Crown className="h-3.5 w-3.5" /> Master Admin
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {userName}. Exclusive authority to manage seasons, access whitelist, and assign roles across all users.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-semibold text-muted-foreground">Active Members</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.activeMembers}
              </p>
              <p className="mt-1 text-[11px] text-[#00629b]">Across {kpis.committeeCount} committees</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-semibold text-muted-foreground">Sessions Logged</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.sessionsCount}
              </p>
              <p className="mt-1 text-[11px] text-[#1e6b0a]">Active season</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-semibold text-muted-foreground">Pending Grading</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                {kpis.pendingGradingCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Open task submissions</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-semibold text-muted-foreground">Published Months</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.publishedMonthsCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Frozen leaderboard snapshots</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="flex flex-col border-border bg-white shadow-xs">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#002855]/10 text-[#002855]">
                <CalendarDays className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Season Lifecycle &amp; Settings
              </h3>
              <p className="text-xs text-muted-foreground">
                Create new seasons, activate or archive operational terms, and configure scoring rules with zero code edits.
              </p>
              <div className="mt-auto pt-2">
                <Link
                  href="/hr/seasons"
                  className={buttonVariants({
                    size: "sm",
                    className: "w-full bg-[#002855] text-xs font-semibold text-white hover:bg-[#772583]",
                  })}
                >
                  Season Lifecycle &amp; Clone
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col border-border bg-white shadow-xs">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#772583]/10 text-[#772583]">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Roster Whitelist &amp; Roles
              </h3>
              <p className="text-xs text-muted-foreground">
                Grant email whitelist authorization, assign roles (Director, HR Admin, Head), and CSV bulk import.
              </p>
              <div className="mt-auto pt-2">
                <Link
                  href="/hr/roster"
                  className={buttonVariants({
                    size: "sm",
                    className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                  })}
                >
                  Roster Whitelist &amp; Roles
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col border-border bg-white shadow-xs">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Leaderboard Snapshots
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit monthly rankings and publish permanent historical snapshots to public leaderboards.
              </p>
              <div className="mt-auto pt-2">
                <Link
                  href="/hr/publishing"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "w-full text-xs font-semibold",
                  })}
                >
                  Leaderboard Publishing
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 5. HR MEMBER VIEW
  return (
    <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-[#002855]">
                Committee HR Operations
              </h2>
              {committeeName && (
                <Badge className="bg-[#007377] text-white text-xs font-semibold">
                  {committeeName}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Welcome back, {userName}. Manage meeting check-ins, committee HR tasks, and points for your assigned committee.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007377]/10 text-[#007377]">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-[#002855]">
                  Live QR Session Check-in
                </h3>
                <p className="text-xs text-muted-foreground">
                  Open auto-closing QR check-ins or manage per-session attendance sheets directly.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/attendance"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#007377] text-xs font-semibold text-white hover:bg-[#002855]",
                    })}
                  >
                    Live QR Check-in
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-[#002855]">
                  Committee HR Tasks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Create and verify self-report or HR-only tasks for your tracked committee.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/tasks"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                    })}
                  >
                    Manage Tasks
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-[#002855]">
                  Points Ledger &amp; Overrides
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review and adjust attendance points or bonuses for your tracked committee.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/ledger"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Award Attendance Points
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border bg-white shadow-xs">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#5a1b63]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-[#002855]">
                  Feedback &amp; Warnings
                </h3>
                <p className="text-xs text-muted-foreground">
                  Send recognitions, official warnings, or hidden HR notes for your tracked committee.
                </p>
                <div className="mt-auto pt-2">
                  <Link
                    href="/hr/feedback"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold",
                    })}
                  >
                    Open Feedback &amp; Warnings
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
  );
}
