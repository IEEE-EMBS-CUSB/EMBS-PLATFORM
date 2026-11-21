"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canManageCommittees, canManageRubrics } from "@/lib/permissions";

export interface CommitteeViewItem {
  id: string;
  name: string;
  slug: string;
  category: "technical" | "non_technical";
  isActive: boolean;
  memberCount: number;
}

export interface RubricViewItem {
  id: string;
  name: string;
  maxPoints: number;
  weight: string;
  leadersOnly: boolean;
}

interface CommitteesRubricsViewProps {
  committees: CommitteeViewItem[];
  rubrics: RubricViewItem[];
  currentUserRole?: MembershipRole;
  onAddCommittee?: (data: {
    name: string;
    category: "technical" | "non_technical";
    slug?: string;
  }) => Promise<{ ok: boolean; committeeId?: string; slug?: string; error?: string } | void>;
  onRemoveCommittee?: (
    committeeId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onAddRubric?: (data: {
    name: string;
    maxPoints: number;
    weight?: string;
    leadersOnly?: boolean;
  }) => Promise<{ ok: boolean; rubricId?: string; error?: string } | void>;
  onRemoveRubric?: (
    rubricId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
}

export function CommitteesRubricsView({
  committees: initialCommittees,
  rubrics: initialRubrics,
  currentUserRole = "master_admin",
  onAddCommittee,
  onRemoveCommittee,
  onAddRubric,
  onRemoveRubric,
}: CommitteesRubricsViewProps) {
  const [committees, setCommittees] = useState(initialCommittees);
  const [rubrics, setRubrics] = useState(initialRubrics);
  const [activeTab, setActiveTab] = useState<"committees" | "rubrics">(
    "committees"
  );
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Committee Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [commName, setCommName] = useState("");
  const [commCategory, setCommCategory] = useState<
    "technical" | "non_technical"
  >("technical");
  const [commSlug, setCommSlug] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Add Rubric Modal state
  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [rubricName, setRubricName] = useState("");
  const [rubricMax, setRubricMax] = useState(20);
  const [rubricWeight, setRubricWeight] = useState("1.0");
  const [rubricLeadersOnly, setRubricLeadersOnly] = useState(false);
  const [rubricError, setRubricError] = useState("");
  const [isAddingRubric, setIsAddingRubric] = useState(false);
  const [removingRubricId, setRemovingRubricId] = useState<string | null>(null);

  const isMaster = canManageCommittees(currentUserRole);
  const canEditRubrics = canManageRubrics(currentUserRole);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddModalOpen(false);
        setRubricModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commName.trim()) {
      setAddError("Committee name is required.");
      return;
    }
    setIsAdding(true);
    setAddError("");
    try {
      const slug =
        commSlug.trim().toLowerCase() ||
        commName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      let createdId = `comm-${Date.now()}`;
      let createdSlug = slug;

      if (onAddCommittee) {
        const res = await onAddCommittee({
          name: commName.trim(),
          category: commCategory,
          slug,
        });
        if (res && !res.ok) {
          setAddError(res.error ?? "Failed to add committee.");
          return;
        }
        if (res && res.committeeId) createdId = res.committeeId;
        if (res && res.slug) createdSlug = res.slug;
      }

      const newComm: CommitteeViewItem = {
        id: createdId,
        name: commName.trim(),
        slug: createdSlug,
        category: commCategory,
        isActive: true,
        memberCount: 0,
      };

      setCommittees((prev) => [...prev, newComm]);
      setAddModalOpen(false);
      setCommName("");
      setCommSlug("");
      setCommCategory("technical");
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : "Error adding committee."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (comm: CommitteeViewItem) => {
    if (
      !window.confirm(
        `Are you sure you want to remove the "${comm.name}" committee?`
      )
    ) {
      return;
    }
    setRemovingId(comm.id);
    setActionError(null);
    try {
      if (onRemoveCommittee) {
        const res = await onRemoveCommittee(comm.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to remove committee.");
          return;
        }
      }
      setCommittees((prev) => prev.filter((c) => c.id !== comm.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove committee."
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddRubricSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubricName.trim()) {
      setRubricError("Rubric name is required.");
      return;
    }
    if (!Number.isInteger(rubricMax) || rubricMax <= 0) {
      setRubricError("Max points must be a positive whole number.");
      return;
    }
    setIsAddingRubric(true);
    setRubricError("");
    try {
      let createdId = `rub-${Date.now()}`;
      if (onAddRubric) {
        const res = await onAddRubric({
          name: rubricName.trim(),
          maxPoints: rubricMax,
          weight: rubricWeight,
          leadersOnly: rubricLeadersOnly,
        });
        if (res && !res.ok) {
          setRubricError(res.error ?? "Failed to add rubric.");
          return;
        }
        if (res && res.rubricId) createdId = res.rubricId;
      }

      setRubrics((prev) => [
        ...prev,
        {
          id: createdId,
          name: rubricName.trim(),
          maxPoints: rubricMax,
          weight: rubricWeight,
          leadersOnly: rubricLeadersOnly,
        },
      ]);
      setRubricModalOpen(false);
      setRubricName("");
      setRubricMax(20);
      setRubricWeight("1.0");
      setRubricLeadersOnly(false);
    } catch (err: unknown) {
      setRubricError(
        err instanceof Error ? err.message : "Error creating scoring rubric."
      );
    } finally {
      setIsAddingRubric(false);
    }
  };

  const handleRemoveRubric = async (rubric: RubricViewItem) => {
    setRemovingRubricId(rubric.id);
    setActionError(null);
    try {
      if (onRemoveRubric) {
        const res = await onRemoveRubric(rubric.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to remove rubric.");
          return;
        }
      }
      setRubrics((prev) => prev.filter((x) => x.id !== rubric.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove rubric."
      );
    } finally {
      setRemovingRubricId(null);
    }
  };

  const technicalCommittees = committees.filter(
    (c) => c.category === "technical"
  );
  const nonTechnicalCommittees = committees.filter(
    (c) => c.category === "non_technical"
  );

  return (
    <div className="space-y-8">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Committees & Scoring Rubrics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure chapter tracks, committee slugs, and seasonal grading weights for the active season.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMaster && activeTab === "committees" && (
            <Button
              type="button"
              onClick={() => {
                setAddError("");
                setAddModalOpen(true);
              }}
              className="h-9 gap-1.5 bg-[#002855] px-3.5 text-xs font-semibold text-white hover:bg-[#001c3d]"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              <span>Add Committee</span>
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab("committees")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "committees"
                  ? "bg-[#772583] text-white"
                  : "text-foreground/80 hover:bg-[#f5edf7] hover:text-[#772583]"
              }`}
            >
              Committees ({committees.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rubrics")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "rubrics"
                  ? "bg-[#772583] text-white"
                  : "text-foreground/80 hover:bg-[#f5edf7] hover:text-[#772583]"
              }`}
            >
              Scoring Rubrics ({rubrics.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "rubrics" && canEditRubrics ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setRubricError("");
              setRubricModalOpen(true);
            }}
            className="h-9 gap-1.5 bg-[#772583] px-3.5 text-xs font-semibold text-white hover:bg-[#5a1b63]"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            <span>Add Rubric</span>
          </Button>
        </div>
      ) : null}

      {activeTab === "committees" ? (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-sm font-bold tracking-wide text-[#007377] uppercase">
              Technical Committees ({technicalCommittees.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {technicalCommittees.map((comm) => (
                <Card key={comm.id} className="border-border bg-white shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-[#ebf3f8] text-[#002855] font-semibold text-[11px]">
                        Technical
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#1e6b0a]">
                          Active
                        </span>
                        {isMaster && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(comm)}
                            disabled={removingId === comm.id}
                            aria-label={`Remove committee ${comm.name}`}
                            className="h-6 w-6 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardTitle className="mt-2 font-heading text-base font-bold text-[#002855]">
                      {comm.name}
                    </CardTitle>
                    <code className="text-[11px] text-muted-foreground">
                      /{comm.slug}
                    </code>
                  </CardHeader>
                  <CardContent className="pt-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">{comm.memberCount}</strong>{" "}
                    members enrolled
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-heading text-sm font-bold tracking-wide text-[#00629b] uppercase">
              Non-Technical Committees ({nonTechnicalCommittees.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {nonTechnicalCommittees.map((comm) => (
                <Card key={comm.id} className="border-border bg-white shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-[#f5edf7] text-[#5a1b63] font-semibold text-[11px]">
                        Non-Technical
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#1e6b0a]">
                          Active
                        </span>
                        {isMaster && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(comm)}
                            disabled={removingId === comm.id}
                            aria-label={`Remove committee ${comm.name}`}
                            className="h-6 w-6 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardTitle className="mt-2 font-heading text-base font-bold text-[#002855]">
                      {comm.name}
                    </CardTitle>
                    <code className="text-[11px] text-muted-foreground">
                      /{comm.slug}
                    </code>
                  </CardHeader>
                  <CardContent className="pt-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">{comm.memberCount}</strong>{" "}
                    members enrolled
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Card className="border-border bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-bold text-[#002855]">
              Active Seasonal Evaluation Rubrics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Rubrics configure seasonal grading parameters. Point weights and maximums are derived deterministically.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#f8f9fb]">
                <TableRow>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Rubric Category
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Max Points
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Weight
                  </TableHead>
                  <TableHead className="font-heading text-xs font-bold text-[#002855]">
                    Scope
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-[#002855]">
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        {canEditRubrics && onRemoveRubric && (
                          <button
                            type="button"
                            disabled={removingRubricId === r.id}
                            aria-label={`Remove rubric ${r.name}`}
                            onClick={() => handleRemoveRubric(r)}
                            className="rounded p-1 text-muted-foreground hover:bg-[#ba0c2f]/10 hover:text-[#ba0c2f]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums font-heading font-bold">
                      {r.maxPoints} pts
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      x{r.weight}
                    </TableCell>
                    <TableCell>
                      {r.leadersOnly ? (
                        <Badge className="bg-[#ffc627]/30 text-[#002855] text-[11px] font-semibold">
                          Leaders only
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          All members
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rubrics.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No scoring rubrics configured for this season yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Committee Modal */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add New Committee"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add committee modal"
              onClick={() => setAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 text-[#002855]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ebf3f8]">
                <FolderPlus className="h-5 w-5 text-[#002855]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Add New Committee
                </h2>
                <p className="text-xs text-muted-foreground">
                  Create a chapter committee for the active season.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              {addError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {addError}
                </div>
              )}

              <div>
                <label
                  htmlFor="comm-name-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Committee Name
                </label>
                <Input
                  id="comm-name-input"
                  type="text"
                  required
                  placeholder="e.g. Neuroscience & Brain-Computer Interfaces"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="comm-category-select"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Track Category
                </label>
                <select
                  id="comm-category-select"
                  value={commCategory}
                  onChange={(e) =>
                    setCommCategory(
                      e.target.value as "technical" | "non_technical"
                    )
                  }
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                >
                  <option value="technical">Technical Track</option>
                  <option value="non_technical">Non-Technical Track</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="comm-slug-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Custom Slug (Optional)
                </label>
                <Input
                  id="comm-slug-input"
                  type="text"
                  placeholder="e.g. bci-neuroscience (leave blank to auto-generate)"
                  value={commSlug}
                  onChange={(e) => setCommSlug(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="h-9 bg-[#002855] px-4 text-xs font-bold text-white hover:bg-[#001c3d]"
                >
                  {isAdding ? "Creating..." : "Create Committee"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Scoring Rubric Modal */}
      {rubricModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Scoring Rubric"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRubricModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add rubric modal"
              onClick={() => setRubricModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Add Scoring Rubric
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Define a weighted evaluation category for the active season.
            </p>

            <form onSubmit={handleAddRubricSubmit} className="mt-5 space-y-4">
              {rubricError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {rubricError}
                </div>
              )}

              <div>
                <label
                  htmlFor="rubric-name-input"
                  className="block text-xs font-semibold text-foreground/85"
                >
                  Rubric Name
                </label>
                <Input
                  id="rubric-name-input"
                  type="text"
                  required
                  placeholder="e.g. Technical Delivery Quality"
                  value={rubricName}
                  onChange={(e) => setRubricName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rubric-max-input"
                    className="block text-xs font-semibold text-foreground/85"
                  >
                    Max Points
                  </label>
                  <Input
                    id="rubric-max-input"
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={rubricMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setRubricMax(Number.isNaN(v) ? 0 : v);
                    }}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rubric-weight-input"
                    className="block text-xs font-semibold text-foreground/85"
                  >
                    Weight Multiplier
                  </label>
                  <Input
                    id="rubric-weight-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    required
                    value={rubricWeight}
                    onChange={(e) => setRubricWeight(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={rubricLeadersOnly}
                  onChange={(e) => setRubricLeadersOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span>Leaders only (Committee Heads & Officers)</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRubricModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingRubric}
                  className="h-9 bg-[#772583] px-4 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  {isAddingRubric ? "Creating..." : "Create Rubric"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
