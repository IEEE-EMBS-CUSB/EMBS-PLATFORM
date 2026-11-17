import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccessKeyForm } from "@/components/auth/access-key-form";
import { EmbsMark } from "@/components/brand/embs-mark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccessPageShellProps {
  heading: string;
}

export function AccessPageShell({ heading }: AccessPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <EmbsMark inverted />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/12 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6"
      >
        <Card className="border-border bg-card shadow-[0_10px_28px_-16px_rgba(0,40,85,0.12)]">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-2xl font-bold text-[#002855]">
              {heading}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <AccessKeyForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
