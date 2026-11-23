"use client";

export default function RootGlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6 text-[#002855]">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#002855]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            An unexpected error interrupted loading the IEEE EMBS CUSB Portal.
            Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#772583] px-4 text-sm font-semibold text-white hover:bg-[#5a1b63]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
