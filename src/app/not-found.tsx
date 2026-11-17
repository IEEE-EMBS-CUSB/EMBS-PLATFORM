import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmbsMark } from "@/components/brand/embs-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-[#5a1b63] bg-[#772583]">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="rounded-md">
            <EmbsMark inverted />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-heading text-3xl font-bold text-[#002855]">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page or committee leaderboard you requested does not exist or has
          not been published yet.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className={cn(
              buttonVariants({ size: "default" }),
              "h-10 gap-2 bg-[#772583] px-4 font-semibold text-white hover:bg-[#5a1b63]"
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Return home
          </Link>
          <Link
            href="/leaderboards"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "h-10 px-4 font-semibold text-[#002855]"
            )}
          >
            Leaderboard
          </Link>
        </div>
      </main>
    </div>
  );
}
