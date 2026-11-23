import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmbsMark } from "@/components/brand/embs-mark";
import { LoginForm } from "@/components/auth/login-form";
import { sanitizeNextPath } from "@/lib/checkin-url";
import heroImage from "../../../public/hero.webp";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Whitelist-guarded portal access for IEEE EMBS CUSB members and attendees.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-[#5a1b63] bg-[#772583] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-md">
            <EmbsMark inverted />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#002855] p-4 sm:p-8">
        <Image
          src={heroImage}
          alt="IEEE EMBS Cairo University Student Branch members"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="relative z-10 flex w-full justify-center">
          <LoginForm nextPath={nextPath} />
        </div>
      </main>
    </div>
  );
}
