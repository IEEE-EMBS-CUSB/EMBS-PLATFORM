"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Lock,
  Send,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { TaskCheckToggle } from "@/components/member/task-check-toggle";
import { TaskSubmitForm } from "@/components/member/task-submit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MemberCombobox,
  type MemberComboboxOption,
} from "@/components/ui/member-combobox";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canAssignTask,
  canAssignTaskToRole,
  getAllowedWorkTypesForRole,
  getDefaultWorkTypeForRole,
  type WorkItemType,
} from "@/lib/permissions";
import {
  DEFAULT_SEASON_SETTINGS,
  type SeasonTaskSettings,
  type TaskCompletionMode,
} from "@/lib/season-settings";
import {
  createTaskAction,
  type TaskTargetGroup,
  type TaskTargetType,
} from "@/app/hr/tasks/actions";

export interface AssignedTaskItem {
  id: string;
  title: string;
  workType?: WorkItemType;
  completionMode?: TaskCompletionMode;
  assignedByName: string;
  assignerRole: MembershipRole;
  dueAt: Date;
  maxPoints: number;
  status: "not_started" | "in_progress" | "completed";
  submissionUrl?: string | null;
  submissionText?: string | null;
}

export interface EligibleAssignee {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string | null;
  role: MembershipRole;
  committeeId?: string | null;
  committeeName?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assignedToMembershipId?: string;
  dueAt: string;
  maxPoints: number;
  workType: WorkItemType;
  completionMode?: TaskCompletionMode;
  targetType?: TaskTargetType;
  targetGroup?: TaskTargetGroup;
  targetCommitteeId?: string | null;
}

export interface CommitteeOption {
  id: string;
  name: string;
}

interface TaskDelegationViewProps {
  currentUserRole: MembershipRole;
  currentUserId: string;
  currentUserCommitteeId?: string | null;
  defaultMaxPoints?: number;
  taskDefaults?: SeasonTaskSettings;
  assignedToMe?: AssignedTaskItem[];
  eligibleMembers?: EligibleAssignee[];
  committees?: CommitteeOption[];
  onCreateTask?: (payload: CreateTaskPayload) => void | Promise<void>;
}

interface TargetGroupOption {
  value: TaskTargetGroup;
  label: string;
}

const ROLE_LABELS: Record<MembershipRole, string> = {
  master_admin: "Master",
  director: "Director",
  hr_admin: "HR Admin",
  hr_member: "HR Member",
  committee_head: "Head",
  member: "Member",
  attendee: "Attendee",
};

function getTargetGroupOptions(
  role: MembershipRole,
  workType: WorkItemType
): TargetGroupOption[] {
  if (role === "master_admin") {
    return [
      { value: "everyone", label: "Everyone (All Chapter Members)" },
      { value: "all_heads", label: "All Committee Heads" },
      { value: "all_members", label: "All Regular Members" },
      { value: "all_hr_members", label: "HR Committee (All HR Members)" },
      { value: "committee_all", label: "Committee: All (Heads & Members)" },
      { value: "committee_heads", label: "Committee: Heads Only" },
      { value: "committee_members", label: "Committee: Members Only" },
    ];
  }

  if (role === "director") {
    return [
      { value: "all_heads", label: "All Committee Heads" },
      { value: "all_members", label: "All Regular Members" },
      { value: "everyone", label: "Everyone (Heads & Members in Scope)" },
      { value: "committee_all", label: "Committee: All (Heads & Members)" },
      { value: "committee_heads", label: "Committee: Heads Only" },
      { value: "committee_members", label: "Committee: Members Only" },
    ];
  }

  if (role === "hr_admin") {
    if (workType === "assignment") {
      return [
        { value: "all_hr_members", label: "HR Committee (All HR Members)" },
      ];
    }
    return [
      { value: "everyone", label: "Everyone (All Chapter Members)" },
      { value: "all_heads", label: "All Committee Heads" },
      { value: "all_members", label: "All Regular Members" },
      { value: "all_hr_members", label: "HR Committee (All HR Members)" },
      { value: "committee_all", label: "Committee: All (Heads & Members)" },
      { value: "committee_heads", label: "Committee: Heads Only" },
      { value: "committee_members", label: "Committee: Members Only" },
    ];
  }

  return [
    { value: "committee_members", label: "All Members of My Committee" },
  ];
}

export function TaskDelegationView({
  currentUserRole,
  currentUserId,
  currentUserCommitteeId = null,
  defaultMaxPoints = 100,
  taskDefaults = DEFAULT_SEASON_SETTINGS.tasks,
  assignedToMe = [],
  eligibleMembers = [],
  committees: initialCommittees,
  onCreateTask,
}: TaskDelegationViewProps) {
  const allowedWorkTypes = useMemo(
    () => getAllowedWorkTypesForRole(currentUserRole),
    [currentUserRole]
  );
  const canChooseWorkType = allowedWorkTypes.length > 1;
  const [workType, setWorkType] = useState<WorkItemType>(() =>
    getDefaultWorkTypeForRole(currentUserRole)
  );
  const effectiveWorkType: WorkItemType = canChooseWorkType
    ? workType
    : allowedWorkTypes[0] ?? getDefaultWorkTypeForRole(currentUserRole);

  const isAssignment = effectiveWorkType === "assignment";
  const singularLabel = isAssignment ? "Assignment" : "Task";
  const isCommitteeScopedCreator =
    currentUserRole === "committee_head" || currentUserRole === "hr_member";

  const targetGroupOptions = useMemo(
    () => getTargetGroupOptions(currentUserRole, effectiveWorkType),
    [currentUserRole, effectiveWorkType]
  );

  const [targetType, setTargetType] =
    useState<TaskTargetType>("specific_person");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [targetGroup, setTargetGroup] = useState<TaskTargetGroup>(
    () => targetGroupOptions[0]?.value ?? "committee_members"
  );
  const [targetCommitteeId, setTargetCommitteeId] = useState<string>(
    currentUserCommitteeId ?? ""
  );
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [maxPoints, setMaxPoints] = useState(() =>
    effectiveWorkType === "task"
      ? taskDefaults.defaultTaskPoints
      : defaultMaxPoints
  );
  const [pointsManuallyEdited, setPointsManuallyEdited] = useState(false);
  const [completionMode, setCompletionMode] = useState<TaskCompletionMode>(
    taskDefaults.defaultCompletionMode
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveTargetGroup = useMemo<TaskTargetGroup>(() => {
    if (targetGroupOptions.some((opt) => opt.value === targetGroup)) {
      return targetGroup;
    }
    return targetGroupOptions[0]?.value ?? "committee_members";
  }, [targetGroupOptions, targetGroup]);

  const committees = useMemo(() => {
    if (initialCommittees && initialCommittees.length > 0) {
      return initialCommittees;
    }
    const map = new Map<string, string>();
    for (const m of eligibleMembers) {
      if (m.committeeId && m.committeeName) {
        map.set(m.committeeId, m.committeeName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [initialCommittees, eligibleMembers]);

  const assignableMembers = useMemo(() => {
    return eligibleMembers.filter((m) =>
      canAssignTask(
        {
          id: currentUserId,
          email: "",
          role: currentUserRole,
          committeeId: currentUserCommitteeId,
        },
        {
          id: m.id,
          email: "",
          role: m.role,
          committeeId: m.committeeId ?? null,
        },
        effectiveWorkType
      )
    );
  }, [
    eligibleMembers,
    currentUserRole,
    currentUserId,
    currentUserCommitteeId,
    effectiveWorkType,
  ]);

  const effectiveSelectedAssignee = useMemo(() => {
    if (!selectedAssignee) return "";
    return assignableMembers.some((m) => m.id === selectedAssignee)
      ? selectedAssignee
      : "";
  }, [selectedAssignee, assignableMembers]);

  const canAssignAny = useMemo(() => {
    const roles: MembershipRole[] = [
      "director",
      "committee_head",
      "hr_admin",
      "hr_member",
      "member",
    ];
    return roles.some((r) =>
      canAssignTaskToRole(currentUserRole, r, effectiveWorkType)
    );
  }, [currentUserRole, effectiveWorkType]);

  const assigneeComboboxOptions = useMemo<MemberComboboxOption[]>(
    () =>
      assignableMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        phoneNumber: m.phoneNumber ?? null,
        committeeName: m.committeeName,
        roleLabel: ROLE_LABELS[m.role],
      })),
    [assignableMembers]
  );

  const isCommitteeGroup =
    effectiveTargetGroup === "committee_all" ||
    effectiveTargetGroup === "committee_heads" ||
    effectiveTargetGroup === "committee_members";

  const formHeading = (() => {
    switch (currentUserRole) {
      case "director":
        return "Delegate Assignments to Heads & Members";
      case "committee_head":
        return "Create Committee Assignments";
      case "hr_member":
        return "Assign Committee HR Tasks";
      case "hr_admin":
        return "Create Tasks & HR Assignments";
      case "master_admin":
        return "Create Chapter Tasks & Assignments";
      default:
        return "Create Deliverable";
    }
  })();

  const handleSwitchWorkType = (nextType: WorkItemType) => {
    setWorkType(nextType);
    const nextOptions = getTargetGroupOptions(currentUserRole, nextType);
    if (!nextOptions.some((opt) => opt.value === targetGroup)) {
      setTargetGroup(nextOptions[0]?.value ?? "committee_members");
    }
    if (!pointsManuallyEdited) {
      setMaxPoints(
        nextType === "task" ? taskDefaults.defaultTaskPoints : defaultMaxPoints
      );
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (targetType === "specific_person" && !effectiveSelectedAssignee) return;

    if (
      targetType === "group" &&
      isCommitteeGroup &&
      !isCommitteeScopedCreator &&
      !targetCommitteeId
    ) {
      setErrorMessage("Please select a target committee for this group.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: CreateTaskPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt,
      maxPoints,
      workType: effectiveWorkType,
      completionMode: effectiveWorkType === "task" ? completionMode : undefined,
      targetType,
      assignedToMembershipId:
        targetType === "specific_person"
          ? effectiveSelectedAssignee
          : undefined,
      targetGroup: targetType === "group" ? effectiveTargetGroup : undefined,
      targetCommitteeId:
        targetType === "group" && isCommitteeGroup
          ? targetCommitteeId || currentUserCommitteeId || null
          : undefined,
    };

    try {
      if (onCreateTask) {
        await onCreateTask(payload);
      } else {
        const res = await createTaskAction({
          ...payload,
          targetType,
        });
        if (!res.ok) {
          setErrorMessage(
            res.error || `Failed to create ${singularLabel.toLowerCase()}.`
          );
          return;
        }
      }
      setTitle("");
      setDescription("");
      setSelectedAssignee("");
      setSuccessNotice(`${singularLabel} created and assigned successfully.`);
      setTimeout(() => setSuccessNotice(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setErrorMessage(
        msg && !/minified react error|server components render/i.test(msg)
          ? msg
          : `Error creating ${singularLabel.toLowerCase()}.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Items Assigned to Me */}
      {assignedToMe.length > 0 && (
        <div className="space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Assigned to You
            </h2>
            <p className="text-xs text-muted-foreground">
              Assignments from leadership and tasks from HR assigned to your
              role.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {assignedToMe.map((item) => {
              const itemIsTask = item.workType === "task";
              return (
                <Card
                  key={item.id}
                  className="border-border bg-white shadow-xs transition-all hover:border-[#772583]"
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={
                            itemIsTask
                              ? "bg-[#772583] text-[11px] font-semibold text-white"
                              : "bg-[#00629b] text-[11px] font-semibold text-white"
                          }
                        >
                          {itemIsTask ? "Task" : "Assignment"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-semibold capitalize"
                        >
                          {item.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <span className="font-mono text-xs font-bold tabular-nums text-[#002855]">
                        {item.maxPoints} pts
                      </span>
                    </div>
                    <CardTitle className="mt-1 font-heading text-base font-bold text-[#002855]">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 text-foreground/85">
                      <UserCheck
                        className="h-3.5 w-3.5 text-[#00629b]"
                        aria-hidden="true"
                      />
                      <span>
                        Assigned by {ROLE_LABELS[item.assignerRole]}{" "}
                        {item.assignedByName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>
                        Due {new Date(item.dueAt).toLocaleDateString()}
                      </span>
                    </div>

                    {item.submissionUrl &&
                      /^https?:\/\//i.test(item.submissionUrl) && (
                        <div className="pt-1">
                          <a
                            href={item.submissionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#00629b] underline-offset-2 hover:underline"
                          >
                            <ExternalLink
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            Open submitted link
                          </a>
                        </div>
                      )}

                    {!itemIsTask ? (
                      item.status !== "completed" ? (
                        <div className="border-t border-border/60 pt-2">
                          <TaskSubmitForm
                            taskId={item.id}
                            requireUrl
                            initialUrl={item.submissionUrl}
                            initialText={item.submissionText}
                          />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[#1e6b0a]">
                          <CheckCircle2
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Graded
                        </div>
                      )
                    ) : item.completionMode === "hr_only" ? (
                      <div className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[#002855]">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        {item.status === "completed"
                          ? "Verified completed"
                          : "Awaiting verification"}
                      </div>
                    ) : (
                      <div className="border-t border-border/60 pt-2">
                        <TaskCheckToggle
                          taskId={item.id}
                          title={item.title}
                          maxPoints={item.maxPoints}
                          initialCompleted={item.status === "completed"}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Creation & Delegation Form */}
      {canAssignAny && (
        <Card className="border-border bg-white shadow-xs">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-heading text-lg font-bold text-[#002855]">
                  {formHeading}
                </CardTitle>
                {currentUserRole === "hr_admin" && isAssignment && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    HR Admin assignments go to HR committee members. Switch to
                    Task to assign chapter-wide tasks.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canChooseWorkType && (
                  <div
                    role="group"
                    aria-label="Work item type"
                    className="inline-flex rounded-lg border border-border bg-[#f8f9fb] p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => handleSwitchWorkType("assignment")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                        effectiveWorkType === "assignment"
                          ? "bg-[#00629b] text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Assignment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchWorkType("task")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                        effectiveWorkType === "task"
                          ? "bg-[#772583] text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Task
                    </button>
                  </div>
                )}

                {/* Segmented Toggle for Individual vs Group */}
                <div className="inline-flex rounded-lg border border-border bg-[#002855]/5 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTargetType("specific_person")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      targetType === "specific_person"
                        ? "bg-white text-[#772583] shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("group")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      targetType === "group"
                        ? "bg-[#772583] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Group
                  </button>
                </div>
              </div>
            </div>

            {successNotice && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-[#78be20]/15 px-2.5 py-1 text-xs font-semibold text-[#1e6b0a]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {successNotice}
              </div>
            )}
            {errorMessage && (
              <div
                role="alert"
                className="mt-2 rounded bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
              >
                {errorMessage}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="task-title-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    {singularLabel} Title
                  </label>
                  <Input
                    id="task-title-input"
                    type="text"
                    required
                    placeholder={
                      isAssignment
                        ? "e.g. Finalize Midterm Curriculum"
                        : "e.g. Submit Monthly Attendance Sheet"
                    }
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>

                {targetType === "specific_person" ? (
                  <div className="min-w-0">
                    <label
                      htmlFor="task-assignee-select"
                      className="block font-heading text-xs font-bold text-[#002855]"
                    >
                      Assign To
                    </label>
                    <div className="mt-1">
                      <MemberCombobox
                        id="task-assignee-select"
                        ariaLabel="Assign to"
                        options={assigneeComboboxOptions}
                        value={effectiveSelectedAssignee}
                        onChange={setSelectedAssignee}
                        placeholder="Type a member's name, email, phone, or committee..."
                        emptyText="No eligible recipients match your search."
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="task-group-select"
                      className="block font-heading text-xs font-bold text-[#002855]"
                    >
                      Target Group
                    </label>
                    <div className="relative mt-1">
                      <select
                        id="task-group-select"
                        aria-label="Target group"
                        required
                        value={effectiveTargetGroup}
                        onChange={(e) =>
                          setTargetGroup(e.target.value as TaskTargetGroup)
                        }
                        className="block h-10 w-full appearance-none truncate rounded-lg border border-border bg-white py-2 pr-9 pl-3 text-xs leading-normal font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                      >
                        {targetGroupOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                )}
              </div>

              {targetType === "group" &&
                isCommitteeGroup &&
                !isCommitteeScopedCreator && (
                  <div>
                    <label
                      htmlFor="task-committee-select"
                      className="block font-heading text-xs font-bold text-[#002855]"
                    >
                      Select Committee
                    </label>
                    <div className="relative mt-1">
                      <select
                        id="task-committee-select"
                        aria-label="Target committee"
                        required
                        value={targetCommitteeId}
                        onChange={(e) => setTargetCommitteeId(e.target.value)}
                        className="block h-10 w-full appearance-none truncate rounded-lg border border-border bg-white py-2 pr-9 pl-3 text-xs leading-normal font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                      >
                        <option value="">Choose committee...</option>
                        {committees.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                )}

              {/* Task Completion Mode Selector (Self-Report vs HR-Only) */}
              {!isAssignment && (
                <div className="rounded-lg border border-border/80 bg-[#f8f9fb] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-heading text-xs font-bold text-[#002855]">
                        Task Completion Mode
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {completionMode === "hr_only"
                          ? "HR-Only: only HR or the assigner can mark this task completed. Members see a read-only status."
                          : "Self-Report: members can check off this task on their portal, or HR can toggle it."}
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="Task completion mode"
                      className="inline-flex shrink-0 rounded-lg border border-border bg-white p-0.5"
                    >
                      <button
                        type="button"
                        aria-pressed={completionMode === "self_report"}
                        onClick={() => setCompletionMode("self_report")}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                          completionMode === "self_report"
                            ? "bg-[#772583] text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Self-Report
                      </button>
                      <button
                        type="button"
                        aria-pressed={completionMode === "hr_only"}
                        onClick={() => setCompletionMode("hr_only")}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                          completionMode === "hr_only"
                            ? "bg-[#002855] text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        HR-Only
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="task-desc-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Details &amp; Guidelines
                  </label>
                  <Input
                    id="task-desc-input"
                    type="text"
                    placeholder="Key requirements, links, or expectations"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-due-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Due Date
                  </label>
                  <Input
                    id="task-due-input"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="mt-1 h-10 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-points-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    {isAssignment ? "Max Points" : "Task Points"}
                  </label>
                  <Input
                    id="task-points-input"
                    type="number"
                    min={1}
                    max={500}
                    value={maxPoints}
                    onChange={(e) => {
                      setPointsManuallyEdited(true);
                      setMaxPoints(parseInt(e.target.value, 10) || 15);
                    }}
                    className="mt-1 h-10 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !title.trim() ||
                    (targetType === "specific_person" &&
                      !effectiveSelectedAssignee) ||
                    (targetType === "group" &&
                      isCommitteeGroup &&
                      !isCommitteeScopedCreator &&
                      !targetCommitteeId)
                  }
                  className={
                    isAssignment
                      ? "h-10 gap-2 bg-[#00629b] px-5 text-xs font-bold text-white hover:bg-[#002855]"
                      : "h-10 gap-2 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
                  }
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {targetType === "group"
                      ? `Create Group ${singularLabel}`
                      : `Create ${singularLabel}`}
                  </span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
