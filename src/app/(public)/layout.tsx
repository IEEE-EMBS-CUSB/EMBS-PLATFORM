import { Suspense } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import {
  PublicHeader,
  PublicHeaderFallback,
} from "@/components/layout/public-header";
import { getServerSession } from "@/lib/session-cookie";

async function SessionAwareHeader() {
  const session = await getServerSession();
  return <PublicHeader session={session} />;
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[#772583] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Suspense fallback={<PublicHeaderFallback />}>
        <SessionAwareHeader />
      </Suspense>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
