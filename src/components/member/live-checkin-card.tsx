"use client";

import { useState } from "react";
import { CheckCircle2, QrCode, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { memberCheckinAction } from "@/app/hr/attendance/actions";

interface CheckinResult {
  ok: boolean;
  pointsAwarded?: number;
  isPunctual?: boolean;
  sessionTitle?: string;
  error?: string;
}

interface LiveCheckinCardProps {
  membershipId: string;
  onCheckin?: (code: string, membershipId: string) => Promise<CheckinResult>;
}

export function LiveCheckinCard({
  membershipId,
  onCheckin,
}: LiveCheckinCardProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    pointsAwarded: number;
    isPunctual: boolean;
    sessionTitle: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      let res: CheckinResult;
      if (onCheckin) {
        res = await onCheckin(cleanCode, membershipId);
      } else {
        res = await memberCheckinAction(cleanCode, membershipId);
      }

      if (res.ok) {
        setSuccessInfo({
          pointsAwarded: res.pointsAwarded ?? 10,
          isPunctual: res.isPunctual ?? true,
          sessionTitle: res.sessionTitle ?? "Meeting Session",
        });
        setCode("");
      } else {
        setErrorMessage(res.error || "Failed to log check-in.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setErrorMessage(
        msg && !/minified react error|server components render/i.test(msg)
          ? msg
          : "Unable to submit check-in code right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border bg-white shadow-xs">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#772583]" aria-hidden="true" />
            <CardTitle className="font-heading text-lg font-bold text-[#002855]">
              Live Session Check-In
            </CardTitle>
          </div>
          <span className="font-mono text-xs font-semibold text-[#00629b]">
            Code Check-In
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the 6-digit session code projected during your meeting or workshop.
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        {successInfo ? (
          <div className="rounded-xl border border-[#78be20]/40 bg-[#78be20]/10 p-4 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#78be20] text-white">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-2 font-heading text-base font-bold text-[#1e6b0a]">
              Checked in to {successInfo.sessionTitle}!
            </h3>
            <p className="mt-1 font-mono text-sm font-extrabold text-[#1e6b0a] tabular-nums">
              +{successInfo.pointsAwarded} pts awarded
              {successInfo.isPunctual ? " (Punctual bonus included)" : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuccessInfo(null)}
              className="mt-3 h-8 text-xs font-semibold"
            >
              Check in to another session
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg bg-[#ba0c2f]/10 px-3 py-2 text-xs font-semibold text-[#ba0c2f]"
              >
                {errorMessage}
              </div>
            )}

            <div>
              <label
                htmlFor="checkin-code-input"
                className="block font-heading text-xs font-bold text-[#002855]"
              >
                Enter 6-digit Check-in Code
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="checkin-code-input"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  placeholder="e.g. 847291"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-11 min-w-0 flex-1 font-mono text-lg font-bold tracking-widest text-[#002855] placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  disabled={isSubmitting || !code.trim()}
                  className="h-11 shrink-0 gap-2 bg-[#772583] px-5 text-xs font-bold text-white hover:bg-[#5a1b63]"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  <span>{isSubmitting ? "Checking in..." : "Check In"}</span>
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
