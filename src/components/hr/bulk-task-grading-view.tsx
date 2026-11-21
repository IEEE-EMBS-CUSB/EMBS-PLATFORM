"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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

export interface TaskHeaderRef {
  id: string;
  title: string;
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
}

interface BulkTaskGradingViewProps {
  task: TaskHeaderRef;
  submissions: SubmissionGradingItem[];
  onGrade?: (input: {
    submissionId: string;
    effortScore: number;
    qualityScore: number;
    timelinessScore: number;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string } | void>;
}

export function BulkTaskGradingView({
  task,
  submissions: initialSubmissions,
  onGrade,
}: BulkTaskGradingViewProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        item.totalPoints = Math.min(
          task.maxPoints,
          Math.round(
            item.effortScore * 10 +
              item.qualityScore * 8 +
              item.timelinessScore * 2
          )
        );
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

  const handleSaveAll = async () => {
    if (!onGrade) return;
    setIsSaving(true);
    setSaveError(null);
    setSavedNotification(false);

    const invalid = submissions.some(
      (sub) =>
        !sub.submissionId ||
        sub.effortScore === null ||
        sub.qualityScore === null ||
        sub.timelinessScore === null
    );
    if (invalid) {
      setSaveError("All scores must be between 1 and 5 before saving.");
      setIsSaving(false);
      return;
    }

    try {
      for (const sub of submissions) {
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

  if (initialSubmissions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center text-sm text-muted-foreground">
        No submissions to grade for this task.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Keyboard Bulk Task Grading
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.title} · {task.committeeName} (Max {task.maxPoints} pts). Tab across rows to grade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && !isSaving && (
            <span className="text-xs font-medium text-muted-foreground">
              Unsaved changes
            </span>
          )}
          {onGrade && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="rounded-md bg-[#772583] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5a1b63] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Grades"}
            </button>
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
      </div>

      <Card className="border-border bg-white shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fb]">
              <TableRow>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Member
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
              {submissions.map((sub, idx) => (
                <TableRow key={sub.membershipId}>
                  <TableCell className="font-heading text-sm font-bold text-[#002855]">
                    {sub.memberName}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="font-heading font-bold text-sm text-[#002855] tabular-nums">
                    {sub.totalPoints ?? "—"} pts
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      aria-label={`Feedback notes for ${sub.memberName}`}
                      placeholder="Optional note..."
                      value={sub.notes}
                      onChange={(e) => handleNotesChange(idx, e.target.value)}
                      className="h-9 text-xs"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
