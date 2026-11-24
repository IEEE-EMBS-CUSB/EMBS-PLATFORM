"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
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
import { WhatsAppPhoneLink } from "@/components/ui/whatsapp-phone-link";
import { normalizePhoneNumber } from "@/lib/phone";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canAssignRoles, canAssignHrCommittees } from "@/lib/permissions";
import {
  parseRosterCsv,
  type CsvRosterParseResult,
} from "@/services/hr.service";

export interface RosterMemberItem {
  id: string;
  personId?: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  committeeId?: string | null;
  committeeName: string;
  trackId?: string | null;
  managedTrackId?: string | null;
  managedTrackName?: string | null;
  role: MembershipRole;
  isActive: boolean;
}

export interface CommitteeOption {
  id: string;
  name: string;
  slug?: string;
  trackId?: string | null;
}

export interface TrackOption {
  id: string;
  name: string;
}

export interface PersonDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
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
    phoneNumber?: string | null;
    role: MembershipRole;
    committeeId: string | null;
    tempPassword?: string;
  }>;
  errors?: string[];
  error?: string;
}

interface RosterManagerViewProps {
  members: RosterMemberItem[];
  peopleDirectory?: PersonDirectoryEntry[];
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
    phoneNumber?: string | null;
    role: MembershipRole;
    committeeId?: string | null;
    managedTrackId?: string | null;
  }) => Promise<
    {
      ok: boolean;
      memberId?: string;
      personId?: string;
      phoneNumber?: string | null;
      existingPerson?: boolean;
      tempPassword?: string;
      error?: string;
    } | void
  >;
  onBulkImport?: (csvContent: string) => Promise<BulkImportResult>;
  onRemoveMember?: (
    memberId: string
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onUpdatePhone?: (
    memberId: string,
    phoneNumber: string | null
  ) => Promise<{ ok: boolean; phoneNumber?: string | null; error?: string } | void>;
}

const PROTECTED_RESET_ROLES = new Set<MembershipRole>([
  "master_admin",
  "director",
  "hr_admin",
]);

const ROLE_LABELS: Record<MembershipRole, string> = {
  master_admin: "Master",
  director: "Director",
  hr_admin: "HR Admin",
  hr_member: "HR Member",
  committee_head: "Head",
  member: "Member",
  attendee: "Attendee",
};

const ROLE_BADGE_COLORS: Record<MembershipRole, string> = {
  master_admin: "bg-[#002855] text-white border border-[#ffc627]",
  director: "bg-[#5a1b63] text-white border border-[#ffc627]/40",
  hr_admin: "bg-[#772583] text-white",
  hr_member: "bg-[#007377] text-white",
  committee_head: "bg-[#00629b] text-white",
  member: "bg-[#ebf3f8] text-[#002855]",
  attendee: "bg-[#f5edf7] text-[#5a1b63]",
};

const SELECT_CLASS =
  "h-8 max-w-[190px] rounded-md border border-border bg-white px-2 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]";

const FILTER_SELECT_CLASS =
  "h-10 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]";

export function RosterManagerView({
  members: initialMembers,
  peopleDirectory = [],
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
    { id: "comm-hr", name: "Human Resources", slug: "human-resources" },
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
  onUpdatePhone,
}: RosterManagerViewProps) {
  const [members, setMembers] = useState(initialMembers);
  const [prevInitialMembers, setPrevInitialMembers] = useState(initialMembers);
  if (initialMembers !== prevInitialMembers) {
    setPrevInitialMembers(initialMembers);
    setMembers(initialMembers);
  }
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Add Member / Add Role Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhoneNumber, setAddPhoneNumber] = useState("");
  const [addRole, setAddRole] = useState<MembershipRole>("member");
  const [addCommitteeId, setAddCommitteeId] = useState("");
  const [addManagedTrackId, setAddManagedTrackId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addAutofillSource, setAddAutofillSource] = useState<string | null>(
    null
  );

  // Inline Phone Number Editing
  const [editingPhoneMemberId, setEditingPhoneMemberId] = useState<string | null>(
    null
  );
  const [editingPhoneValue, setEditingPhoneValue] = useState("");
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null);

  // Bulk CSV Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] =
    useState<CsvRosterParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Password Modal
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
        setSearchDropdownOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const committeeById = useMemo(
    () => new Map(availableCommittees.map((c) => [c.id, c])),
    [availableCommittees]
  );

  // Group all active roles per person (by personId or lowercased email fallback)
  const rolesByPersonKey = useMemo(() => {
    const map = new Map<string, RosterMemberItem[]>();
    for (const m of members) {
      if (!m.isActive) continue;
      const key = m.personId ?? m.email.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [members]);

  // Ranked Google-style search suggestions:
  // 1) Top N existing active roster matches (deduplicated per person)
  // 2) Top N inactive people-directory matches (not on active roster)
  // 3) Always-available "Add <query> as new member" (default on Enter for Master Admin)
  const MAX_SUGGESTIONS_PER_GROUP = 4;

  const scoreMatch = (fullName: string, email: string, q: string) => {
    const nameLower = fullName.toLowerCase();
    const emailLower = email.toLowerCase();
    if (nameLower.startsWith(q)) return 0;
    if (nameLower.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (emailLower.startsWith(q)) return 2;
    if (nameLower.includes(q)) return 3;
    return 4;
  };

  const activeMemberSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const uniquePeople: Array<{
      key: string;
      fullName: string;
      email: string;
      roles: RosterMemberItem[];
    }> = [];
    for (const m of members) {
      if (!m.isActive) continue;
      const key = m.personId ?? m.email.toLowerCase();
      if (seen.has(key)) continue;
      if (
        !m.fullName.toLowerCase().includes(q) &&
        !m.email.toLowerCase().includes(q)
      ) {
        continue;
      }
      seen.add(key);
      uniquePeople.push({
        key,
        fullName: m.fullName,
        email: m.email,
        roles: rolesByPersonKey.get(key) ?? [m],
      });
    }
    return uniquePeople
      .sort((a, b) => {
        const diff =
          scoreMatch(a.fullName, a.email, q) -
          scoreMatch(b.fullName, b.email, q);
        return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName);
      })
      .slice(0, MAX_SUGGESTIONS_PER_GROUP);
  }, [search, members, rolesByPersonKey]);

  // People directory matches when searching (people from `persons` DB not currently on the active roster)
  const directoryMatches = useMemo(() => {
    if (!isMaster) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const activeRosterEmails = new Set(
      members.filter((m) => m.isActive).map((m) => m.email.toLowerCase())
    );

    return peopleDirectory
      .filter(
        (p) =>
          !activeRosterEmails.has(p.email.toLowerCase()) &&
          (p.fullName.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const diff =
          scoreMatch(a.fullName, a.email, q) -
          scoreMatch(b.fullName, b.email, q);
        return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName);
      })
      .slice(0, MAX_SUGGESTIONS_PER_GROUP);
  }, [isMaster, search, peopleDirectory, members]);

  type SearchSuggestion =
    | {
        kind: "active";
        key: string;
        fullName: string;
        email: string;
        roles: RosterMemberItem[];
      }
    | {
        kind: "directory";
        key: string;
        id: string;
        fullName: string;
        email: string;
      }
    | {
        kind: "add_new";
        key: string;
        query: string;
      };

  const searchSuggestions = useMemo<SearchSuggestion[]>(() => {
    const q = search.trim();
    if (!q) return [];
    const items: SearchSuggestion[] = [
      ...activeMemberSuggestions.map((item) => ({
        kind: "active" as const,
        ...item,
      })),
      ...directoryMatches.map((person) => ({
        kind: "directory" as const,
        key: `dir-${person.id}`,
        id: person.id,
        fullName: person.fullName,
        email: person.email,
      })),
    ];
    if (isMaster) {
      items.push({ kind: "add_new", key: "add-new", query: q });
    }
    return items;
  }, [search, activeMemberSuggestions, directoryMatches, isMaster]);

  // HR members and uncovered committees for the highlighted HR Assignments section
  const activeHrMembers = useMemo(
    () => members.filter((m) => m.isActive && m.role === "hr_member"),
    [members]
  );

  const trackableCommittees = useMemo(
    () =>
      availableCommittees.filter(
        (c) =>
          c.slug !== "human-resources" &&
          c.name.toLowerCase() !== "human resources"
      ),
    [availableCommittees]
  );

  const uncoveredCommittees = useMemo(() => {
    const coveredIds = new Set(
      activeHrMembers
        .map((m) => m.committeeId)
        .filter((id): id is string => Boolean(id))
    );
    return trackableCommittees.filter((c) => !coveredIds.has(c.id));
  }, [activeHrMembers, trackableCommittees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((m) => {
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (committeeFilter !== "all") {
        if (committeeFilter === "unassigned") {
          if (m.committeeId) return false;
        } else if (m.committeeId !== committeeFilter) {
          return false;
        }
      }
      if (trackFilter !== "all") {
        const effectiveTrackId =
          m.role === "director"
            ? m.managedTrackId
            : (m.trackId ??
              (m.committeeId ? committeeById.get(m.committeeId)?.trackId : null));
        if (effectiveTrackId !== trackFilter) return false;
      }

      if (!q) return true;
      const digitsQuery = q.replace(/\D/g, "");
      const phoneDigits = (m.phoneNumber ?? "").replace(/\D/g, "");
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (digitsQuery.length >= 3 && phoneDigits.includes(digitsQuery)) ||
        m.committeeName.toLowerCase().includes(q) ||
        (m.managedTrackName ?? "").toLowerCase().includes(q) ||
        (ROLE_LABELS[m.role] ?? m.role).toLowerCase().includes(q)
      );
    });
  }, [
    members,
    search,
    roleFilter,
    committeeFilter,
    trackFilter,
    statusFilter,
    committeeById,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    committeeFilter !== "all" ||
    trackFilter !== "all" ||
    statusFilter !== "active";

  const openAddModalPrefilled = (prefill?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string | null;
    fromDirectory?: boolean;
  }) => {
    setAddError("");
    setAddFullName(prefill?.fullName ?? "");
    setAddEmail(prefill?.email ?? "");
    setAddPhoneNumber(prefill?.phoneNumber ?? "");
    setAddRole("member");
    setAddCommitteeId("");
    setAddManagedTrackId("");
    setAddAutofillSource(
      prefill?.fromDirectory
        ? `Autofilled from people directory (${prefill.email}). Assigning an additional role keeps their existing password.`
        : null
    );
    setAddModalOpen(true);
  };

  // Autofill name/email/phone inside the modal if typed email matches someone in peopleDirectory
  const handleEmailChangeInModal = (val: string) => {
    setAddEmail(val);
    const normalized = val.trim().toLowerCase();
    if (!normalized) {
      setAddAutofillSource(null);
      return;
    }
    const found = peopleDirectory.find(
      (p) => p.email.toLowerCase() === normalized
    );
    if (found) {
      setAddFullName(found.fullName);
      if (found.phoneNumber) setAddPhoneNumber(found.phoneNumber);
      setAddAutofillSource(
        `Matched existing person "${found.fullName}" in people database.`
      );
    }
  };

  const handleSavePhoneNumber = async (member: RosterMemberItem) => {
    setActionError(null);
    setActionNotice(null);
    const trimmed = editingPhoneValue.trim();
    const normalized = trimmed.length > 0 ? normalizePhoneNumber(trimmed) : null;
    if (trimmed.length > 0 && !normalized) {
      setActionError(
        "Invalid phone number. Use an Egyptian mobile (e.g. 01012345678) or international format (+20...)."
      );
      return;
    }

    setSavingPhoneId(member.id);
    try {
      let savedPhone = normalized;
      if (onUpdatePhone) {
        const res = await onUpdatePhone(member.id, normalized);
        if (res && !res.ok) {
          setActionError(res.error ?? "Failed to update phone number.");
          return;
        }
        if (res && "phoneNumber" in res) {
          savedPhone = res.phoneNumber ?? null;
        }
      }
      const targetKey = member.personId ?? member.email.toLowerCase();
      setMembers((prev) =>
        prev.map((m) =>
          (m.personId ?? m.email.toLowerCase()) === targetKey
            ? { ...m, phoneNumber: savedPhone }
            : m
        )
      );
      setEditingPhoneMemberId(null);
      setEditingPhoneValue("");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update phone number."
      );
    } finally {
      setSavingPhoneId(null);
    }
  };

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
          const added: RosterMemberItem[] = res.imported.map((item) => {
            const comm = item.committeeId
              ? committeeById.get(item.committeeId)
              : undefined;
            return {
              id: item.id,
              personId: item.personId,
              fullName: item.fullName,
              email: item.email,
              phoneNumber: item.phoneNumber ?? null,
              role: item.role,
              committeeId: item.committeeId,
              committeeName: comm?.name ?? "Unassigned",
              trackId: comm?.trackId ?? null,
              isActive: true,
            };
          });
          setMembers((prev) => [...added, ...prev]);
        }
        setActionNotice(
          `Imported ${res.importedCount ?? 0} member(s)${
            res.skippedCount ? ` (${res.skippedCount} skipped)` : ""
          }. Newly created accounts were initialized with the configured default password.`
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
          prev.map((m) => (m.id === memberId ? previous : m))
        );
        setActionError(res.error ?? "Failed to update member role.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? previous : m))
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
              trackId: newTrackId || null,
            }
          : m
      )
    );
    try {
      const res = await onAssignDirectorTrack?.(memberId, newTrackId || null);
      if (res && !res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? previous : m))
        );
        setActionError(res.error ?? "Failed to assign director track.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? previous : m))
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
    const found = committeeById.get(newCommitteeId);
    const isHrMember = previous.role === "hr_member";
    const isHrSelf =
      found?.slug === "human-resources" ||
      found?.name.toLowerCase() === "human resources";
    const effectiveCommitteeId =
      isHrMember && isHrSelf ? null : newCommitteeId || null;

    setActionError(null);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              committeeId: effectiveCommitteeId,
              committeeName: isHrMember
                ? effectiveCommitteeId && found
                  ? `Tracks ${found.name}`
                  : "Unassigned"
                : found
                  ? found.name
                  : "Unassigned",
              trackId: effectiveCommitteeId ? (found?.trackId ?? null) : null,
            }
          : m
      )
    );
    try {
      const res = await onAssignCommittee?.(memberId, effectiveCommitteeId);
      if (res && !res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? previous : m))
        );
        setActionError(res.error ?? "Failed to update committee assignment.");
      }
    } catch (err: unknown) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? previous : m))
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
        `Are you sure you want to remove ${member.fullName} (${ROLE_LABELS[member.role]}) from the active roster?`
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
      let createdPersonId: string | undefined;
      const isDirectorRole = addRole === "director";
      const submittedCommitteeId = isDirectorRole
        ? null
        : addCommitteeId || null;
      const submittedTrackId = isDirectorRole
        ? addManagedTrackId || null
        : null;

      const trimmedPhone = addPhoneNumber.trim();
      const normalizedModalPhone =
        trimmedPhone.length > 0 ? normalizePhoneNumber(trimmedPhone) : null;
      if (trimmedPhone.length > 0 && !normalizedModalPhone) {
        setAddError(
          "Invalid phone number. Enter an Egyptian mobile (e.g. 01012345678) or international E.164 number (+20...)."
        );
        return;
      }

      let resolvedPhone: string | null = normalizedModalPhone;

      if (onAddMember) {
        const res = await onAddMember({
          fullName: addFullName.trim(),
          email: addEmail.trim(),
          phoneNumber: normalizedModalPhone,
          role: addRole,
          committeeId: submittedCommitteeId,
          ...(isDirectorRole ? { managedTrackId: submittedTrackId } : {}),
        });
        if (res && !res.ok) {
          setAddError(res.error ?? "Failed to add member to roster.");
          return;
        }
        if (res && res.memberId) createdId = res.memberId;
        if (res && res.personId) createdPersonId = res.personId;
        if (res && "phoneNumber" in res) {
          resolvedPhone = res.phoneNumber ?? null;
        }
        if (res && res.existingPerson) {
          setActionNotice(
            `Added ${ROLE_LABELS[addRole]} role to existing person ${addFullName.trim()} (existing password preserved).`
          );
        } else if (res && res.tempPassword) {
          setResetModal({
            open: true,
            memberName: addFullName.trim(),
            memberEmail: addEmail.trim().toLowerCase(),
            tempPassword: res.tempPassword,
          });
        }
      }
      const comm = submittedCommitteeId
        ? committeeById.get(submittedCommitteeId)
        : undefined;
      const track = availableTracks.find((t) => t.id === submittedTrackId);
      const isHrMember = addRole === "hr_member";
      const newMember: RosterMemberItem = {
        id: createdId,
        personId: createdPersonId,
        fullName: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        phoneNumber: resolvedPhone,
        role: addRole,
        committeeId: submittedCommitteeId,
        committeeName: isHrMember
          ? comm
            ? `Tracks ${comm.name}`
            : "Unassigned"
          : (comm?.name ?? "Unassigned"),
        trackId: isDirectorRole ? submittedTrackId : (comm?.trackId ?? null),
        managedTrackId: submittedTrackId,
        managedTrackName: track?.name ?? null,
        isActive: true,
      };
      setMembers((prev) => [newMember, ...prev]);
      setAddModalOpen(false);
      setAddFullName("");
      setAddEmail("");
      setAddPhoneNumber("");
      setAddRole("member");
      setAddCommitteeId("");
      setAddManagedTrackId("");
      setAddAutofillSource(null);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Error adding member.");
    } finally {
      setIsAdding(false);
    }
  };

  const trimmedQuery = search.trim();
  const queryLooksLikeEmail = trimmedQuery.includes("@");

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

      {actionNotice && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#78be20]/40 bg-[#78be20]/10 p-3 text-xs font-semibold text-[#1e6b0a]">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            aria-label="Dismiss notice"
            className="rounded p-0.5 hover:bg-[#78be20]/20"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
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
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#002855]">
            Chapter Roster
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMaster
              ? "Manage chapter members, assign roles, and assign HR officers to committees."
              : currentUserRole === "hr_admin"
                ? "View the chapter roster and assign HR officers to committees."
                : "View active members and leadership across your assigned committees."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMaster && (
            <>
              <Button
                type="button"
                onClick={() => openAddModalPrefilled()}
                className="h-10 gap-2 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
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

      {/* Highlighted HR Officer -> Committee Assignment Panel for HR Admin & Master */}
      {canAssignHr && activeHrMembers.length > 0 && (
        <Card className="border-[#007377]/30 bg-white shadow-xs">
          <CardHeader className="border-b border-border/70 bg-[#e3f5f6]/50 px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#007377]" aria-hidden="true" />
                <CardTitle className="font-heading text-sm font-bold text-[#002855]">
                  HR Officer Committee Assignments ({activeHrMembers.length})
                </CardTitle>
              </div>
              {uncoveredCommittees.length > 0 ? (
                <span className="text-xs font-semibold text-[#92400e]">
                  {uncoveredCommittees.length} committee
                  {uncoveredCommittees.length === 1 ? "" : "s"} need an HR
                  officer
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#1e6b0a]">
                  All committees covered
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeHrMembers.map((hr) => (
                <div
                  key={`hr-assign-${hr.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#f8f9fb] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-heading text-xs font-bold text-[#002855]">
                      {hr.fullName}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {hr.email}
                    </p>
                  </div>
                  <select
                    aria-label={`Assign tracked committee for HR officer ${hr.fullName}`}
                    value={hr.committeeId ?? ""}
                    onChange={(e) =>
                      handleCommitteeChange(hr.id, e.target.value)
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="">Unassigned</option>
                    {trackableCommittees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {uncoveredCommittees.length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                <strong className="text-[#002855]">Uncovered:</strong>{" "}
                {uncoveredCommittees.map((c) => c.name).join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search + Google-style Suggestions Dropdown + Multi-Facet Filters */}
      <Card className="overflow-visible border-border bg-white shadow-xs">
        <CardContent className="space-y-3 p-4">
          <div ref={searchBoxRef} className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              role="combobox"
              aria-expanded={searchDropdownOpen && searchSuggestions.length > 0}
              aria-controls="roster-search-suggestions"
              aria-autocomplete="list"
              placeholder="Search by name or email... (or press Enter to add new member)"
              value={search}
              onFocus={() => {
                if (search.trim()) setSearchDropdownOpen(true);
              }}
              onChange={(e) => {
                const next = e.target.value;
                setSearch(next);
                setSearchDropdownOpen(next.trim().length > 0);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  if (searchSuggestions.length === 0) return;
                  e.preventDefault();
                  setSearchDropdownOpen(true);
                  setActiveSuggestionIndex((prev) =>
                    prev < searchSuggestions.length - 1 ? prev + 1 : 0
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  if (searchSuggestions.length === 0) return;
                  e.preventDefault();
                  setActiveSuggestionIndex((prev) =>
                    prev <= 0 ? -1 : prev - 1
                  );
                  return;
                }
                if (e.key === "Escape") {
                  if (searchDropdownOpen) {
                    e.preventDefault();
                    setSearchDropdownOpen(false);
                    setActiveSuggestionIndex(-1);
                  }
                  return;
                }
                if (e.key === "Enter" && trimmedQuery.length > 0) {
                  e.preventDefault();
                  const chosen =
                    activeSuggestionIndex >= 0
                      ? searchSuggestions[activeSuggestionIndex]
                      : null;

                  if (chosen?.kind === "active") {
                    setSearch(chosen.fullName);
                    setSearchDropdownOpen(false);
                    setActiveSuggestionIndex(-1);
                    return;
                  }
                  if (chosen?.kind === "directory") {
                    setSearchDropdownOpen(false);
                    setActiveSuggestionIndex(-1);
                    openAddModalPrefilled({
                      fullName: chosen.fullName,
                      email: chosen.email,
                      fromDirectory: true,
                    });
                    return;
                  }
                  if (chosen?.kind === "add_new" || (isMaster && !chosen)) {
                    setSearchDropdownOpen(false);
                    setActiveSuggestionIndex(-1);
                    openAddModalPrefilled({
                      fullName: queryLooksLikeEmail ? "" : trimmedQuery,
                      email: queryLooksLikeEmail ? trimmedQuery : "",
                    });
                  }
                }
              }}
              className="h-10 pr-9 pl-10 text-sm"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  setSearchDropdownOpen(false);
                  setActiveSuggestionIndex(-1);
                }}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {/* Attached Google-Style Suggestions Popover */}
            {searchDropdownOpen && searchSuggestions.length > 0 && (
              <div
                id="roster-search-suggestions"
                role="listbox"
                aria-label="Roster search suggestions"
                className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-white shadow-lg"
              >
                {activeMemberSuggestions.length > 0 && (
                  <div className="border-b border-border/60 py-1.5">
                    <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Active Roster ({activeMemberSuggestions.length})
                    </div>
                    {activeMemberSuggestions.map((item, idx) => {
                      const isHighlighted = activeSuggestionIndex === idx;
                      return (
                        <div
                          key={item.key}
                          role="option"
                          aria-selected={isHighlighted}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearch(item.fullName);
                            setSearchDropdownOpen(false);
                            setActiveSuggestionIndex(-1);
                          }}
                          className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-xs transition-colors ${
                            isHighlighted
                              ? "bg-[#f5edf7] text-[#5a1b63]"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Search
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-heading font-bold text-[#002855]">
                                {item.fullName}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">
                                {item.email} ·{" "}
                                {item.roles
                                  .map((r) => ROLE_LABELS[r.role])
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                          {isMaster && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearchDropdownOpen(false);
                                setActiveSuggestionIndex(-1);
                                openAddModalPrefilled({
                                  fullName: item.fullName,
                                  email: item.email,
                                  fromDirectory: true,
                                });
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#772583]/30 bg-white px-2 py-1 text-[11px] font-semibold text-[#772583] hover:bg-[#772583] hover:text-white"
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" />
                              Add Role
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {directoryMatches.length > 0 && (
                  <div className="border-b border-border/60 py-1.5">
                    <div className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      People Directory — Not on Active Roster (
                      {directoryMatches.length})
                    </div>
                    {directoryMatches.map((person, offset) => {
                      const idx = activeMemberSuggestions.length + offset;
                      const isHighlighted = activeSuggestionIndex === idx;
                      return (
                        <div
                          key={`dir-${person.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchDropdownOpen(false);
                            setActiveSuggestionIndex(-1);
                            openAddModalPrefilled({
                              fullName: person.fullName,
                              email: person.email,
                              fromDirectory: true,
                            });
                          }}
                          className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-xs transition-colors ${
                            isHighlighted
                              ? "bg-[#f5edf7] text-[#5a1b63]"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserCheck
                              className="h-3.5 w-3.5 shrink-0 text-[#00629b]"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-heading font-bold text-[#002855]">
                                {person.fullName}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">
                                {person.email}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-[#ebf3f8] px-2 py-0.5 text-[11px] font-semibold text-[#00629b]">
                            Add to season
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isMaster && (
                  <div className="bg-[#f8f9fb] p-1.5">
                    {(() => {
                      const addIdx = searchSuggestions.length - 1;
                      const isHighlighted =
                        activeSuggestionIndex === addIdx ||
                        activeSuggestionIndex === -1;
                      return (
                        <div
                          role="option"
                          aria-selected={activeSuggestionIndex === addIdx}
                          onMouseEnter={() => setActiveSuggestionIndex(addIdx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchDropdownOpen(false);
                            setActiveSuggestionIndex(-1);
                            openAddModalPrefilled({
                              fullName: queryLooksLikeEmail ? "" : trimmedQuery,
                              email: queryLooksLikeEmail ? trimmedQuery : "",
                            });
                          }}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                            isHighlighted
                              ? "bg-[#772583] text-white"
                              : "text-[#5a1b63] hover:bg-[#f5edf7]"
                          }`}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2 truncate">
                            <UserPlus
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              Add &ldquo;{trimmedQuery}&rdquo; as new member
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                              isHighlighted
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Enter ↵
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filter Selects */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Roles</option>
              <option value="master_admin">Master</option>
              <option value="director">Director</option>
              <option value="hr_admin">HR Admin</option>
              <option value="hr_member">HR Member</option>
              <option value="committee_head">Head</option>
              <option value="member">Member</option>
              <option value="attendee">Attendee</option>
            </select>

            <select
              aria-label="Filter by committee"
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Committees</option>
              <option value="unassigned">Unassigned</option>
              {availableCommittees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by track"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Tracks</option>
              {availableTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} Track
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="active">Active Only</option>
              <option value="all">All Statuses</option>
              <option value="inactive">Deactivated</option>
            </select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setCommitteeFilter("all");
                  setTrackFilter("all");
                  setStatusFilter("active");
                }}
                className="h-9 text-xs font-semibold text-[#772583] hover:bg-[#f5edf7]"
              >
                Reset filters
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              Showing <strong className="text-[#002855]">{filtered.length}</strong>{" "}
              of {members.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Roster Table */}
      <Card className="border-border bg-white shadow-xs">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fb]">
              <TableRow>
                <TableHead className="font-heading text-xs font-bold text-[#002855]">
                  Member
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
                  <TableHead className="text-right font-heading text-xs font-bold text-[#002855]">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const personKey = m.personId ?? m.email.toLowerCase();
                const personRoles = rolesByPersonKey.get(personKey) ?? [m];
                const isMultiRole = personRoles.length > 1;
                const hasProtectedHat = personRoles.some((r) =>
                  PROTECTED_RESET_ROLES.has(r.role)
                );

                const canEditThisRole = isMaster;
                const canAssignThisCommittee =
                  isMaster || (canAssignHr && m.role === "hr_member");
                const canResetThisPassword =
                  isMaster ||
                  (currentUserRole === "hr_admin" && !hasProtectedHat);

                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-heading text-sm font-bold text-[#002855]">
                          {m.fullName}
                        </span>
                        {isMultiRole && (
                          <Badge className="bg-[#ebf3f8] text-[10px] font-semibold text-[#00629b]">
                            {personRoles.length} roles
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {m.email}
                      </div>
                      {editingPhoneMemberId === m.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Input
                            type="tel"
                            aria-label={`Phone number for ${m.fullName}`}
                            placeholder="01012345678 or +20..."
                            value={editingPhoneValue}
                            onChange={(e) =>
                              setEditingPhoneValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleSavePhoneNumber(m);
                              } else if (e.key === "Escape") {
                                setEditingPhoneMemberId(null);
                                setEditingPhoneValue("");
                              }
                            }}
                            className="h-7 w-44 font-mono text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingPhoneId === m.id}
                            onClick={() => handleSavePhoneNumber(m)}
                            className="h-7 bg-[#772583] px-2.5 text-[11px] font-semibold text-white hover:bg-[#5a1b63]"
                          >
                            {savingPhoneId === m.id ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPhoneMemberId(null);
                              setEditingPhoneValue("");
                            }}
                            className="h-7 px-2 text-[11px]"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {m.phoneNumber ? (
                            <WhatsAppPhoneLink
                              phoneNumber={m.phoneNumber}
                              personName={m.fullName}
                            />
                          ) : null}
                          {(isMaster || canAssignHr) && (
                            <button
                              type="button"
                              aria-label={
                                m.phoneNumber
                                  ? `Edit phone number for ${m.fullName}`
                                  : `Add phone number for ${m.fullName}`
                              }
                              onClick={() => {
                                setEditingPhoneMemberId(m.id);
                                setEditingPhoneValue(m.phoneNumber ?? "");
                              }}
                              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-[#002855]"
                            >
                              {m.phoneNumber ? (
                                <Pencil
                                  className="h-2.5 w-2.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <>
                                  <Phone
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                  <span>Add phone</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {isMultiRole && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Also:{" "}
                          {personRoles
                            .filter((r) => r.id !== m.id)
                            .map((r) =>
                              r.role === "director"
                                ? `Director (${r.managedTrackName ?? "All Tracks"})`
                                : `${ROLE_LABELS[r.role]} (${r.committeeName})`
                            )
                            .join(", ")}
                        </div>
                      )}
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
                            className={SELECT_CLASS}
                          >
                            <option value="">All Tracks (Chapter-wide)</option>
                            {availableTracks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} Track
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>
                            {m.managedTrackName
                              ? `${m.managedTrackName} Track`
                              : "All Tracks"}
                          </span>
                        )
                      ) : canAssignThisCommittee ? (
                        <select
                          aria-label={`Assign committee for ${m.fullName}`}
                          value={m.committeeId ?? ""}
                          onChange={(e) =>
                            handleCommitteeChange(m.id, e.target.value)
                          }
                          className={SELECT_CLASS}
                        >
                          <option value="">Unassigned</option>
                          {(m.role === "hr_member"
                            ? trackableCommittees
                            : availableCommittees
                          ).map((c) => (
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
                          className={SELECT_CLASS}
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
                          className={`text-[11px] font-semibold ${ROLE_BADGE_COLORS[m.role]}`}
                        >
                          {ROLE_LABELS[m.role] ?? m.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e6b0a]">
                          <UserCheck
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
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
                        <div className="flex items-center justify-end gap-1.5">
                          {isMaster && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openAddModalPrefilled({
                                  fullName: m.fullName,
                                  email: m.email,
                                  phoneNumber: m.phoneNumber ?? null,
                                  fromDirectory: true,
                                })
                              }
                              aria-label={`Add another role for ${m.fullName}`}
                              className="h-8 gap-1 border-border px-2.5 text-xs font-semibold text-[#002855] hover:bg-[#ebf3f8]"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Add Role</span>
                            </Button>
                          )}
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
                          {isMaster && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                m.role !== "master_admin" &&
                                handleRemoveMember(m)
                              }
                              disabled={
                                removingId === m.id ||
                                m.role === "master_admin"
                              }
                              title={
                                m.role === "master_admin"
                                  ? "Master Admin cannot be removed"
                                  : undefined
                              }
                              aria-label={`Remove ${m.fullName} from roster`}
                              className={
                                m.role === "master_admin"
                                  ? "h-8 gap-1.5 border-border text-xs font-semibold text-muted-foreground"
                                  : "h-8 gap-1.5 border-[#ba0c2f]/30 text-xs font-semibold text-[#ba0c2f] hover:bg-[#ba0c2f]/10"
                              }
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Remove</span>
                            </Button>
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
                    colSpan={isMaster || canAssignHr ? 5 : 4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    <p>No members match your current filters.</p>
                    {isMaster && trimmedQuery && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          openAddModalPrefilled({
                            fullName: queryLooksLikeEmail ? "" : trimmedQuery,
                            email: queryLooksLikeEmail ? trimmedQuery : "",
                          })
                        }
                        className="mt-3 h-9 gap-1.5 bg-[#772583] px-4 text-xs font-semibold text-white hover:bg-[#5a1b63]"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add &ldquo;{trimmedQuery}&rdquo; to Roster</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Member / Assign Role Modal */}
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
              className="absolute top-4 right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Add Member to Roster
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              New people are automatically assigned the default password from
              environment settings. Existing people keep their account and gain
              an additional role.
            </p>

            {addAutofillSource && (
              <div className="mt-3 rounded-lg border border-[#00629b]/25 bg-[#ebf3f8] px-3 py-2 text-xs text-[#002855]">
                {addAutofillSource}
              </div>
            )}

            {addError && (
              <div
                role="alert"
                className="mt-3 rounded bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="add-member-name"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Full Name
                </label>
                <Input
                  id="add-member-name"
                  type="text"
                  required
                  placeholder="e.g. Ahmed Mostafa"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="add-member-email"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Email Address
                </label>
                <Input
                  id="add-member-email"
                  type="email"
                  required
                  placeholder="e.g. ahmed.mostafa@cu.edu.eg"
                  value={addEmail}
                  onChange={(e) => handleEmailChangeInModal(e.target.value)}
                  className="mt-1 h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="add-member-phone"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Phone Number{" "}
                  <span className="font-normal text-muted-foreground">
                    (Optional · WhatsApp &amp; Login)
                  </span>
                </label>
                <Input
                  id="add-member-phone"
                  type="tel"
                  placeholder="e.g. 01012345678 or +201012345678"
                  value={addPhoneNumber}
                  onChange={(e) => setAddPhoneNumber(e.target.value)}
                  className="mt-1 h-10 font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="add-member-role"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  Member Role
                </label>
                <select
                  id="add-member-role"
                  value={addRole}
                  onChange={(e) =>
                    setAddRole(e.target.value as MembershipRole)
                  }
                  className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                >
                  <option value="member">Member</option>
                  <option value="committee_head">Committee Head</option>
                  <option value="hr_member">HR Member</option>
                  <option value="hr_admin">HR Admin</option>
                  <option value="director">Director</option>
                  <option value="attendee">Attendee</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>

              {addRole === "director" ? (
                <div>
                  <label
                    htmlFor="add-member-track"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    Managed Committee Track
                  </label>
                  <select
                    id="add-member-track"
                    value={addManagedTrackId}
                    onChange={(e) => setAddManagedTrackId(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                  >
                    <option value="">All Tracks (Chapter-wide Director)</option>
                    {availableTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} Track
                      </option>
                    ))}
                  </select>
                </div>
              ) : addRole !== "master_admin" && addRole !== "hr_admin" ? (
                <div>
                  <label
                    htmlFor="add-member-committee"
                    className="block font-heading text-xs font-bold text-[#002855]"
                  >
                    {addRole === "hr_member"
                      ? "Tracked Committee"
                      : "Committee"}
                  </label>
                  <select
                    id="add-member-committee"
                    value={addCommitteeId}
                    onChange={(e) => setAddCommitteeId(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#002855] focus:outline-2 focus:outline-[#772583]"
                  >
                    <option value="">Unassigned</option>
                    {(addRole === "hr_member"
                      ? trackableCommittees
                      : availableCommittees
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  className="h-10 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isAdding || !addFullName.trim() || !addEmail.trim()
                  }
                  className="h-10 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
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
          aria-label="CSV Bulk Import"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close import modal"
              onClick={() => setImportModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#772583]" />
              <h2 className="font-heading text-lg font-bold text-[#002855]">
                Bulk Import Roster CSV
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste CSV content with headers:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                full_name, email, committee_slug, role[, phone_number]
              </code>
              . New accounts are initialized with the configured default
              password.
            </p>

            {importError && (
              <div
                role="alert"
                className="mt-3 rounded bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {importError}
              </div>
            )}

            <label htmlFor="csv-roster-input" className="sr-only">
              CSV Roster Content
            </label>
            <textarea
              id="csv-roster-input"
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`full_name,email,committee_slug,role\nOmar Tarek,omar.tarek@cu.edu.eg,robotics-and-automation,member`}
              className="mt-4 w-full rounded-lg border border-border bg-[#f8f9fb] p-3 font-mono text-xs focus:outline-2 focus:outline-[#772583]"
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleParseCsv}
                disabled={!csvText.trim()}
                className="h-9 text-xs font-semibold text-[#002855]"
              >
                Validate &amp; Preview
              </Button>

              {importResult && (
                <div className="text-xs font-semibold">
                  <span className="text-[#1e6b0a]">
                    {importResult.validRecords.length} valid
                  </span>
                  {importResult.errors.length > 0 && (
                    <span className="ml-2 text-[#ba0c2f]">
                      · {importResult.errors.length} errors
                    </span>
                  )}
                </div>
              )}
            </div>

            {importResult && importResult.errors.length > 0 && (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/5 p-2.5 text-xs text-[#ba0c2f]">
                {importResult.errors.map((err, idx) => (
                  <p key={idx}>
                    Line {err.line}: {err.message}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
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
                className="h-10 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
              >
                {isImporting
                  ? "Importing..."
                  : `Confirm Import (${importResult?.validRecords.length ?? 0})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Password Issued / Reset Modal */}
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
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close password modal"
              onClick={() => setResetModal(null)}
              className="absolute top-4 right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#002855]">
              Temporary Password Generated
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this default temporary password with{" "}
              <strong className="text-foreground">
                {resetModal.memberName}
              </strong>{" "}
              ({resetModal.memberEmail}). They will be prompted to set a
              personal password on first login.
            </p>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-[#f8f9fb] p-3">
              <code className="font-mono text-base font-extrabold tracking-wider text-[#772583]">
                {resetModal.tempPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(
                      resetModal.tempPassword
                    );
                    setResetModal((prev) =>
                      prev ? { ...prev, copied: true } : prev
                    );
                  } catch {
                    // Clipboard unavailable
                  }
                }}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {resetModal.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#1e6b0a]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={() => setResetModal(null)}
                className="h-10 bg-[#002855] px-5 text-xs font-bold text-white hover:bg-[#001c3d]"
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
