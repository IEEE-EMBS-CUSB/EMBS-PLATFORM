"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  FileSpreadsheet,
  KeyRound,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAssignRoles, canAssignHrCommittees } from "@/lib/permissions";
import {
  parseRosterCsv,
  type CsvRosterParseResult,
} from "@/services/hr.service";

export interface RosterMemberItem {
  id: string;
  fullName: string;
  email: string;
  committeeId?: string | null;
  committeeName: string;
  managedTrackId?: string | null;
  managedTrackName?: string | null;
  role: MembershipRole;
  isActive: boolean;
}

export interface CommitteeOption {
  id: string;
  name: string;
}

export interface TrackOption {
  id: string;
  name: string;
}

interface BulkImportResult {
  ok: boolean;
  importedCount?: number;
  skippedCount?: number;
  imported?: Array<{
    id: string;
    personId?: string;
    fullName: string;
    email: string;
    role: MembershipRole;
    committeeId: string | null;
    tempPassword?: string;
  }>;
  errors?: string[];
  error?: string;
}

interface RosterManagerViewProps {
  members: RosterMemberItem[];
  currentUserRole?: MembershipRole;
  scopedTrackName?: string | null;
  availableCommittees?: CommitteeOption[];
  availableTracks?: TrackOption[];
  onAssignRole?: (
    memberId: string,
    newRole: MembershipRole
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onAssignCommittee?: (
    memberId: string,
    committeeId: string | null
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onAssignDirectorTrack?: (
    memberId: string,
    trackId: string | null
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onResetPassword?: (
    memberId: string
  ) => Promise<{ ok: boolean; tempPassword: string; error?: string } | null>;
  onAddMember?: (data: {
    fullName: string;
    email: string;
    role: MembershipRole;
    committeeId?: string | null;
    managedTrackId?: string | null;
  }) => Promise<
    { ok: boolean; memberId?: string; tempPassword?: string; error?: string } | void
  >;
  onBulkImport?: (csvContent: string) => Promise<BulkImportResult>;
  onRemoveMember?: (
    memberId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
}

const PROTECTED_RESET_ROLES = new Set<MembershipRole>([
  "master_admin",
  "director",
  "hr_admin",
]);

export function RosterManagerView({
  members: initialMembers,
  currentUserRole = "master_admin",
  scopedTrackName = null,
  availableCommittees = [
    { id: "comm-ai-ml", name: "AI and Machine Learning" },
    { id: "comm-web-dev", name: "Web Development" },
    { id: "comm-robotics", name: "Robotics and Automation" },
    { id: "comm-med-equip", name: "Medical Equipment and Planning" },
    { id: "comm-rnd", name: "R&D" },
    { id: "comm-game-dev", name: "Game Development" },
    { id: "comm-marketing", name: "Marketing and Content Creation" },
    { id: "comm-graphic", name: "Graphic Design" },
    { id: "comm-media", name: "Photography, Videography & Editing" },
    { id: "comm-hr", name: "Human Resources" },
    { id: "comm-pr", name: "Public Relations and Fund Raising" },
    { id: "comm-logistics", name: "Organizing and Logistics" },
  ],
  availableTracks = [
    { id: "technical", name: "Technical" },
    { id: "creative", name: "Creative" },
    { id: "operations", name: "Operations" },
  ],
  onAssignRole,
  onAssignCommittee,
  onAssignDirectorTrack,
  onResetPassword,
  onAddMember,
  onBulkImport,
  onRemoveMember,
}: RosterManagerViewProps) {
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<MembershipRole>("member");
  const [addCommitteeId, setAddCommitteeId] = useState("");
  const [addManagedTrackId, setAddManagedTrackId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] =
    useState<CsvRosterParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    memberName: string;
    memberEmail: string;
    tempPassword: string;
    copied?: boolean;
  } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isMaster = canAssignRoles(currentUserRole);
  const canAssignHr = canAssignHrCommittees(currentUserRole);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddModalOpen(false);
        setImportModalOpen(false);
        setResetModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.committeeName.toLowerCase().includes(q) ||
        (m.managedTrackName ?? "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleParseCsv = () => {
    setImportError(null);
    const res = parseRosterCsv(csvText);
    setImportResult(res);
  };

  const handleConfirmImport = async () => {
    if (!importResult || importResult.validRecords.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    try {
      if (onBulkImport) {
        const res = await onBulkImport(csvText);
        if (!res.ok) {
          setImportError(res.error ?? "Bulk import failed.");
          return;
        }
        if (res.imported && res.imported.length > 0) {
          const commMap = new Map(availableCommittees.map((c) => [c.id, c.name]));
          const added: RosterMemberItem[] = res.imported.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
            role: item.role,
            committeeId: item.committeeId,
            committeeName: item.committeeId
              ? commMap.get(item.committeeId) ?? "Unassigned"
              : "Unassigned",
            isActive: true,
          }));
          setMembers((prev) => [...added, ...prev]);
        }
        setImportNotice(
          `Imported ${res.importedCount ?? 0} member(s)${
            res.skippedCount ? ` (${res.skippedCount} skipped)` : ""
          }.`
        );
      }
      setImportModalOpen(false);
      setCsvText("");
      setImportResult(null);
    } catch (err: unknown) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import roster CSV."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: MembershipRole) => {
    const previous = members.find((m) => m.id === memberId);
    if (!previous) return;
    setActionError(null);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              role: newRole,
              ...(newRole !== "director"
                ? { managedTrackId: null, managedTrackName: null }
                : {}),
            }
          : m
      )
    );
    try {
      const res = await onAssignRole?.(memberId, newRole);
      if (res && !res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  role: previous.role,
                  managedTrackId: previous.managedTrackId,
                  managedTrackName: previous.managedTrackName,
                }
              : m
          )
        );
        setActionError(res.error ?? "Failed to update member role.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                role: previous.role,
                managedTrackId: previous.managedTrackId,
                managedTrackName: previous.managedTrackName,
              }
            : m
        )
      );
      setActionError(
        err instanceof Error ? err.message : "Failed to update member role."
      );
    }
  };

  const handleDirectorTrackChange = async (
    memberId: string,
    newTrackId: string
  ) => {
    const previous = members.find((m) => m.id === memberId);
    if (!previous) return;
    const found = availableTracks.find((t) => t.id === newTrackId);
    setActionError(null);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              managedTrackId: newTrackId || null,
              managedTrackName: found ? found.name : null,
            }
          : m
      )
    );
    try {
      const res = await onAssignDirectorTrack?.(memberId, newTrackId || null);
      if (res && !res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  managedTrackId: previous.managedTrackId,
                  managedTrackName: previous.managedTrackName,
                }
              : m
          )
        );
        setActionError(res.error ?? "Failed to assign director track.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                managedTrackId: previous.managedTrackId,
                managedTrackName: previous.managedTrackName,
              }
            : m
        )
      );
      setActionError(
        err instanceof Error ? err.message : "Failed to assign director track."
      );
    }
  };

  const handleCommitteeChange = async (
    memberId: string,
    newCommitteeId: string
  ) => {
    const previous = members.find((m) => m.id === memberId);
    if (!previous) return;
    const found = availableCommittees.find((c) => c.id === newCommitteeId);
    setActionError(null);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              committeeId: newCommitteeId || null,
              committeeName: found ? found.name : "Unassigned",
            }
          : m
      )
    );
    try {
      const res = await onAssignCommittee?.(memberId, newCommitteeId || null);
      if (res && !res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  committeeId: previous.committeeId,
                  committeeName: previous.committeeName,
                }
              : m
          )
        );
        setActionError(res.error ?? "Failed to update committee assignment.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                committeeId: previous.committeeId,
                committeeName: previous.committeeName,
              }
            : m
        )
      );
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update committee assignment."
      );
    }
  };

  const handleResetPassword = async (member: RosterMemberItem) => {
    setResettingId(member.id);
    setActionError(null);
    try {
      if (onResetPassword) {
        const res = await onResetPassword(member.id);
        if (res && res.ok) {
          setResetModal({
            open: true,
            memberName: member.fullName,
            memberEmail: member.email,
            tempPassword: res.tempPassword,
          });
        } else {
          setActionError(res?.error ?? "Failed to reset password.");
        }
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reset password."
      );
    } finally {
      setResettingId(null);
    }
  };

  const handleRemoveMember = async (member: RosterMemberItem) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${member.fullName} (${member.email}) from the active roster?`
      )
    ) {
      return;
    }
    setRemovingId(member.id);
    setActionError(null);
    try {
      if (onRemoveMember) {
        const res = await onRemoveMember(member.id);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to remove member from roster.");
          return;
        }
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove member."
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim() || !addEmail.trim()) {
      setAddError("Full name and email are required.");
      return;
    }
    setIsAdding(true);
    setAddError("");
    try {
      let createdId = `new-${Date.now()}`;
      const isDirectorRole = addRole === "director";
      const submittedCommitteeId = isDirectorRole ? null : addCommitteeId || null;
      const submittedTrackId = isDirectorRole ? addManagedTrackId || null : null;

      if (onAddMember) {
        const res = await onAddMember({
          fullName: addFullName.trim(),
          email: addEmail.trim(),
          role: addRole,
          committeeId: submittedCommitteeId,
          ...(isDirectorRole ? { managedTrackId: submittedTrackId } : {}),
        });
        if (res && !res.ok) {
          setAddError(res.error ?? "Failed to add member to roster.");
          return;
        }
        if (res && res.memberId) createdId = res.memberId;
        if (res && res.tempPassword) {
          setResetModal({
            open: true,
            memberName: addFullName.trim(),
            memberEmail: addEmail.trim().toLowerCase(),
            tempPassword: res.tempPassword,
          });
        }
      }
      const comm = availableCommittees.find((c) => c.id === submittedCommitteeId);
      const track = availableTracks.find((t) => t.id === submittedTrackId);
      const newMember: RosterMemberItem = {
        id: createdId,
        fullName: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        role: addRole,
        committeeId: submittedCommitteeId,
        committeeName: comm?.name ?? "Unassigned",
        managedTrackId: submittedTrackId,
        managedTrackName: track?.name ?? null,
        isActive: true,
      };
      setMembers((prev) => [newMember, ...prev]);
      setAddModalOpen(false);
      setAddFullName("");
      setAddEmail("");
      setAddRole("member");
      setAddCommitteeId("");
      setAddManagedTrackId("");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Error adding member.");
    } finally {
      setIsAdding(false);
    }
  };

  const roleBadgeColor: Record<MembershipRole, string> = {
    master_admin: "bg-[#002855] text-white border border-[#ffc627]",
    director: "bg-[#5a1b63] text-white border border-[#ffc627]/40",
    hr_admin: "bg-[#772583] text-white",
    hr_member: "bg-[#007377] text-white",
    committee_head: "bg-[#00629b] text-white",
    member: "bg-[#ebf3f8] text-[#002855]",
    attendee: "bg-[#f5edf7] text-[#5a1b63]",
  };

  const roleLabels: Record<MembershipRole, string> = {
    master_admin: "Master",
    director: "Director",
    hr_admin: "HR Admin",
    hr_member: "HR Member",
    committee_head: "Head",
    member: "Member",
    attendee: "Attendee",
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs font-semibold text-[#ba0c2f]"
        >
          {actionError}
        </div>
      )}

      {importNotice && (
        <div className="rounded-lg border border-[#78be20]/40 bg-[#78be20]/10 p-3 text-xs font-semibold text-[#1e6b0a]">
          {importNotice}
        </div>
      )}

      {scopedTrackName && (
        <div className="rounded-lg border border-[#772583]/25 bg-[#f5edf7] p-3 text-xs text-[#5a1b63]">
          <strong>Director Track Scope:</strong> Showing members across all
          committees in your assigned <strong>{scopedTrackName}</strong> track.
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
              Roster & Whitelist Manager
            </h1>
            {isMaster ? (
              <Badge className="bg-[#002855] text-[#ffc627] border border-[#ffc627]/40 text-xs font-bold gap-1">
                <Crown className="h-3 w-3" /> Master Authority
              </Badge>
            ) : (
              <Badge className="bg-[#772583] text-white text-xs font-semibold gap-1">
                <Shield className="h-3 w-3" /> HR Admin Access
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMaster
              ? "Master Authority: You have exclusive power to manage email access, assign roles, and assign HR members to committees."
              : "HR Administrator: View all committees and assign HR members to their respective committees."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMaster && (
            <>
              <Button
                type="button"
                onClick={() => {
                  setAddError("");
                  setAddModalOpen(true);
                }}
                className="h-10 gap-2 bg-[#002855] px-4 text-xs font-semibold text-white hover:bg-[#001c3d]"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Add Member</span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setImportModalOpen(true);
                }}
                variant="outline"
                className="h-10 gap-2 border-border px-4 text-xs font-semibold text-[#002855] hover:bg-[#f5edf7]"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>CSV Bulk Import</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>
      </div>

      {/* Roster Table */}
      <Card className="border-border bg-white shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fb]">
              <TableRow>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Full Name
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Email (Whitelist)
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Committee / Track
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Role
                </TableHead>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Status
                </TableHead>
                {(isMaster || canAssignHr) && (
                  <TableHead className="font-heading text-xs font-bold text-[#002855] text-right">
                    Operational Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const canEditThisRole = isMaster;
                const canAssignThisCommittee =
                  isMaster || (canAssignHr && m.role === "hr_member");
                const canResetThisPassword =
                  isMaster ||
                  (currentUserRole === "hr_admin" &&
                    !PROTECTED_RESET_ROLES.has(m.role));

                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-heading text-sm font-bold text-[#002855]">
                      {m.fullName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.email}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {m.role === "director" ? (
                        isMaster ? (
                          <select
                            aria-label={`Assign director track for ${m.fullName}`}
                            value={m.managedTrackId ?? ""}
                            onChange={(e) =>
                              handleDirectorTrackChange(m.id, e.target.value)
                            }
                            className="h-8 rounded border border-[#772583]/30 bg-[#f5edf7]/60 px-2 text-xs font-semibold text-[#5a1b63] focus:outline-2 focus:outline-[#772583]"
                          >
                            <option value="">All Tracks (Chapter-wide)</option>
                            {availableTracks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} Track
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge className="bg-[#f5edf7] text-[#5a1b63] text-[11px] font-semibold">
                            {m.managedTrackName
                              ? `${m.managedTrackName} Track`
                              : "All Tracks"}
                          </Badge>
                        )
                      ) : canAssignThisCommittee ? (
                        <select
                          aria-label={`Assign committee for ${m.fullName}`}
                          value={m.committeeId ?? ""}
                          onChange={(e) =>
                            handleCommitteeChange(m.id, e.target.value)
                          }
                          className="h-8 rounded border border-border bg-white px-2 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                        >
                          <option value="">Unassigned</option>
                          {availableCommittees.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        m.committeeName
                      )}
                    </TableCell>
                    <TableCell>
                      {canEditThisRole ? (
                        <select
                          aria-label={`Assign role for ${m.fullName}`}
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(
                              m.id,
                              e.target.value as MembershipRole
                            )
                          }
                          className="h-8 rounded border border-border bg-white px-2 text-xs font-bold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                        >
                          <option value="master_admin">Master</option>
                          <option value="director">Director</option>
                          <option value="hr_admin">HR Admin</option>
                          <option value="hr_member">HR Member</option>
                          <option value="committee_head">Head</option>
                          <option value="member">Member</option>
                          <option value="attendee">Attendee</option>
                        </select>
                      ) : (
                        <Badge
                          className={`text-[11px] font-semibold ${roleBadgeColor[m.role]}`}
                        >
                          {roleLabels[m.role] ?? m.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e6b0a]">
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          Deactivated
                        </span>
                      )}
                    </TableCell>
                    {(isMaster || canAssignHr) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canResetThisPassword && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(m)}
                              disabled={resettingId === m.id}
                              aria-label={`Reset password for ${m.fullName}`}
                              className="h-8 gap-1.5 border-border text-xs font-semibold text-[#002855] hover:bg-[#f5edf7] hover:text-[#772583]"
                            >
                              <KeyRound
                                className="h-3.5 w-3.5 text-[#772583]"
                                aria-hidden="true"
                              />
                              <span>Reset Password</span>
                            </Button>
                          )}
                          {isMaster && m.role !== "master_admin" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMember(m)}
                              disabled={removingId === m.id}
                              aria-label={`Remove ${m.fullName} from roster`}
                              className="h-8 gap-1.5 border-[#ba0c2f]/30 text-xs font-semibold text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Remove</span>
                            </Button>
                          )}
                          {m.role === "hr_member" && (
                            <span className="inline-flex rounded bg-[#007377]/10 px-2 py-0.5 text-[10px] font-semibold text-[#007377]">
                              Committee HR
                            </span>
                          )}
                          {m.role === "master_admin" && (
                            <span className="inline-flex rounded bg-[#002855]/10 px-2 py-0.5 text-[10px] font-bold text-[#002855]">
                              Super Admin
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No members match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Member Modal */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Member to Roster"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close add member modal"
              onClick={() => setAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 text-[#002855]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ebf3f8]">
                <UserPlus className="h-5 w-5 text-[#002855]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Add Member to Roster
                </h2>
                <p className="text-xs text-muted-foreground">
                  Whitelist an email and grant role access for this season.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="mt-5 space-y-4">
              {addError && (
                <div
                  role="alert"
                  className="rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
                >
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground/85">
                  Full Name
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Mostafa"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85">
                  Email Address (Normalized)
                </label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. ahmed.mostafa@cu.edu.eg"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="add-member-role"
                    className="block text-xs font-semibold text-foreground/85"
                  >
                    Member Role
                  </label>
                  <select
                    id="add-member-role"
                    value={addRole}
                    onChange={(e) =>
                      setAddRole(e.target.value as MembershipRole)
                    }
                    className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-xs font-bold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                  >
                    <option value="member">Member</option>
                    <option value="committee_head">Committee Head</option>
                    <option value="hr_member">HR Member</option>
                    <option value="hr_admin">HR Admin</option>
                    <option value="director">Director</option>
                    <option value="master_admin">Master Admin</option>
                    <option value="attendee">Attendee</option>
                  </select>
                </div>

                {addRole === "director" ? (
                  <div>
                    <label
                      htmlFor="add-member-track"
                      className="block text-xs font-semibold text-foreground/85"
                    >
                      Managed Committee Track
                    </label>
                    <select
                      id="add-member-track"
                      value={addManagedTrackId}
                      onChange={(e) => setAddManagedTrackId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-[#772583]/30 bg-[#f5edf7]/50 px-2 text-xs font-semibold text-[#5a1b63] focus:outline-2 focus:outline-[#772583]"
                    >
                      <option value="">All Tracks (Chapter-wide)</option>
                      {availableTracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} Track
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="add-member-committee"
                      className="block text-xs font-semibold text-foreground/85"
                    >
                      Committee
                    </label>
                    <select
                      id="add-member-committee"
                      value={addCommitteeId}
                      onChange={(e) => setAddCommitteeId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                    >
                      <option value="">None / Branch-wide</option>
                      {availableCommittees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-border bg-[#f8f9fb] p-3 text-xs text-muted-foreground">
                A unique single-use temporary password will be generated upon creation. The member will be required to set a permanent password on their first sign-in.
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
                  {isAdding ? "Adding..." : "Add to Roster"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CSV Bulk Whitelist Import"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#772583]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5edf7]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  CSV Bulk Whitelist Import
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paste CSV content with headers: full_name, email, committee_slug, role
                </p>
              </div>
            </div>

            {importError && (
              <div
                role="alert"
                className="mt-3 rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs font-semibold text-[#ba0c2f]"
              >
                {importError}
              </div>
            )}

            <div className="mt-4">
              <textarea
                rows={6}
                aria-label="CSV roster content"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`full_name,email,committee_slug,role\nSara Hassan,sara@cu.edu.eg,human-resources,hr_admin\nLaila Amr,laila@cu.edu.eg,ai-and-machine-learning,hr_member\nOmar Tarek,omar@cu.edu.eg,robotics-and-automation,member`}
                className="w-full rounded-lg border border-border p-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-[#00629b]"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParseCsv}
                className="h-9 text-xs font-semibold"
              >
                Validate & Preview
              </Button>

              {importResult && (
                <span className="text-xs font-semibold">
                  {importResult.validRecords.length} valid ·{" "}
                  {importResult.errors.length} errors
                </span>
              )}
            </div>

            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-md bg-[#ba0c2f]/10 p-2.5 text-xs text-[#ba0c2f]">
                {importResult.errors.map((err, i) => (
                  <p key={i}>
                    Line {err.line}: {err.message}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/70 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportModalOpen(false)}
                className="h-10 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  isImporting ||
                  !importResult ||
                  importResult.validRecords.length === 0
                }
                onClick={handleConfirmImport}
                className="h-10 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                {isImporting
                  ? "Importing..."
                  : `Confirm Import (${importResult?.validRecords.length ?? 0})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal?.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Temporary Password Generated"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#772583]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5edf7]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#002855]">
                  Temporary Password Generated
                </h2>
                <p className="text-xs text-muted-foreground">
                  Single-use credentials for {resetModal.memberName}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-[#f8f9fb] p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                Pre-assigned Password
              </p>
              <p className="mt-1 font-mono text-xl font-extrabold tracking-wider text-[#002855] select-all">
                {resetModal.tempPassword}
              </p>
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(resetModal.tempPassword);
                    setResetModal((prev) =>
                      prev ? { ...prev, copied: true } : null
                    );
                  }}
                  className="h-8 gap-1 text-xs"
                >
                  {resetModal.copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#1e6b0a]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Password</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Share this temporary code with{" "}
              <strong>{resetModal.memberEmail}</strong>. On their first sign-in,
              they will be required to create a permanent password before
              accessing the portal.
            </p>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setResetModal(null)}
                className="h-10 bg-[#772583] px-5 text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
