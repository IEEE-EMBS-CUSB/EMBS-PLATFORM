"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Send,
  UserCheck,
  Users,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MembershipRole } from "@/lib/auth-helpers";
import {
  canAssignTask,
  canAssignTaskToRole,
  getAllowedWorkTypesForRole,
  getDefaultWorkTypeForRole,
  type WorkItemType,
} from "@/lib/permissions";
import {
  createTaskAction,
  type TaskTargetGroup,
  type TaskTargetType,
} from "@/app/hr/tasks/actions";

export interface AssignedTaskItem {
  id: string;
  title: string;
  workType?: WorkItemType;
  assignedByName: string;
  assignerRole: MembershipRole;
  dueAt: Date;
  maxPoints: number;
  status: "not_started" | "in_progress" | "completed";
}

export interface EligibleAssignee {
  id: string;
  fullName: string;
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
  assignedToMe?: AssignedTaskItem[];
  eligibleMembers?: EligibleAssignee[];
  committees?: CommitteeOption[];
  onCreateTask?: (payload: CreateTaskPayload) => void | Promise<void>;
}

export function TaskDelegationView({
  currentUserRole,
  currentUserId,
  currentUserCommitteeId = null,
  defaultMaxPoints = 100,
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

  const [targetType, setTargetType] = useState<TaskTargetType>("specific_person");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const defaultTargetGroup: TaskTargetGroup =
    currentUserRole === "committee_head" || currentUserRole === "hr_member"
      ? "committee_members"
      : currentUserRole === "director"
        ? "all_heads"
        : currentUserRole === "hr_admin"
          ? "all_members"
          : "everyone";

  const [targetGroup, setTargetGroup] =
    useState<TaskTargetGroup>(defaultTargetGroup);
  const [targetCommitteeId, setTargetCommitteeId] = useState<string>(
    currentUserCommitteeId ?? ""
  );
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [maxPoints, setMaxPoints] = useState(defaultMaxPoints);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        }
      )
    );
  }, [eligibleMembers, currentUserRole, currentUserId, currentUserCommitteeId]);

  const canAssignAny = useMemo(() => {
    const roles: MembershipRole[] = [
      "director",
      "committee_head",
      "hr_admin",
      "hr_member",
      "member",
    ];
    return roles.some((r) => canAssignTaskToRole(currentUserRole, r));
  }, [currentUserRole]);

  const roleLabels: Record<MembershipRole, string> = {
    master_admin: "Master",
    director: "Director",
    hr_admin: "HR Admin",
    hr_member: "HR Member",
    committee_head: "Head",
    member: "Member",
    attendee: "Attendee",
  };

  const isCommitteeGroup =
    targetGroup === "committee_all" ||
    targetGroup === "committee_heads" ||
    targetGroup === "committee_members";

  const formHeading = (() => {
    switch (currentUserRole) {
      case "director":
        return "Delegate Assignments to Heads & HR Admin";
      case "committee_head":
        return "Create Committee Assignments";
      case "hr_member":
        return "Assign Committee HR Tasks";
      case "hr_admin":
        return "Create Tasks & Assignments";
      case "master_admin":
        return "Create Chapter Tasks & Assignments";
      default:
        return "Create Deliverable";
    }
  })();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (targetType === "specific_person" && !selectedAssignee) return;

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
      targetType,
      assignedToMembershipId:
        targetType === "specific_person" ? selectedAssignee : undefined,
      targetGroup: targetType === "group" ? targetGroup : undefined,
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
          setErrorMessage(res.error || `Failed to create ${singularLabel.toLowerCase()}.`);
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
              Assignments from leadership and tasks from HR assigned to your role.
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
                              ? "bg-[#772583] text-white text-[11px] font-semibold"
                              : "bg-[#00629b] text-white text-[11px] font-semibold"
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
                      <span className="font-mono text-xs font-bold text-[#002855] tabular-nums">
                        {item.maxPoints} pts
                      </span>
                    </div>
                    <CardTitle className="mt-1 font-heading text-base font-bold text-[#002855]">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 text-foreground/85">
                      <UserCheck className="h-3.5 w-3.5 text-[#00629b]" aria-hidden="true" />
                      <span>
                        Assigned by {roleLabels[item.assignerRole]} {item.assignedByName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>
                        Due {new Date(item.dueAt).toLocaleDateString()}
                      </span>
                    </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="font-heading text-lg font-bold text-[#002855]">
                    {formHeading}
                  </CardTitle>
                  {!canChooseWorkType && (
                    <Badge
                      className={
                        isAssignment
                          ? "bg-[#ebf3f8] text-[#00629b] text-[11px] font-semibold"
                          : "bg-[#f5edf7] text-[#5a1b63] text-[11px] font-semibold"
                      }
                    >
                      {singularLabel}s only
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canChooseWorkType
                    ? "Master Admin and HR Admin can issue both leadership Assignments and HR Tasks."
                    : isAssignment
                      ? "Director and Committee Head deliverables are recorded as Assignments."
                      : "HR deliverables for your committee are recorded as Tasks."}
                </p>
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
                      onClick={() => setWorkType("assignment")}
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
                      onClick={() => setWorkType("task")}
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
                  <div>
                    <label
                      htmlFor="task-assignee-select"
                      className="block font-heading text-xs font-bold text-[#002855]"
                    >
                      Assign To
                    </label>
                    <div className="relative mt-1">
                      <select
                        id="task-assignee-select"
                        aria-label="Assign to"
                        required
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        className="block h-10 w-full appearance-none truncate rounded-lg border border-border bg-white py-2 pr-9 pl-3 text-xs leading-normal font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                      >
                        <option value="">Select recipient...</option>
                        {assignableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({roleLabels[m.role]})
                            {m.committeeName ? ` — ${m.committeeName}` : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
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
                        value={targetGroup}
                        onChange={(e) =>
                          setTargetGroup(e.target.value as TaskTargetGroup)
                        }
                        className="block h-10 w-full appearance-none truncate rounded-lg border border-border bg-white py-2 pr-9 pl-3 text-xs leading-normal font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                      >
                        {currentUserRole === "master_admin" ? (
                          <>
                            <option value="everyone">
                              Everyone (All Chapter Members)
                            </option>
                            <option value="all_heads">All Committee Heads</option>
                            <option value="all_members">
                              All Regular Members
                            </option>
                            <option value="committee_all">
                              Committee: All (Heads & Members)
                            </option>
                            <option value="committee_heads">
                              Committee: Heads Only
                            </option>
                            <option value="committee_members">
                              Committee: Members Only
                            </option>
                          </>
                        ) : currentUserRole === "director" ? (
                          <>
                            <option value="all_heads">All Committee Heads</option>
                            <option value="committee_heads">
                              Committee: Heads Only
                            </option>
                          </>
                        ) : currentUserRole === "hr_admin" ? (
                          <>
                            <option value="all_members">
                              All Regular Members
                            </option>
                            <option value="committee_members">
                              Committee: Members Only
                            </option>
                            <option value="committee_all">
                              Committee: All (Heads & Members)
                            </option>
                          </>
                        ) : (
                          <option value="committee_members">
                            All Members of My Committee
                          </option>
                        )}
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

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="task-desc-input"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Details & Guidelines
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
                    Max Points
                  </label>
                  <Input
                    id="task-points-input"
                    type="number"
                    min={1}
                    max={500}
                    value={maxPoints}
                    onChange={(e) =>
                      setMaxPoints(parseInt(e.target.value, 10) || 100)
                    }
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
                    (targetType === "specific_person" && !selectedAssignee) ||
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
