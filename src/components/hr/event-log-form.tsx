"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logEventAction } from "@/app/hr/events/actions";

interface EventLogFormProps {
  committees: { id: string; name: string }[];
  defaultDate?: string;
  isBranchWideAllowed?: boolean;
  defaultCommitteeId?: string | null;
}

export function EventLogForm({
  committees,
  defaultDate = "",
  isBranchWideAllowed = true,
  defaultCommitteeId = null,
}: EventLogFormProps) {
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(10);
  const [committeeId, setCommitteeId] = useState(defaultCommitteeId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStatus({ type: "error", text: "Event title is required." });
      return;
    }
    if (!date) {
      setStatus({ type: "error", text: "Event date is required." });
      return;
    }
    if (!Number.isInteger(points) || points < 0 || points > 500) {
      setStatus({
        type: "error",
        text: "Points must be a whole number between 0 and 500.",
      });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await logEventAction({
        title: title.trim(),
        committeeId: committeeId || null,
        eventDate: date,
        points,
        targetMembershipIds: [],
      });
      if (res.ok) {
        setStatus({
          type: "ok",
          text: `Event logged. Awarded points to ${res.awarded ?? 0} active member(s).`,
        });
        setTitle("");
      } else {
        setStatus({ type: "error", text: res.error ?? "Failed to log event." });
      }
    } catch (err: unknown) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to log event.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-white p-4"
    >
      <div>
        <label
          htmlFor="event-title-input"
          className="block text-xs font-semibold text-[#002855]"
        >
          Event Title
        </label>
        <Input
          id="event-title-input"
          placeholder="e.g. Biomedical AI Hackathon Kickoff"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-10 text-sm"
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="event-points-input"
            className="block text-xs font-semibold text-[#002855]"
          >
            Points
          </label>
          <Input
            id="event-points-input"
            type="number"
            min={0}
            max={500}
            value={points}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setPoints(Number.isNaN(v) ? 0 : Math.max(0, v));
            }}
            className="mt-1 h-10 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="event-date-input"
            className="block text-xs font-semibold text-[#002855]"
          >
            Event Date
          </label>
          <Input
            id="event-date-input"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-10 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="event-scope-select"
            className="block text-xs font-semibold text-[#002855]"
          >
            Target Scope
          </label>
          <select
            id="event-scope-select"
            value={committeeId}
            onChange={(e) => setCommitteeId(e.target.value)}
            disabled={!isBranchWideAllowed && Boolean(defaultCommitteeId)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
          >
            {isBranchWideAllowed && (
              <option value="">Branch-wide (All active members)</option>
            )}
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        disabled={saving}
        className="h-10 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
      >
        {saving ? "Saving..." : "Log Event"}
      </Button>

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
