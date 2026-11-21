import Link from "next/link";
import { EmbsMark } from "@/components/brand/embs-mark";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <EmbsMark compact />

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          <Link href="/leaderboards" className="hover:text-[#002855]">
            Leaderboard
          </Link>
          <Link href="/login" className="hover:text-[#002855]">
            Member portal
          </Link>
          <Link href="/login" className="hover:text-[#002855]">
            Attendee portal
          </Link>
        </nav>
      </div>
    </footer>
  );
}
