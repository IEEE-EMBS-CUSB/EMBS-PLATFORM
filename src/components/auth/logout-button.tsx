"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigateHard } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  variant?: "outline" | "ghost" | "secondary";
  size?: "default" | "sm";
  className?: string;
}

export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const resetOnPageShow = () => setIsLoggingOut(false);
    window.addEventListener("pageshow", resetOnPageShow);
    return () => window.removeEventListener("pageshow", resetOnPageShow);
  }, []);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      // Fall through to access screen even if offline
    } finally {
      navigateHard("/access");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-busy={isLoggingOut}
      className={cn("gap-2", className)}
    >
      {isLoggingOut ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{isLoggingOut ? "Signing out..." : "Log out"}</span>
    </Button>
  );
}
