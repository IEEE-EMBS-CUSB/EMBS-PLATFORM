"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculateRubricPoints,
  DEFAULT_SEASON_SETTINGS,
  type SeasonGradingSettings,
  type TaskCompletionMode,
} from "@/lib/season-settings";

export interface TaskHeaderRef {
  id: string;
  title: string;
  workType?: "assignment" | "task";
  completionMode?: TaskCompletionMode;
  committeeName: string;
  maxPoints: number;
}

export interface SubmissionGradingItem {
  submissionId?: string;
  membershipId: string;
  memberName: string;
  effortScore: number | null;
  qualityScore: number | null;
  timelinessScore: number | null;
  totalPoints: number | null;
  notes: string;
  submissionUrl?: string | null;
  submissionText?: string | null;
  submittedAt?: string | null;
  completed?: boolean;
}

interface BulkTaskGradingViewProps {
  task: TaskHeaderRef;
  submissions: SubmissionGradingItem[];
  gradingWeights?: SeasonGradingSettings;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  readOnly?: boolean;
  onGrade?: (input: {
    submissionId: string;
    effortScore: number;
    qualityScore: number;
    timelinessScore: number;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string } | void>;
  onToggleTask?: (input: {
    submissionId: string;
    completed: boolean;
  }) => Promise<
    | { ok: boolean; completed?: boolean; totalPoints?: number; error?: string }
    | void
  >;
}

function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSubmissionSubmitted(sub: SubmissionGradingItem): boolean {
  return Boolean(
    sub.submittedAt ||
      sub.submissionUrl?.trim() ||
      sub.submissionText?.trim() ||
      sub.totalPoints !== null
  );
}

export function BulkTaskGradingView({
  task,
  submissions: initialSubmissions,
  gradingWeights = DEFAULT_SEASON_SETTINGS.grading,
  collapsible = false,
  defaultExpanded = true,
  readOnly = false,
  onGrade,
  onToggleTask,
}: BulkTaskGradingViewProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [prevInitialSubmissions, setPrevInitialSubmissions] =
    useState(initialSubmissions);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (initialSubmissions !== prevInitialSubmissions) {
    setPrevInitialSubmissions(initialSubmissions);
    setSubmissions(initialSubmissions);
    setHasUnsavedChanges(false);
  }

  const isCheckableTask = task.workType === "task";
  const isHrOnlyTask = task.completionMode === "hr_only";
  const completedCount = submissions.filter((sub) =>
    Boolean(sub.completed ?? (sub.totalPoints !== null && sub.totalPoints > 0))
  ).length;
  const submittedCount = submissions.filter(isSubmissionSubmitted).length;
  const gradedCount = submissions.filter((sub) => sub.totalPoints !== null).length;
  const pendingGradingCount = isCheckableTask
    ? 0
    : submissions.filter(
        (sub) => isSubmissionSubmitted(sub) && sub.totalPoints === null
      ).length;
  const pendingVerifyCount =
    isCheckableTask && isHrOnlyTask ? submissions.length - completedCount : 0;
  const attentionCount = readOnly
    ? 0
    : isCheckableTask
      ? pendingVerifyCount
      : pendingGradingCount;

  const handleScoreChange = (
    idx: number,
    field: "effortScore" | "qualityScore" | "timelinessScore",
    val: string
  ) => {
    const parsed = parseInt(val, 10);
    const num =
      val === "" || Number.isNaN(parsed)
        ? null
        : Math.min(5, Math.max(1, parsed));

    setSubmissions((prev) => {
      const copy = [...prev];
      const item = { ...copy[idx], [field]: num };
      if (
        item.effortScore !== null &&
        item.qualityScore !== null &&
        item.timelinessScore !== null
      ) {
        item.totalPoints = calculateRubricPoints({
          effortScore: item.effortScore,
          qualityScore: item.qualityScore,
          timelinessScore: item.timelinessScore,
          maxPoints: task.maxPoints,
          grading: gradingWeights,
        });
      } else {
        item.totalPoints = null;
      }
      copy[idx] = item;
      return copy;
    });
    setHasUnsavedChanges(true);
    setSavedNotification(false);
    setSaveError(null);
  };

  const handleNotesChange = (idx: number, value: string) => {
    setSubmissions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], notes: value };
      return copy;
    });
    setHasUnsavedChanges(true);
    setSavedNotification(false);
  };

  const handleToggleChecklist = async (idx: number, nextCompleted: boolean) => {
    const sub = submissions[idx];
    if (!sub?.submissionId) return;

    setSaveError(null);
    setTogglingId(sub.submissionId);

    setSubmissions((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        completed: nextCompleted,
        totalPoints: nextCompleted ? task.maxPoints : null,
      };
      return copy;
    });

    try {
      if (onToggleTask) {
        const res = await onToggleTask({
          submissionId: sub.submissionId,
          completed: nextCompleted,
        });
        if (res && !res.ok) {
          setSubmissions((prev) => {
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              completed: !nextCompleted,
              totalPoints: !nextCompleted ? task.maxPoints : null,
            };
            return copy;
          });
          setSaveError(
            res.error ?? `Failed to update task for ${sub.memberName}.`
          );
        }
      }
    } catch (err: unknown) {
      setSubmissions((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          completed: !nextCompleted,
          totalPoints: !nextCompleted ? task.maxPoints : null,
        };
        return copy;
      });
      setSaveError(
        err instanceof Error ? err.message : "Failed to update task completion."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!onGrade) return;
    setIsSaving(true);
    setSaveError(null);
    setSavedNotification(false);

    const partialRow = submissions.find((sub) => {
      const filledCount = [
        sub.effortScore,
        sub.qualityScore,
        sub.timelinessScore,
      ].filter((s) => s !== null).length;
      return filledCount > 0 && filledCount < 3;
    });
    if (partialRow) {
      setSaveError(
        `Please fill all three scores (1-5) for ${partialRow.memberName} or leave all blank.`
      );
      setIsSaving(false);
      return;
    }

    const gradableRows = submissions.filter(
      (sub) =>
        Boolean(sub.submissionId) &&
        sub.effortScore !== null &&
        sub.qualityScore !== null &&
        sub.timelinessScore !== null
    );
    if (gradableRows.length === 0) {
      setSaveError("Enter scores (1-5) for at least one member before saving.");
      setIsSaving(false);
      return;
    }

    try {
      for (const sub of gradableRows) {
        if (!sub.submissionId) continue;
        const res = await onGrade({
          submissionId: sub.submissionId,
          effortScore: sub.effortScore!,
          qualityScore: sub.qualityScore!,
          timelinessScore: sub.timelinessScore!,
          notes: sub.notes,
        });
        if (res && !res.ok) {
          setSaveError(res.error ?? `Failed to save grade for ${sub.memberName}.`);
          return;
        }
      }
      setHasUnsavedChanges(false);
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 3000);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save grades."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const wrapCollapsible = (body: React.ReactNode) => {
    if (!collapsible) return body;

    const totalCount = submissions.length;
    const allTasksDone = isCheckableTask && totalCount > 0 && completedCount === totalCount;
    const allSubmittedGraded =
      !isCheckableTask && submittedCount > 0 && gradedCount === submittedCount;

    return (
      <div
        className={`overflow-hidden rounded-xl border bg-white shadow-xs transition-colors hover:border-[#772583]/40 ${
          attentionCount > 0 ? "border-[#772583]/45" : "border-border"
        }`}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f8f9fb] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#772583] sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            {isExpanded ? (
              <ChevronDown
                className="h-4 w-4 shrink-0 text-[#772583]"
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    isCheckableTask
                      ? "inline-flex shrink-0 rounded-full bg-[#f5edf7] px-2 py-0.5 text-[11px] font-semibold text-[#5a1b63]"
                      : "inline-flex shrink-0 rounded-full bg-[#ebf3f8] px-2 py-0.5 text-[11px] font-semibold text-[#00629b]"
                  }
                >
                  {isCheckableTask ? "Task" : "Assignment"}
                </span>
                {isCheckableTask && (
                  <span
                    className={
                      isHrOnlyTask
                        ? "inline-flex shrink-0 rounded-full bg-[#002855]/10 px-2 py-0.5 text-[11px] font-semibold text-[#002855]"
                        : "inline-flex shrink-0 rounded-full bg-[#eef8e0] px-2 py-0.5 text-[11px] font-semibold text-[#2f600b]"
                    }
                  >
                    {isHrOnlyTask ? "HR-Only" : "Self-Report"}
                  </span>
                )}
                {readOnly && (
                  <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Read-only
                  </span>
                )}
                <span className="truncate font-heading text-sm font-bold text-[#002855]">
                  {task.title}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {task.committeeName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {attentionCount > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-[#772583] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-white"
              >
                {attentionCount} {isCheckableTask ? "to verify" : "to grade"}
              </span>
            )}
            {isCheckableTask ? (
              <span
                className={
                  allTasksDone
                    ? "inline-flex rounded-full bg-[#eef8e0] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#2f600b]"
                    : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#002855]"
                }
              >
                {completedCount} / {totalCount} completed
              </span>
            ) : (
              <>
                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#002855]">
                  Submitted {submittedCount}/{totalCount}
                </span>
                <span
                  className={
                    allSubmittedGraded
                      ? "inline-flex rounded-full bg-[#eef8e0] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#2f600b]"
                      : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#002855]"
                  }
                >
                  Graded {gradedCount}/{submittedCount}
                </span>
              </>
            )}
            <span className="hidden font-mono text-xs font-bold tabular-nums text-muted-foreground sm:inline">
              {task.maxPoints} pts
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border/80 bg-[#fcfcfd] p-4 sm:p-5">
            {body}
          </div>
        )}
      </div>
    );
  };

  if (initialSubmissions.length === 0) {
    return wrapCollapsible(
      <div className="rounded-lg border border-border bg-white p-6 text-center text-sm text-muted-foreground">
        No submissions to grade for this task.
      </div>
    );
  }

  if (isCheckableTask) {
    return wrapCollapsible(
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {!collapsible && (
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-bold tracking-tight text-[#002855]">
                  Task Completion Checklist
                </h2>
                <span className="inline-flex rounded-full bg-[#f5edf7] px-2.5 py-0.5 text-[11px] font-semibold text-[#5a1b63]">
                  Task
                </span>
                <span
                  className={
                    isHrOnlyTask
                      ? "inline-flex rounded-full bg-[#002855]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#002855]"
                      : "inline-flex rounded-full bg-[#eef8e0] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f600b]"
                  }
                >
                  {isHrOnlyTask ? "HR-Only" : "Self-Report"}
                </span>
              </div>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {task.title} · {task.committeeName} ({task.maxPoints} pts on
              completion).{" "}
              {isHrOnlyTask
                ? "HR-only verification: only HR or the assigner can mark this task completed."
                : "Members can self-check on their portal, or HR can toggle below."}
            </p>
          </div>
          {saveError && (
            <span role="alert" className="text-xs font-semibold text-[#ba0c2f]">
              {saveError}
            </span>
          )}
        </div>

        <Card className="border-border bg-white shadow-xs">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#f8f9fb]">
                <TableRow>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Member
                  </TableHead>
                  <TableHead className="w-40 font-heading text-xs font-bold text-[#002855]">
                    Completed
                  </TableHead>
                  <TableHead className="w-36 font-heading text-xs font-bold text-[#002855]">
                    Status
                  </TableHead>
                  <TableHead className="w-32 text-right font-heading text-xs font-bold text-[#002855]">
                    Points
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub, idx) => {
                  const isDone = Boolean(
                    sub.completed ?? (sub.totalPoints !== null && sub.totalPoints > 0)
                  );
                  return (
                    <TableRow key={sub.membershipId}>
                      <TableCell className="font-heading text-sm font-bold text-[#002855]">
                        {sub.memberName}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {isDone ? "Yes" : "No"}
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isDone}
                            disabled={!sub.submissionId || togglingId === sub.submissionId}
                            onChange={(e) =>
                              handleToggleChecklist(idx, e.target.checked)
                            }
                            aria-label={`Mark ${task.title} completed for ${sub.memberName}`}
                            className="h-4 w-4 cursor-pointer rounded border-border accent-[#772583]"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isDone
                              ? "inline-flex rounded-full bg-[#eef8e0] px-2.5 py-0.5 text-xs font-semibold text-[#2f600b]"
                              : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
                          }
                        >
                          {isDone ? "Completed" : "Pending"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-heading text-sm font-bold text-[#002855] tabular-nums">
                        {isDone ? `${sub.totalPoints ?? task.maxPoints} pts` : `0 / ${task.maxPoints} pts`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return wrapCollapsible(
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!collapsible && (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-bold tracking-tight text-[#002855]">
                Keyboard Bulk Grading
              </h2>
              <span className="inline-flex rounded-full bg-[#ebf3f8] px-2.5 py-0.5 text-[11px] font-semibold text-[#00629b]">
                Assignment
              </span>
            </div>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {task.title} · {task.committeeName} (Max {task.maxPoints} pts ·
            Effort ×{gradingWeights.effortWeight}, Quality ×
            {gradingWeights.qualityWeight}, Timeliness ×
            {gradingWeights.timelinessWeight}).{" "}
            {readOnly
              ? "Read-only view of member submissions and grades."
              : "Tab across rows to grade."}
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && !isSaving && (
              <span className="text-xs font-medium text-muted-foreground">
                Unsaved changes
              </span>
            )}
            {onGrade && (
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="h-9 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                {isSaving ? "Saving..." : "Save Grades"}
              </Button>
            )}
            {saveError && (
              <span role="alert" className="text-xs font-semibold text-[#ba0c2f]">
                {saveError}
              </span>
            )}
            {savedNotification && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ebf3f8] px-3 py-1.5 text-xs font-semibold text-[#00629b]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Saved
              </span>
            )}
          </div>
        )}
      </div>

      <Card className="border-border bg-white shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fb]">
              <TableRow>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Member
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Submission
                </TableHead>
                <TableHead className="w-28 font-heading text-xs font-bold text-[#002855]">
                  Effort (1-5)
                </TableHead>
                <TableHead className="w-28 font-heading text-xs font-bold text-[#002855]">
                  Quality (1-5)
                </TableHead>
                <TableHead className="w-28 font-heading text-xs font-bold text-[#002855]">
                  Timeliness (1-5)
                </TableHead>
                <TableHead className="w-32 font-heading text-xs font-bold text-[#002855]">
                  Total Points
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Feedback Notes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub, idx) => {
                const safeUrl = isSafeHttpUrl(sub.submissionUrl)
                  ? sub.submissionUrl
                  : null;
                return (
                  <TableRow key={sub.membershipId}>
                    <TableCell className="font-heading text-sm font-bold text-[#002855]">
                      {sub.memberName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {safeUrl ? (
                        <div className="space-y-0.5">
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#00629b] underline-offset-2 hover:underline"
                          >
                            <span>Open link</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                          {sub.submissionText && (
                            <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                              {sub.submissionText}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Not submitted
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="inline-block w-16 text-center font-heading text-sm font-bold tabular-nums text-[#002855]">
                          {sub.effortScore ?? "—"}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          aria-label={`Effort score for ${sub.memberName}`}
                          value={sub.effortScore ?? ""}
                          onChange={(e) =>
                            handleScoreChange(idx, "effortScore", e.target.value)
                          }
                          className="h-9 w-20 text-center font-heading font-bold tabular-nums"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="inline-block w-16 text-center font-heading text-sm font-bold tabular-nums text-[#002855]">
                          {sub.qualityScore ?? "—"}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          aria-label={`Quality score for ${sub.memberName}`}
                          value={sub.qualityScore ?? ""}
                          onChange={(e) =>
                            handleScoreChange(idx, "qualityScore", e.target.value)
                          }
                          className="h-9 w-20 text-center font-heading font-bold tabular-nums"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="inline-block w-16 text-center font-heading text-sm font-bold tabular-nums text-[#002855]">
                          {sub.timelinessScore ?? "—"}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          aria-label={`Timeliness score for ${sub.memberName}`}
                          value={sub.timelinessScore ?? ""}
                          onChange={(e) =>
                            handleScoreChange(
                              idx,
                              "timelinessScore",
                              e.target.value
                            )
                          }
                          className="h-9 w-20 text-center font-heading font-bold tabular-nums"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-heading text-sm font-bold text-[#002855] tabular-nums">
                      {sub.totalPoints ?? "—"} pts
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">
                          {sub.notes?.trim() ? sub.notes : "—"}
                        </span>
                      ) : (
                        <Input
                          type="text"
                          aria-label={`Feedback notes for ${sub.memberName}`}
                          placeholder="Optional note..."
                          value={sub.notes}
                          onChange={(e) => handleNotesChange(idx, e.target.value)}
                          className="h-9 text-xs"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
