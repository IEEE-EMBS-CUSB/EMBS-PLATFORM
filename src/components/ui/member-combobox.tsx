"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MemberComboboxOption {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string | null;
  committeeName?: string;
  roleLabel?: string;
}

interface MemberComboboxProps {
  id?: string;
  options: readonly MemberComboboxOption[];
  value: string;
  onChange: (memberId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  emptyText?: string;
}

interface DropdownRect {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

function measureDropdownRect(anchor: HTMLElement | null): DropdownRect | null {
  if (!anchor || typeof window === "undefined") return null;
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;

  const width =
    rect.width > 0 ? Math.min(rect.width, viewportWidth - 16) : 280;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));

  const spaceBelow = viewportHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

  if (openUpward) {
    return {
      bottom: viewportHeight - rect.top + 4,
      left,
      width,
      maxHeight: Math.min(260, Math.max(120, spaceAbove)),
    };
  }

  return {
    top: rect.bottom + 4,
    left,
    width,
    maxHeight: Math.min(260, Math.max(120, spaceBelow)),
  };
}

export function MemberCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Search member by name, email, or committee...",
  ariaLabel = "Select member",
  disabled = false,
  required = false,
  className,
  emptyText = "No matching members found.",
}: MemberComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `member-combobox-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value) ?? null,
    [options, value]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

  const displayValue = isOpen ? query : (selectedOption?.fullName ?? "");

  const updateDropdownPosition = useCallback(() => {
    setDropdownRect(measureDropdownRect(inputWrapperRef.current));
  }, []);

  const openDropdown = useCallback(() => {
    setDropdownRect(measureDropdownRect(inputWrapperRef.current));
    setIsOpen(true);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const qLocalDigits = qDigits.startsWith("0") ? qDigits.slice(1) : qDigits;
    const sorted = [...options].sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );
    if (!q) return sorted;
    return sorted.filter((opt) => {
      if (
        opt.fullName.toLowerCase().includes(q) ||
        (opt.email ?? "").toLowerCase().includes(q) ||
        (opt.committeeName ?? "").toLowerCase().includes(q) ||
        (opt.roleLabel ?? "").toLowerCase().includes(q)
      ) {
        return true;
      }
      if (qDigits.length > 0 && opt.phoneNumber) {
        const phoneDigits = opt.phoneNumber.replace(/\D/g, "");
        return (
          phoneDigits.includes(qDigits) ||
          (qLocalDigits.length > 0 && phoneDigits.includes(qLocalDigits))
        );
      }
      return false;
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !containerRef.current?.contains(target) &&
        !listboxRef.current?.contains(target)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    const handleReposition = () => {
      updateDropdownPosition();
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen, updateDropdownPosition]);

  const selectOption = (opt: MemberComboboxOption) => {
    onChange(opt.id);
    setQuery(opt.fullName);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
        setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === "Enter" && isOpen) {
      e.preventDefault();
      const target =
        highlightedIndex >= 0
          ? filteredOptions[highlightedIndex]
          : filteredOptions.length === 1
            ? filteredOptions[0]
            : null;
      if (target) {
        selectOption(target);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const listboxStyle: CSSProperties | undefined = dropdownRect
    ? {
        top: dropdownRect.top,
        bottom: dropdownRect.bottom,
        left: dropdownRect.left,
        width: dropdownRect.width,
        maxHeight: dropdownRect.maxHeight,
      }
    : undefined;

  const listboxNode = isOpen ? (
    <ul
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      style={listboxStyle}
      className="fixed z-[100] max-h-64 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-xl"
    >
      {filteredOptions.length === 0 ? (
        <li className="px-3 py-2.5 text-center text-xs text-muted-foreground">
          {emptyText}
        </li>
      ) : (
        filteredOptions.map((opt, idx) => {
          const isSelected = opt.id === value;
          const isHighlighted = idx === highlightedIndex;
          const metaParts = [
            opt.roleLabel,
            opt.committeeName,
            opt.email,
          ].filter(Boolean);

          return (
            <li
              key={opt.id}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                isHighlighted
                  ? "bg-[#f5edf7] text-[#5a1b63]"
                  : isSelected
                    ? "bg-[#f8f9fb] text-[#002855]"
                    : "text-foreground hover:bg-[#f8f9fb]"
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-[#002855]">
                  {opt.fullName}
                </div>
                {metaParts.length > 0 && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {metaParts.join(" · ")}
                  </div>
                )}
              </div>
              {isSelected && (
                <Check
                  className="h-4 w-4 shrink-0 text-[#772583]"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <div
        ref={inputWrapperRef}
        className="relative flex min-w-0 items-center"
      >
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => {
            if (!disabled) {
              setQuery("");
              openDropdown();
              setHighlightedIndex(-1);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) openDropdown();
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-lg border border-border bg-white py-2 pr-14 pl-9 text-xs font-semibold text-[#002855] placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-[#772583] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="absolute right-2 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => {
                onChange("");
                setQuery("");
                setIsOpen(false);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={isOpen ? "Close member list" : "Open member list"}
            onClick={() => {
              if (!disabled) {
                setQuery("");
                if (isOpen) {
                  setIsOpen(false);
                } else {
                  openDropdown();
                }
              }
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {listboxNode && typeof document !== "undefined"
        ? createPortal(listboxNode, document.body)
        : null}
    </div>
  );
}
