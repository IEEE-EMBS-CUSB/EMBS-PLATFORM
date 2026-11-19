"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TaskHeaderRef {
  id: string;
  title: string;
  committeeName: string;
  maxPoints: number;
}

export interface SubmissionGradingItem {
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
}

export function BulkTaskGradingView({
  task,
  submissions: initialSubmissions,
}: BulkTaskGradingViewProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [savedNotification, setSavedNotification] = useState(false);

  const handleScoreChange = (
    idx: number,
    field: "effortScore" | "qualityScore" | "timelinessScore",
    val: string
  ) => {
    const num = val === "" ? null : Math.min(5, Math.max(1, parseInt(val, 10) || 1));
    setSubmissions((prev) => {
      const copy = [...prev];
      const item = { ...copy[idx], [field]: num };
      // Derived total points calculation (effort x 10 + quality x 8 + timeliness x 2)
      const e = item.effortScore ?? 3;
      const q = item.qualityScore ?? 3;
      const t = item.timelinessScore ?? 3;
      item.totalPoints = Math.min(task.maxPoints, Math.round(e * 10 + q * 8 + t * 2));
      copy[idx] = item;
      return copy;
    });

    // Simulated debounced auto-save
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Keyboard Bulk Task Grading
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.title} · {task.committeeName} (Max {task.maxPoints} pts). Tab across rows to grade.
          </p>
        </div>

        {savedNotification && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ebf3f8] px-3 py-1.5 text-xs font-semibold text-[#00629b] animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Auto-saved
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
                        handleScoreChange(idx, "timelinessScore", e.target.value)
                      }
                      className="h-9 w-20 text-center font-heading font-bold tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="font-heading font-bold text-sm text-[#002855] tabular-nums">
                    {sub.totalPoints ?? "—"} pts
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sub.notes}
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
