"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, KeyRound, Menu } from "lucide-react";
import { EmbsMark } from "@/components/brand/embs-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isOperationalRole } from "@/lib/auth-helpers";
import type { SessionUser } from "@/types";

interface PublicHeaderProps {
  session: SessionUser | null;
}

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboards", label: "Leaderboard" },
];

export function PublicHeaderFallback() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md">
          <EmbsMark inverted />
        </Link>
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {PUBLIC_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/15 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 gap-2 bg-white px-3.5 text-sm font-semibold text-[#5a1b63] hover:bg-[#f5edf7]"
            )}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Portal access</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicHeader({ session }: PublicHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  let portalHref = "/login";
  if (session) {
    if (session.participantType === "attendee") {
      portalHref = "/attendee";
    } else if (
      session.membershipRole &&
      isOperationalRole(session.membershipRole)
    ) {
      portalHref = "/hr";
    } else {
      portalHref = "/member";
    }
  }

  function isLinkActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith("/leaderboards");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <EmbsMark inverted />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {PUBLIC_LINKS.map((item) => {
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  active
                    ? "bg-white/20 font-semibold text-white"
                    : "text-white/85 hover:bg-white/12 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={portalHref}
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 gap-2 bg-white px-3.5 text-sm font-semibold text-[#5a1b63] hover:bg-[#f5edf7]"
            )}
          >
            {session ? (
              <>
                <span>Open my dashboard</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>Portal access</span>
              </>
            )}
          </Link>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-4">
            <SheetHeader className="p-0 text-left">
              <SheetTitle>
                <EmbsMark compact />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-2">
              {PUBLIC_LINKS.map((item) => {
                const active = isLinkActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-[#f5edf7] font-semibold text-[#5a1b63]"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-4 border-t border-border pt-4">
                <Link
                  href={portalHref}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-11 w-full gap-2 bg-[#772583] font-semibold text-white hover:bg-[#5a1b63]"
                  )}
                >
                  {session ? "Open my dashboard" : "Portal access"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
