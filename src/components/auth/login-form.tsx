"use client";

import { useState } from "react";
import { AlertCircle, KeyRound, Lock, Mail, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  loginWithPasswordAction,
  changePasswordOnFirstLoginAction,
} from "@/app/login/actions";
import { parseLoginIdentifier } from "@/lib/phone";

export interface LoginFormProps {
  nextPath?: string | null;
  onLogin?: (
    email: string,
    password: string,
    nextPath?: string | null
  ) => Promise<{
    ok: boolean;
    mustChangePassword?: boolean;
    redirectTo?: string;
    error?: string;
  }>;
  onChangePassword?: (
    email: string,
    currentPassword: string,
    newPassword: string,
    nextPath?: string | null
  ) => Promise<{
    ok: boolean;
    redirectTo?: string;
    error?: string;
  }>;
}

function toFriendlyAuthError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (
      /minified react error/i.test(msg) ||
      /server components render/i.test(msg) ||
      /digest/i.test(msg)
    ) {
      return fallback;
    }
    if (msg.trim().length > 0) {
      return msg;
    }
  }
  return fallback;
}

export function LoginForm({
  nextPath = null,
  onLogin,
  onChangePassword,
}: LoginFormProps) {
  const isCheckinFlow = Boolean(nextPath && nextPath.startsWith("/checkin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "first_login_change">(
    "credentials"
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseLoginIdentifier(email)) {
      setErrorMessage(
        "Please enter a valid chapter email address or phone number."
      );
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = onLogin
        ? nextPath
          ? await onLogin(email.trim(), password, nextPath)
          : await onLogin(email.trim(), password)
        : await loginWithPasswordAction(email.trim(), password, nextPath);

      if (!res.ok) {
        setErrorMessage(res.error ?? "Invalid email or password.");
        return;
      }

      if (res.mustChangePassword) {
        setStep("first_login_change");
        return;
      }

      if (res.redirectTo) {
        window.location.href = res.redirectTo;
      }
    } catch (err: unknown) {
      setErrorMessage(
        toFriendlyAuthError(
          err,
          "Unable to complete sign-in right now. Please try again or contact your chapter administrator."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-type your new password.");
      return;
    }

    if (newPassword === password) {
      setErrorMessage("New password must be different from your temporary password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = onChangePassword
        ? nextPath
          ? await onChangePassword(email.trim(), password, newPassword, nextPath)
          : await onChangePassword(email.trim(), password, newPassword)
        : await changePasswordOnFirstLoginAction(
            email.trim(),
            password,
            newPassword,
            nextPath
          );

      if (!res.ok) {
        setErrorMessage(res.error ?? "Unable to update password.");
        return;
      }

      if (res.redirectTo) {
        window.location.href = res.redirectTo;
      }
    } catch (err: unknown) {
      setErrorMessage(
        toFriendlyAuthError(
          err,
          "Unable to complete password setup right now. Please try signing in again or contact your chapter administrator."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border bg-white shadow-md">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5edf7] text-[#772583]">
            {step === "credentials" ? (
              <KeyRound className="h-6 w-6" />
            ) : (
              <ShieldCheck className="h-6 w-6" />
            )}
          </div>
          <h1 className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-[#002855]">
            {step === "credentials"
              ? "Sign In to Chapter Portal"
              : "First Time Sign-In"}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {step === "credentials"
              ? "Sign in with your chapter email or phone number and password."
              : "Welcome to IEEE EMBS CUSB! Please choose your permanent password to complete your account activation."}
          </p>
        </div>

        {isCheckinFlow && (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#00629b]/25 bg-[#ebf3f8] p-3 text-xs text-[#002855]">
            <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[#00629b]" aria-hidden="true" />
            <span className="leading-snug font-medium">
              Sign in to record your attendance for the session you scanned.
            </span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#ba0c2f]/30 bg-[#ba0c2f]/10 p-3 text-xs text-[#ba0c2f]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ba0c2f]" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        <div className="mt-6">
          {step === "credentials" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="emailAddress"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Email Address or Phone Number
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="emailAddress"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com or 01012345678"
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                {loading ? "Verifying..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={handleSetNewPassword}
              className="space-y-4 animate-in fade-in"
            >
              <div className="rounded-lg bg-[#f0f6fa] p-3 text-xs text-[#002855]">
                Account: <span className="font-bold">{email}</span>. Setting
                your permanent credentials.
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  New Permanent Password
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Confirm New Password
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-[#772583] text-xs font-semibold text-white hover:bg-[#5a1b63]"
              >
                {loading ? "Saving..." : "Save Password & Enter Portal"}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          Need access or forgot your password? Contact your HR team or Master Administrator.
        </div>
      </CardContent>
    </Card>
  );
}
