"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MemberCombobox } from "@/components/ui/member-combobox";
import {
  FEEDBACK_CATEGORY_META,
  FEEDBACK_CATEGORY_ORDER,
  inferFeedbackCategory,
  type FeedbackCategory,
} from "@/lib/feedback-categories";
import {
  DEFAULT_SEASON_SETTINGS,
  type SeasonFeedbackSettings,
} from "@/lib/season-settings";

export interface FeedbackItem {
  id: string;
  membershipId: string;
  memberName: string;
  memberEmail: string;
  committeeName: string;
  category?: FeedbackCategory;
  pointsDelta?: number;
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
  canAwardPoints?: boolean;
}

interface HrFeedbackViewProps {
  feedbackList: FeedbackItem[];
  members: MemberOption[];
  canCreateWarning?: boolean;
  canAwardPoints?: boolean;
  feedbackCaps?: SeasonFeedbackSettings;
  currentUserName?: string;
  onAddFeedback?: (input: {
    membershipId: string;
    category: FeedbackCategory;
    content: string;
    pointsDelta?: number;
  }) => Promise<{ ok: boolean; id?: string; error?: string } | void>;
}

const CATEGORY_STYLES: Record<
  FeedbackCategory,
  { badgeClass: string; cardClass: string; radioActiveClass: string }
> = {
  recognition: {
    badgeClass: "border-[#78be20]/40 bg-[#78be20]/10 text-[#1e6b0a]",
    cardClass: "border-[#78be20]/30 bg-white",
    radioActiveClass: "border-[#78be20] bg-[#eef8e0] text-[#1e6b0a]",
  },
  excused_absence: {
    badgeClass: "border-[#009ca6]/35 bg-[#e3f5f6] text-[#005b5e]",
    cardClass: "border-[#009ca6]/25 bg-white",
    radioActiveClass: "border-[#009ca6] bg-[#e3f5f6] text-[#005b5e]",
  },
  other: {
    badgeClass: "border-border bg-muted/60 text-foreground",
    cardClass: "border-border bg-white",
    radioActiveClass: "border-[#002855] bg-[#f0f4f8] text-[#002855]",
  },
  warning: {
    badgeClass: "border-[#ba0c2f]/35 bg-[#ba0c2f]/10 text-[#ba0c2f]",
    cardClass: "border-[#ba0c2f]/30 bg-[#ba0c2f]/[0.025]",
    radioActiveClass: "border-[#ba0c2f] bg-[#ba0c2f]/10 text-[#ba0c2f]",
  },
  internal_note: {
    badgeClass: "border-[#772583]/35 bg-[#f5edf7] text-[#5a1b63]",
    cardClass: "border-[#772583]/30 bg-[#f5edf7]/35",
    radioActiveClass: "border-[#772583] bg-[#f5edf7] text-[#5a1b63]",
  },
};

function CategoryIcon({
  category,
  className = "h-3.5 w-3.5",
}: {
  category: FeedbackCategory;
  className?: string;
}) {
  switch (category) {
    case "recognition":
      return <Sparkles className={className} aria-hidden="true" />;
    case "excused_absence":
      return <CalendarCheck className={className} aria-hidden="true" />;
    case "warning":
      return <AlertTriangle className={className} aria-hidden="true" />;
    case "internal_note":
      return <EyeOff className={className} aria-hidden="true" />;
    default:
      return <MessageSquare className={className} aria-hidden="true" />;
  }
}

export function HrFeedbackView({
  feedbackList: initialFeedback,
  members,
  canCreateWarning = true,
  canAwardPoints = true,
  feedbackCaps = DEFAULT_SEASON_SETTINGS.feedback,
  currentUserName = "HR Team",
  onAddFeedback,
}: HrFeedbackViewProps) {
  const [feedbackList, setFeedbackList] = useState(initialFeedback);
  const [prevInitialFeedback, setPrevInitialFeedback] =
    useState(initialFeedback);
  if (initialFeedback !== prevInitialFeedback) {
    setPrevInitialFeedback(initialFeedback);
    setFeedbackList(initialFeedback);
  }
  const [activeFilter, setActiveFilter] = useState<
    "all" | "member_visible" | "warnings" | "hidden"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state (pointsDelta ALWAYS starts at 0)
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<FeedbackCategory>("recognition");
  const [pointsDeltaInput, setPointsDeltaInput] = useState("0");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const availableCategories = useMemo(
    () =>
      FEEDBACK_CATEGORY_ORDER.filter(
        (cat) =>
          canCreateWarning || !FEEDBACK_CATEGORY_META[cat].requiresWarningAuthority
      ),
    [canCreateWarning]
  );

  const normalizedFeedback = useMemo(
    () =>
      feedbackList.map((item) => ({
        ...item,
        resolvedCategory: inferFeedbackCategory(item),
      })),
    [feedbackList]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedFeedback.filter((item) => {
      const matchesSearch =
        !q ||
        item.memberName.toLowerCase().includes(q) ||
        item.memberEmail.toLowerCase().includes(q) ||
        item.committeeName.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (activeFilter === "warnings") {
        return item.resolvedCategory === "warning";
      }
      if (activeFilter === "hidden") {
        return item.resolvedCategory === "internal_note" || !item.isPublished;
      }
      if (activeFilter === "member_visible") {
        return item.isPublished;
      }
      return true;
    });
  }, [normalizedFeedback, searchQuery, activeFilter]);

  const openNewModal = () => {
    setFormError(null);
    setSelectedMemberId("");
    setSelectedCategory("recognition");
    setPointsDeltaInput("0");
    setContent("");
    setIsModalOpen(true);
  };

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );
  const canAwardPointsForSelected =
    canAwardPoints && (selectedMember?.canAwardPoints ?? true);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (!targetMember) {
      setFormError("Please search and select a target member.");
      return;
    }

    const allowPoints =
      canAwardPoints && (targetMember.canAwardPoints ?? true);

    const parsedDelta = allowPoints
      ? parseInt(pointsDeltaInput.trim() === "" ? "0" : pointsDeltaInput, 10)
      : 0;
    if (allowPoints && Number.isNaN(parsedDelta)) {
      setFormError("Bonus / deduction must be a whole number (0 for none).");
      return;
    }
    if (allowPoints && parsedDelta > feedbackCaps.maxBonusPoints) {
      setFormError(
        `Feedback bonus cannot exceed +${feedbackCaps.maxBonusPoints} pts (season cap).`
      );
      return;
    }
    if (allowPoints && parsedDelta < -feedbackCaps.maxDeductionPoints) {
      setFormError(
        `Feedback deduction cannot exceed -${feedbackCaps.maxDeductionPoints} pts (season cap).`
      );
      return;
    }

    const effectiveCategory =
      !canCreateWarning &&
      FEEDBACK_CATEGORY_META[selectedCategory].requiresWarningAuthority
        ? "recognition"
        : selectedCategory;

    setIsSubmitting(true);
    setFormError(null);

    try {
      let createdId = `fb-${Date.now()}`;
      if (onAddFeedback) {
        const res = await onAddFeedback({
          membershipId: targetMember.id,
          category: effectiveCategory,
          content: content.trim(),
          pointsDelta: allowPoints ? parsedDelta : 0,
        });
        if (res && !res.ok) {
          setFormError(res.error ?? "Failed to save feedback.");
          return;
        }
        if (res && res.id) createdId = res.id;
      }

      const meta = FEEDBACK_CATEGORY_META[effectiveCategory];
      const newItem: FeedbackItem = {
        id: createdId,
        membershipId: targetMember.id,
        memberName: targetMember.fullName,
        memberEmail: targetMember.email,
        committeeName: targetMember.committeeName,
        category: effectiveCategory,
        pointsDelta: allowPoints ? parsedDelta : 0,
        content: content.trim(),
        isPublished: meta.visibility === "member",
        isWarning:
          effectiveCategory === "warning" ||
          effectiveCategory === "internal_note",
        createdByName: currentUserName,
        createdAt: new Date().toISOString(),
      };

      setFeedbackList((prev) => [newItem, ...prev]);
      setIsModalOpen(false);
      setContent("");
      setSelectedCategory("recognition");
      setPointsDeltaInput("0");
      setSelectedMemberId("");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save feedback."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Feedback &amp; Warnings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send recognitions, excused-absence confirmations, official warnings,
            or hidden HR notes with optional capped point adjustments.
          </p>
        </div>

        <Button
          type="button"
          disabled={members.length === 0}
          onClick={openNewModal}
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Feedback</span>
        </Button>
      </div>

      {/* Explicit Visibility & Privacy Matrix Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-[#00629b]/25 bg-[#f0f6fa] p-4 text-xs text-[#002855]">
        <Lock
          className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="font-bold">Visibility</p>
          <p>
            <strong>Sent to Member</strong> (Public Recognition, Excused
            Absence, General Note, and <strong>Official Warning</strong>) appears
            in the member&apos;s portal.
          </p>
          <p>
            <strong>Hidden HR Notes</strong> are visible only to Master Admin,
            Track Director, HR Admin, and the committee&apos;s HR Member —{" "}
            <strong>
              never visible to the member, attendees, or committee heads
            </strong>
            .
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by member, committee, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-[#fafafa] p-1">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "all"
                    ? "bg-[#772583] text-white"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                All ({feedbackList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("member_visible")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === "member_visible"
                    ? "bg-[#772583] text-white"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                Sent to Member
              </button>
              {canCreateWarning && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("warnings")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeFilter === "warnings"
                        ? "bg-[#ba0c2f] text-white"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    Official Warnings
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("hidden")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeFilter === "hidden"
                        ? "bg-[#5a1b63] text-white"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    Hidden HR Notes
                  </button>
                </>
              )}
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
          filteredItems.map((item) => {
            const cat = item.resolvedCategory;
            const meta = FEEDBACK_CATEGORY_META[cat];
            const style = CATEGORY_STYLES[cat];
            const delta = item.pointsDelta ?? 0;

            return (
              <Card
                key={item.id}
                className={`border transition-all ${style.cardClass}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badgeClass}`}
                      >
                        <CategoryIcon category={cat} className="h-3 w-3" />
                        {meta.label}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {meta.visibility === "hidden" ? (
                          <>
                            <EyeOff className="h-3 w-3" aria-hidden="true" />
                            Hidden from member
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            Sent to member
                          </>
                        )}
                      </span>

                      {delta !== 0 && (
                        <span
                          className={
                            delta > 0
                              ? "inline-flex items-center gap-0.5 rounded-full border border-[#78be20]/40 bg-[#78be20]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#1e6b0a]"
                              : "inline-flex items-center gap-0.5 rounded-full border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#ba0c2f]"
                          }
                        >
                          {delta > 0 ? (
                            <ArrowUpRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          ) : (
                            <ArrowDownRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          )}
                          {delta > 0 ? `+${delta} pts` : `${delta} pts`}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-foreground">
                    {item.content}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>Logged by {item.createdByName || "HR Team"}</span>
                    <span>{item.createdAt.slice(0, 10)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Feedback Modal Dialog */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log Feedback or Official Warning"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-[#002855]">
                Log Feedback or Official Warning
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close modal"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="fbMemberCombobox"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Member
                </label>
                <div className="mt-1">
                  <MemberCombobox
                    id="fbMemberCombobox"
                    ariaLabel="Select member"
                    options={members}
                    value={selectedMemberId}
                    onChange={setSelectedMemberId}
                    placeholder="Type a member's name, email, or committee..."
                    required
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Category &amp; Visibility
                </span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {availableCategories.map((cat) => {
                    const meta = FEEDBACK_CATEGORY_META[cat];
                    const style = CATEGORY_STYLES[cat];
                    const isSelected = selectedCategory === cat;
                    return (
                      <label
                        key={cat}
                        className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-xs transition-colors ${
                          isSelected
                            ? style.radioActiveClass
                            : "border-border bg-white hover:bg-muted/40"
                        } ${cat === "internal_note" ? "sm:col-span-2" : ""}`}
                      >
                        <input
                          type="radio"
                          name="feedbackCategory"
                          value={cat}
                          checked={isSelected}
                          onChange={() => setSelectedCategory(cat)}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2 font-bold">
                          <CategoryIcon category={cat} className="h-4 w-4" />
                          <span>{meta.label}</span>
                        </div>
                        <span className="text-[11px] opacity-85">
                          {meta.visibilitySummary}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {canAwardPointsForSelected ? (
                <div>
                  <label
                    htmlFor="fbPointsDelta"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Optional Bonus / Deduction (pts)
                  </label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input
                      id="fbPointsDelta"
                      type="number"
                      min={-feedbackCaps.maxDeductionPoints}
                      max={feedbackCaps.maxBonusPoints}
                      value={pointsDeltaInput}
                      onChange={(e) => setPointsDeltaInput(e.target.value)}
                      className="h-10 w-36 font-mono font-bold"
                    />
                    <span className="text-xs text-muted-foreground">
                      Default 0 · Allowed range: −
                      {feedbackCaps.maxDeductionPoints} to +
                      {feedbackCaps.maxBonusPoints} pts
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-[#f8f9fb] px-3 py-2 text-xs text-muted-foreground">
                  {canAwardPoints && selectedMember?.canAwardPoints === false
                    ? "HR members cannot award or deduct points for committee heads or leadership. Feedback logged here carries 0 point change."
                    : "Point bonuses and deductions are managed by HR and Master Admin. Feedback logged here carries 0 point change."}
                </p>
              )}

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
                  placeholder="Enter detailed feedback, recognition, excuse confirmation, or warning details..."
                  className="mt-1 block w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#772583] text-white hover:bg-[#5a1b63]"
                >
                  {isSubmitting ? "Saving..." : "Save Entry"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
