"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sovereign] route error:", error);
  }, [error]);

  return (
    <main className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="mb-4 text-4xl font-medium text-foreground md:text-5xl">
        A pattern broke.
      </h1>
      <p className="mb-10 text-lg text-muted-foreground">
        An unexpected error occurred. Try again — if it persists, the issue has been noted.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-8 py-3 font-medium text-primary-foreground transition-all duration-[240ms] hover:-translate-y-[2px] hover:bg-neutral-200"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border bg-white/10 px-8 py-3 font-medium text-foreground transition-all duration-[240ms] hover:-translate-y-[2px] hover:bg-white/20"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
