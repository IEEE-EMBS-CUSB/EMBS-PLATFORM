import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmbsMark } from "@/components/brand/embs-mark";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login · IEEE EMBS CUSB Portal",
  description: "Whitelist-guarded portal access for IEEE EMBS CUSB members and attendees.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <header className="border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-md">
            <EmbsMark inverted />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <LoginForm />
      </main>
    </div>
  );
}
