"use client";

import { useState } from "react";
import { toggleTaskCompletionAction } from "@/app/hr/tasks/actions";

interface TaskCheckToggleProps {
  taskId: string;
  title: string;
  maxPoints?: number;
  initialCompleted: boolean;
}

export function TaskCheckToggle({
  taskId,
  title,
  maxPoints,
  initialCompleted,
}: TaskCheckToggleProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setCompleted(next);
    setSaving(true);
    setError(null);

    try {
      const res = await toggleTaskCompletionAction({
        taskId,
        completed: next,
      });
      if (!res.ok) {
        setCompleted(!next);
        setError(res.error ?? "Failed to update task status.");
      }
    } catch (err: unknown) {
      setCompleted(!next);
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg && !/minified react error|server components render/i.test(msg)
          ? msg
          : "Failed to update task status. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#002855]">
        <input
          type="checkbox"
          checked={completed}
          disabled={saving}
          onChange={handleChange}
          aria-label={`Mark "${title}" completed`}
          className="h-4 w-4 rounded border-border accent-[#772583] focus-visible:outline-2 focus-visible:outline-[#00629b]"
        />
        <span>
          {saving
            ? "Saving..."
            : completed
              ? maxPoints
                ? `Completed (+${maxPoints} pts)`
                : "Completed"
              : maxPoints
                ? `Check off (+${maxPoints} pts)`
                : "Check off"}
        </span>
      </label>
      {error && (
        <p role="alert" className="text-xs font-semibold text-[#ba0c2f]">
          {error}
        </p>
      )}
    </div>
  );
}
