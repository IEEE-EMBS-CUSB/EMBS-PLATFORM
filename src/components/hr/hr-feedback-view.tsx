"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Lock,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface FeedbackItem {
  id: string;
  membershipId: string;
  memberName: string;
  memberEmail: string;
  committeeName: string;
  content: string;
  isPublished: boolean;
  isWarning: boolean;
  createdByName?: string;
  createdAt: string;
}

export interface MemberOption {
  id: string;
  fullName: string;
  committeeName: string;
  email: string;
}

interface HrFeedbackViewProps {
  feedbackList: FeedbackItem[];
  members: MemberOption[];
}

export function HrFeedbackView({
  feedbackList: initialFeedback,
  members,
}: HrFeedbackViewProps) {
  const [feedbackList, setFeedbackList] = useState(initialFeedback);
  const [activeFilter, setActiveFilter] = useState<"all" | "warnings" | "public">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [selectedMemberId, setSelectedMemberId] = useState(
    members[0]?.id || ""
  );
  const [entryType, setEntryType] = useState<"public" | "warning">("public");
  const [content, setContent] = useState("");

  const filteredItems = feedbackList.filter((item) => {
    const matchesSearch =
      item.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memberEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "warnings") return item.isWarning;
    if (activeFilter === "public") return item.isPublished && !item.isWarning;
    return true;
  });

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (!targetMember) return;

    const isWarning = entryType === "warning";
    const newItem: FeedbackItem = {
      id: `fb-${Date.now()}`,
      membershipId: targetMember.id,
      memberName: targetMember.fullName,
      memberEmail: targetMember.email,
      committeeName: targetMember.committeeName,
      content: content.trim(),
      isPublished: !isWarning,
      isWarning,
      createdByName: "HR Admin",
      createdAt: new Date().toISOString(),
    };

    setFeedbackList([newItem, ...feedbackList]);
    setIsModalOpen(false);
    setContent("");
    setEntryType("public");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#002855] sm:text-3xl">
            Feedback & Warnings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage public recognitions and private HR warnings with strict data-layer privacy.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#772583] text-white hover:bg-[#5a1b63]"
        >
          <Plus className="h-4 w-4" />
          + Add Note / Warning
        </Button>
      </div>

      {/* Security Privacy Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-[#00629b]/20 bg-[#f0f6fa] p-4 text-xs text-[#002855]">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]" />
        <div>
          <span className="font-bold">Strict Data-Layer Privacy Guarded:</span>{" "}
          Internal HR warnings and unpublished notes are filtered at the database query level and never returned to members or attendees. Only entries explicitly flagged as Public Recognition are visible in member portals.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by member or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-input p-1 bg-[#fafafa]">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeFilter === "all"
                    ? "bg-[#772583] text-white"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                All ({feedbackList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("public")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeFilter === "public"
                    ? "bg-[#772583] text-white"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                Public Recognition
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("warnings")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeFilter === "warnings"
                    ? "bg-[#772583] text-white"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                Warnings Only
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Feed */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No feedback entries found matching your filter.
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`border transition-all ${
                item.isWarning
                  ? "border-[#f9c5c5] bg-[#fffbfb]"
                  : "border-[#d8ecd8] bg-[#fcfdfc]"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {item.memberName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {item.committeeName}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.memberEmail}
                    </div>
                  </div>

                  <div>
                    {item.isWarning ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#f9c5c5] bg-[#fdf2f2] px-2.5 py-0.5 text-xs font-semibold text-[#cc0000]">
                        <AlertTriangle className="h-3 w-3" />
                        HR Warning (Private)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#c4e8aa] bg-[#f0f9eb] px-2.5 py-0.5 text-xs font-semibold text-[#408c10]">
                        <Sparkles className="h-3 w-3" />
                        Public Recognition
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {item.content}
                </p>

                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>Logged by {item.createdByName || "HR Admin"}</span>
                  <span>{item.createdAt.slice(0, 10)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Modal Dialog */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-[#002855]">
                Log Feedback or HR Warning
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="fbMemberSelect"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Select Member
                </label>
                <select
                  id="fbMemberSelect"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.committeeName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feedback Type & Privacy
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-colors ${
                      entryType === "public"
                        ? "border-[#772583] bg-[#f5edf7] text-[#772583]"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="entryType"
                      value="public"
                      checked={entryType === "public"}
                      onChange={() => setEntryType("public")}
                      className="sr-only"
                    />
                    <Sparkles className="h-4 w-4" />
                    <span>Public Recognition</span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-colors ${
                      entryType === "warning"
                        ? "border-[#cc0000] bg-[#fdf2f2] text-[#cc0000]"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="entryType"
                      value="warning"
                      checked={entryType === "warning"}
                      onChange={() => setEntryType("warning")}
                      className="sr-only"
                    />
                    <AlertTriangle className="h-4 w-4" />
                    <span>Internal HR Warning (Private)</span>
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="contentInput"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Feedback Content
                </label>
                <textarea
                  id="contentInput"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter detailed feedback or formal warning details..."
                  className="mt-1 block w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#772583] text-white hover:bg-[#5a1b63]"
                >
                  Save Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
