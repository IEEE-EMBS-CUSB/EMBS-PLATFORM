"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navigateHard } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface PrototypeKeyHint {
  label: string;
  role: string;
  key: string;
}

const PROTOTYPE_DEMO_KEYS: readonly PrototypeKeyHint[] = [
  {
    label: "Salma El-Sayed",
    role: "Member (AI & ML)",
    key: "EMBS-MEM-2026-SALMA",
  },
  {
    label: "Omar Tarek",
    role: "Member (Robotics)",
    key: "EMBS-MEM-2026-OMAR",
  },
  {
    label: "Mariam Hesham",
    role: "Attendee",
    key: "EMBS-ATT-2026-MARIAM",
  },
  {
    label: "Revoked Key",
    role: "Revoked test",
    key: "EMBS-MEM-2026-REVOKED",
  },
];

interface SessionPostResponse {
  ok: boolean;
  redirectTo?: "/member" | "/attendee";
  message?: string;
  user?: {
    fullName?: string;
    participantType?: "member" | "attendee";
  };
}

export function AccessKeyForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [accessKey, setAccessKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeCount, setShakeCount] = useState(0);
  const [filledDemoKey, setFilledDemoKey] = useState<string | null>(null);

  useEffect(() => {
    const resetOnPageShow = () => {
      inFlightRef.current = false;
      setIsSubmitting(false);
      setWelcomeName(null);
    };
    window.addEventListener("pageshow", resetOnPageShow);
    return () => window.removeEventListener("pageshow", resetOnPageShow);
  }, []);

  function triggerError(message: string) {
    inFlightRef.current = false;
    setErrorMessage(message);
    setShakeCount((count) => count + 1);
    setIsSubmitting(false);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || welcomeName !== null) return;

    setErrorMessage(null);

    if (!accessKey.trim()) {
      triggerError("Enter your access key to continue.");
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });

      let payload: SessionPostResponse | null = null;
      try {
        payload = (await response.json()) as SessionPostResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.ok || !payload.redirectTo) {
        if (response.status >= 500) {
          triggerError("Verification service error. Try again shortly.");
          return;
        }
        triggerError(
          payload?.message ?? "Access key not recognized. Check for typos or contact HR."
        );
        return;
      }

      const firstName = payload.user?.fullName?.split(" ")[0] ?? null;
      setWelcomeName(firstName ?? "back");
      setAccessKey("");
      navigateHard(payload.redirectTo);
    } catch {
      triggerError("Connection failed. Check your network and try again.");
    }
  }

  const isVerified = welcomeName !== null;

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label
            htmlFor="portal-access-key"
            className="block text-sm font-semibold text-foreground"
          >
            Access key
          </label>
          <div
            key={shakeCount}
            className={cn("relative", shakeCount > 0 && "embs-shake")}
          >
            <KeyRound
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              id="portal-access-key"
              name="accessKey"
              type={showKey ? "text" : "password"}
              maxLength={128}
              value={accessKey}
              onChange={(event) => {
                setAccessKey(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter access key"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={isSubmitting || isVerified}
              aria-invalid={errorMessage ? "true" : "false"}
              className="h-12 bg-white pr-12 pl-10 font-mono text-base tracking-wide sm:h-11 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={showKey ? "Hide access key" : "Show access key"}
              disabled={isSubmitting || isVerified}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Access key not accepted</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {isVerified && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-[#78be20]/40 bg-[#eaf5dd] px-3.5 py-2.5 text-sm font-semibold text-[#2f600b]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Welcome, {welcomeName}. Opening your dashboard...</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || isVerified}
          aria-busy={isSubmitting}
          className="h-11 w-full bg-[#772583] font-semibold text-white transition-transform hover:bg-[#5a1b63] active:scale-[0.99]"
        >
          {isVerified ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Verified
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <details className="group rounded-lg border border-border bg-muted/40 px-3.5 py-2 text-xs">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <span>Demo keys</span>
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-2 space-y-1 border-t border-border/80 pt-2">
          {PROTOTYPE_DEMO_KEYS.map((item) => {
            const wasFilled = filledDemoKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setAccessKey(item.key);
                  setErrorMessage(null);
                  setFilledDemoKey(item.key);
                  inputRef.current?.focus();
                }}
                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white active:bg-white"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="ml-1.5 text-muted-foreground">
                    {item.role}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[#00629b]">
                  {wasFilled && (
                    <Check
                      className="h-3 w-3 text-[#2f600b]"
                      aria-hidden="true"
                    />
                  )}
                  {item.key}
                </span>
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
