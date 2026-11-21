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
              <CardContent className="space-y-1.5 pt-0 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground/85">
                  <UserCheck className="h-3.5 w-3.5 text-[#00629b]" />
                  <span>
                    Assigned by {formatAssignerPrefix(task.assignerRole)}
                    {task.assignedByName && task.assignedByName !== "Leadership"
                      ? ` ${task.assignedByName}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Due {new Date(task.dueAt).toLocaleDateString()}</span>
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
      <div className="space-y-10">
        {renderAssignedTasksSection(
          "My Deliverables (Assigned by Director)",
          "Specific milestones and curriculum tasks assigned to you by chapter directors."
        )}

        <div className="space-y-6 border-t border-border pt-8">
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
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
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">Assigned Tasks</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.assignedTasksCount}
                </p>
                <p className="mt-1 text-[11px] text-[#1e6b0a]">Active deliverables</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">Pending Grading</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                  {kpis.pendingGradingCount}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Submissions to score</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">Avg Member Points</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.avgMemberPoints}
                </p>
                <p className="mt-1 text-[11px] text-[#007377]">Current season average</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Task Assignments & Bulk Grading
                </h3>
                <p className="text-xs text-muted-foreground">
                  Create committee deliverables or tab across Effort, Quality, and Timeliness to grade members.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href="/hr/tasks"
                    className={buttonVariants({
                      size: "sm",
                      className: "w-full bg-[#00629b] text-xs font-semibold text-white hover:bg-[#002855]",
                    })}
                  >
                    Assign Tasks to Members
                  </Link>
                  <Link
                    href="/hr/tasks"
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

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Committee Bonus & Points
                </h3>
                <p className="text-xs text-muted-foreground">
                  Award custom bonus points with required justifications to members in your committee.
                </p>
                <div className="pt-1">
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

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#007377]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Member Feedback & Reviews
                </h3>
                <p className="text-xs text-muted-foreground">
                  Write constructive evaluations and public shoutouts for your committee members.
                </p>
                <div className="pt-1">
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
      </div>
    );
  }

  // 2. DIRECTOR VIEW
  if (currentUserRole === "director") {
    return (
      <div className="space-y-10">
        {renderAssignedTasksSection(
          "Executive Directives & Roadmap",
          "High-level strategic deliverables and milestones overseen by chapter directorship."
        )}

        <div className="space-y-6 border-t border-border pt-8">
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
              Welcome back, Director {userName}. Supervise all {kpis.committeeCount || "chapter"} committees, assign deliverables directly to Committee Heads and HR Admins, and review chapter standings.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5a1b63]/10 text-[#5a1b63]">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Heads Task Delegation
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assign deadlines, roadmaps, and requirements to Committee Heads and HR Administrators.
                </p>
                <Link
                  href="/hr/tasks"
                  className={buttonVariants({
                    size: "sm",
                    className: "w-full bg-[#5a1b63] text-xs font-semibold text-white hover:bg-[#002855]",
                  })}
                >
                  Delegate Tasks to Heads
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Committees & Rubrics Review
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review technical and non-technical tracks and scoring rubrics for the active season.
                </p>
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
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Points Ledger Audit
                </h3>
                <p className="text-xs text-muted-foreground">
                  Inspect score derivation, bonus logs, and branch-wide activity records.
                </p>
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // 3. HR ADMIN VIEW
  if (currentUserRole === "hr_admin") {
    return (
      <div className="space-y-10">
        {renderAssignedTasksSection(
          "Directives from Director",
          "Tasks and operational mandates assigned to HR Administration by chapter directors."
        )}

        <div className="space-y-6 border-t border-border pt-8">
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
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
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">HR Officers</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#007377] tabular-nums">
                  {kpis.hrOfficers}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Assigned to committees</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">Attendance Sessions</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                  {kpis.sessionsCount}
                </p>
                <p className="mt-1 text-[11px] text-[#1e6b0a]">Logged this season</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground">Published Months</p>
                <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                  {kpis.publishedMonthsCount}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Frozen leaderboard snapshots</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5edf7] text-[#772583]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Roster & Committee HR Assignments
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assign HR members to specific committees and manage active roster membership.
                </p>
                <Link
                  href="/hr/roster"
                  className={buttonVariants({
                    size: "sm",
                    className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                  })}
                >
                  Assign HR Members
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#007377]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Publish Monthly Leaderboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Preview computed Top 10 rankings and permanently freeze historical snapshot.
                </p>
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
              </CardContent>
            </Card>

            <Card className="border-border bg-white shadow-xs">
              <CardContent className="p-5 space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-[#002855]">
                  Scoring Rubrics & Categories
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure weighted rubric criteria and category definitions for the active season.
                </p>
                <Link
                  href="/hr/committees"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "w-full text-xs font-semibold",
                  })}
                >
                  Manage Scoring Rubrics
                </Link>
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855]">
              Master Authority & Chapter Governance
            </h1>
            <Badge className="bg-[#002855] text-[#ffc627] border border-[#ffc627]/40 text-xs font-bold gap-1">
              <Crown className="h-3.5 w-3.5" /> Super Admin
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {userName}. Exclusive authority to manage seasons, access whitelist, and assign roles across all users.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground">Active Members</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.activeMembers}
              </p>
              <p className="mt-1 text-[11px] text-[#00629b]">Across {kpis.committeeCount} committees</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground">Sessions Logged</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.sessionsCount}
              </p>
              <p className="mt-1 text-[11px] text-[#1e6b0a]">Active season</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground">Pending Grading</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#772583] tabular-nums">
                {kpis.pendingGradingCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Open task submissions</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground">Published Months</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#002855] tabular-nums">
                {kpis.publishedMonthsCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Frozen leaderboard snapshots</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#002855]/10 text-[#002855]">
                <CalendarDays className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Season Lifecycle & Clone
              </h3>
              <p className="text-xs text-muted-foreground">
                Create new seasons, activate or archive operational terms, and clone rubrics with zero code edits.
              </p>
              <Link
                href="/hr/seasons"
                className={buttonVariants({
                  size: "sm",
                  className: "w-full bg-[#002855] text-xs font-semibold text-white hover:bg-[#772583]",
                })}
              >
                Season Lifecycle & Clone
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#772583]/10 text-[#772583]">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Roster Whitelist & Roles
              </h3>
              <p className="text-xs text-muted-foreground">
                Grant email whitelist authorization, assign roles (Director, HR Admin, Head), and CSV bulk import.
              </p>
              <Link
                href="/hr/roster"
                className={buttonVariants({
                  size: "sm",
                  className: "w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
                })}
              >
                Roster Whitelist & Roles
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Leaderboard Snapshots
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit monthly rankings and publish permanent historical snapshots to public leaderboards.
              </p>
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 5. HR MEMBER VIEW
  return (
    <div className="space-y-10">
      {renderAssignedTasksSection(
        "My Tasks (From HR Admin)",
        "Directives and operational assignments from chapter HR administration."
      )}

      <div className="space-y-6 border-t border-border pt-8">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-[#002855]">
              Committee Attendance Operations
            </h2>
            {committeeName && (
              <Badge className="bg-[#007377] text-white text-xs font-semibold">
                {committeeName}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Welcome back, {userName}. Manage meeting check-ins, rotating QR codes, and punctuality bonus points for your assigned committee.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007377]/10 text-[#007377]">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Live QR Session Check-in
              </h3>
              <p className="text-xs text-muted-foreground">
                Open a session check-in with a full-screen rotating QR code and 6-digit numeric fallback for instant logging.
              </p>
              <Link
                href="/hr/attendance"
                className={buttonVariants({
                  size: "sm",
                  className: "w-full bg-[#007377] text-xs font-semibold text-white hover:bg-[#002855]",
                })}
              >
                Live QR Check-in
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-white shadow-xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ebf3f8] text-[#00629b]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#002855]">
                Points Ledger & Attendance Overrides
              </h3>
              <p className="text-xs text-muted-foreground">
                Manually record or adjust attendance points and punctuality bonuses for committee members.
              </p>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
