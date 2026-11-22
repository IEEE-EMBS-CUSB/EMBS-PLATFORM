"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTaskAction } from "@/app/hr/tasks/actions";

export function TaskSubmitForm({
  taskId,
  requireUrl = false,
  initialUrl,
  initialText,
}: {
  taskId: string;
  requireUrl?: boolean;
  initialUrl?: string | null;
  initialText?: string | null;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireUrl && !url.trim()) {
      setStatus({
        type: "error",
        text: "Please enter a valid http:// or https:// deliverable link.",
      });
      return;
    }
    if (!text.trim() && !url.trim()) {
      setStatus({ type: "error", text: "Please enter notes or a link." });
      return;
    }
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) {
      setStatus({
        type: "error",
        text: "Link must start with http:// or https://.",
      });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await submitTaskAction({
        taskId,
        submissionText: text.trim() || undefined,
        submissionUrl: url.trim() || undefined,
      });
      if (res.ok) {
        setStatus({ type: "ok", text: "Submitted successfully." });
        if (!requireUrl) {
          setText("");
          setUrl("");
        }
      } else {
        setStatus({
          type: "error",
          text: res.error ?? "Failed to submit deliverable.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setStatus({
        type: "error",
        text:
          msg && !/minified react error|server components render/i.test(msg)
            ? msg
            : "Failed to submit deliverable. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2.5 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Submission notes"
          placeholder="Submission notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-9 text-xs"
        />
        <Input
          aria-label="Submission URL"
          placeholder={
            requireUrl ? "https://... (required)" : "https://... (optional)"
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-9 text-xs"
        />
        <Button
          type="submit"
          disabled={saving}
          className="h-9 shrink-0 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
        >
          {saving ? "Saving..." : "Submit"}
        </Button>
      </div>
      {status && (
        <p
          role={status.type === "error" ? "alert" : "status"}
          className={`text-xs font-semibold ${
            status.type === "error" ? "text-[#ba0c2f]" : "text-[#1e6b0a]"
          }`}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
