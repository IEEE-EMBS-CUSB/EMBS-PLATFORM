"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, QrCode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { memberCheckinAction } from "@/app/hr/attendance/actions";

interface CheckinResponse {
  ok: boolean;
  error?: string;
  pointsAwarded?: number;
  isPunctual?: boolean;
  sessionTitle?: string;
}

export interface QrCheckinHandlerProps {
  initialCode?: string;
  destinationPath: string;
  onCheckin?: (code: string) => Promise<CheckinResponse>;
  onNavigate?: (url: string) => void;
}

export function QrCheckinHandler({
  initialCode = "",
  destinationPath,
  onCheckin,
  onNavigate,
}: QrCheckinHandlerProps) {
  const cleanInitial = initialCode.trim();
  const [code, setCode] = useState(cleanInitial);
  const [phase, setPhase] = useState<
    "idle" | "submitting" | "success" | "already_checked_in" | "error"
  >(cleanInitial ? "submitting" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMeta, setSuccessMeta] = useState<{
    sessionTitle: string;
    pointsAwarded: number;
    isPunctual: boolean;
  } | null>(null);
  const autoSubmittedRef = useRef(false);

  const navigateToDestination = useCallback(
    (url: string) => {
      if (onNavigate) {
        onNavigate(url);
      } else {
        window.location.href = url;
      }
    },
    [onNavigate]
  );

  const submitCode = useCallback(
    async (targetCode: string) => {
      const normalized = targetCode.trim();
      if (!normalized) {
        setPhase("error");
        setErrorMessage("Please enter a valid 6-digit session code.");
        return;
      }

      setPhase("submitting");
      setErrorMessage(null);

      try {
        const res = onCheckin
          ? await onCheckin(normalized)
          : await memberCheckinAction(normalized);

        if (res.ok) {
          const title = res.sessionTitle ?? "Session";
          const pts = res.pointsAwarded ?? 0;
          const punctual = Boolean(res.isPunctual);

          setSuccessMeta({
            sessionTitle: title,
            pointsAwarded: pts,
            isPunctual: punctual,
          });
          setPhase("success");

          const params = new URLSearchParams({
            checkedIn: title,
            points: String(pts),
            punctual: punctual ? "1" : "0",
          });
          navigateToDestination(`${destinationPath}?${params.toString()}`);
          return;
        }

        const msg = res.error ?? "Unable to verify this check-in code.";
        if (/already checked in/i.test(msg)) {
          setPhase("already_checked_in");
          setErrorMessage(msg);
          return;
        }

        setPhase("error");
        setErrorMessage(msg);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        setPhase("error");
        setErrorMessage(
          msg && !/minified react error|server components render/i.test(msg)
            ? msg
            : "Unable to complete check-in right now. Please try again."
        );
      }
    },
    [destinationPath, navigateToDestination, onCheckin]
  );

  useEffect(() => {
    if (!cleanInitial || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void submitCode(cleanInitial);
  }, [cleanInitial, submitCode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCode(code);
  };

  return (
    <Card className="w-full max-w-md border-border bg-white shadow-md">
      <CardContent className="p-6 sm:p-8">
        {phase === "submitting" && (
          <div className="space-y-4 text-center" aria-busy="true">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5edf7] text-[#772583]">
              <QrCode className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-xl font-bold text-[#002855]">
              Recording Your Attendance…
            </h1>
            <p className="text-xs text-muted-foreground">
              Verifying session code{" "}
              <span className="font-mono font-bold text-[#002855]">{code}</span>{" "}
              and redirecting you to your portal.
            </p>
          </div>
        )}

        {phase === "success" && successMeta && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#78be20] text-white">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-xl font-bold text-[#1e6b0a]">
              Checked In!
            </h1>
            <p className="text-sm text-foreground">
              You are counted as attended for{" "}
              <strong className="text-[#002855]">{successMeta.sessionTitle}</strong>.
            </p>
            {successMeta.pointsAwarded > 0 && (
              <p className="font-mono text-sm font-bold text-[#1e6b0a] tabular-nums">
                +{successMeta.pointsAwarded} pts awarded
                {successMeta.isPunctual ? " (Punctual bonus included)" : ""}
              </p>
            )}
            <Link
              href={destinationPath}
              className={buttonVariants({
                className:
                  "w-full gap-2 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
              })}
            >
              <span>Continue to Attendance</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {phase === "already_checked_in" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ebf3f8] text-[#00629b]">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-xl font-bold text-[#002855]">
              Already Checked In
            </h1>
            <p className="text-xs text-muted-foreground">
              {errorMessage ?? "Your attendance for this session is already recorded."}
            </p>
            <Link
              href={destinationPath}
              className={buttonVariants({
                className:
                  "w-full gap-2 bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]",
              })}
            >
              <span>Open My Attendance</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {(phase === "idle" || phase === "error") && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5edf7] text-[#772583]">
                <QrCode className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-3 font-heading text-xl font-bold text-[#002855]">
                Session Check-In
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {phase === "error"
                  ? "If the code rotated while you signed in, enter the current 6-digit code shown on screen."
                  : "Enter the 6-digit code displayed on the projector."}
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs text-[#ba0c2f]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="qr-retry-code"
                  className="block font-heading text-xs font-bold text-[#002855]"
                >
                  6-Digit Check-In Code
                </label>
                <Input
                  id="qr-retry-code"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 847291"
                  className="mt-1.5 h-11 font-mono text-lg font-bold tracking-widest text-[#002855]"
                />
              </div>

              <Button
                type="submit"
                disabled={!code.trim()}
                className="h-11 w-full bg-[#772583] text-xs font-bold text-white hover:bg-[#5a1b63]"
              >
                Check In
              </Button>
            </form>

            <div className="border-t border-border pt-3 text-center">
              <Link
                href={destinationPath}
                className="text-xs font-semibold text-[#00629b] hover:underline"
              >
                Return to your attendance page
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
