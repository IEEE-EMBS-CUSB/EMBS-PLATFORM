"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { switchActiveContextAction } from "@/app/actions/context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  buildContextPickerModel,
  type ActivePortalKind,
  type ContextPickerOption,
  type ContextPickerViewItem,
} from "@/lib/context-picker";
import { cn } from "@/lib/utils";

export interface ContextSwitcherProps {
  contexts: readonly ContextPickerOption[];
  activeMembershipId?: string | null;
  activePortal: ActivePortalKind;
  variant: "desktop" | "mobile";
  fallbackLabel?: string;
  className?: string;
  onSwitched?: () => void;
}

export function ContextSwitcher({
  contexts,
  activeMembershipId,
  activePortal,
  variant,
  fallbackLabel,
  className,
  onSwitched,
}: ContextSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const model = buildContextPickerModel({
    contexts,
    activeMembershipId,
    activePortal,
    fallbackLabel,
  });

  if (!model.activeTriggerLabel) {
    return null;
  }

  // Single-context users see a plain, non-interactive label (Spec §5).
  if (!model.isInteractive) {
    return (
      <p
        className={cn(
          "text-xs leading-relaxed text-muted-foreground",
          className
        )}
      >
        {model.activeTriggerLabel}
      </p>
    );
  }

  const handleSelectView = async (view: ContextPickerViewItem) => {
    if (switchingKey) return;
    if (view.isActive) {
      setOpen(false);
      return;
    }

    setSwitchingKey(view.key);
    setError(null);

    try {
      const res = await switchActiveContextAction(
        view.membershipId,
        view.viewMode
      );
      if (!res.ok) {
        setError(res.error ?? "Failed to switch context.");
        return;
      }

      setOpen(false);
      onSwitched?.();
      if (res.redirectTo) {
        router.push(res.redirectTo);
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg && !/minified react error|server components render/i.test(msg)
          ? msg
          : "Unable to switch context. Please try again."
      );
    } finally {
      setSwitchingKey(null);
    }
  };

  const optionsList = (
    <div className="space-y-3">
      {model.groups.map((group) => (
        <div key={group.membershipId} className="space-y-1">
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.heading}
          </p>
          <div className="space-y-0.5">
            {group.views.map((view) => {
              const isBusy = switchingKey === view.key;
              return (
                <button
                  key={view.key}
                  type="button"
                  disabled={Boolean(switchingKey)}
                  aria-current={view.isActive ? "true" : undefined}
                  onClick={() => handleSelectView(view)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b] disabled:opacity-60",
                    view.isActive
                      ? "bg-[#f5edf7] font-semibold text-[#5a1b63]"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <span className="truncate">
                    {isBusy ? "Switching..." : view.label}
                  </span>
                  {isBusy ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-[#772583]"
                      aria-hidden="true"
                    />
                  ) : view.isActive ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-[#772583]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && (
        <p
          role="alert"
          className="rounded-md bg-[#ba0c2f]/10 px-2.5 py-2 text-xs font-semibold text-[#ba0c2f]"
        >
          {error}
        </p>
      )}
    </div>
  );

  if (variant === "mobile") {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label={`Switch role or view: ${model.activeTriggerLabel}`}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-left text-xs font-semibold text-[#002855] shadow-2xs transition-colors hover:bg-[#f5edf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b]",
                className
              )}
            />
          }
        >
          <span className="truncate">{model.activeTriggerLabel}</span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-[#772583]"
            aria-hidden="true"
          />
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-xl border-t border-border bg-white px-4 pt-4 pb-6"
        >
          <SheetHeader className="p-0 pb-3 text-left">
            <SheetTitle className="font-heading text-base font-bold text-[#002855]">
              Switch role &amp; view
            </SheetTitle>
          </SheetHeader>
          {optionsList}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label={`Switch role or view: ${model.activeTriggerLabel}`}
            className={cn(
              "mt-1.5 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-[#f8f9fb] px-2.5 py-1.5 text-left text-xs font-semibold text-[#002855] transition-colors hover:border-[#772583]/40 hover:bg-[#f5edf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00629b]",
              className
            )}
          />
        }
      >
        <span className="truncate">{model.activeTriggerLabel}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[#772583] transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50"
        >
          <Popover.Popup className="w-64 rounded-lg border border-border bg-white p-3 shadow-lg focus:outline-none">
            {optionsList}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
