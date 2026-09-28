import Link from "next/link";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main
        id="main"
        className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6 py-24"
      >
        <div className="hero-light" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl text-center">
          {/* Lit emblem medallion — the same brand bookend used on the landing's
              closing beat, so even a 404 feels like Sovereign OS. */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
            <Logo showWordmark={false} href="#" markClassName="h-8 w-auto" />
          </div>
          <Eyebrow className="mb-3">404 — Page not found</Eyebrow>
          <h1 className="mb-4 font-display text-4xl font-normal tracking-tight text-foreground md:text-5xl">
            Nothing is here — yet.
          </h1>
          <p className="mb-10 text-lg text-muted-foreground">
            The page you were looking for has moved, or was never here.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="btn-aurora px-8 py-3 text-center text-sm font-medium">
              Back to home
            </Link>
            <Link
              href="/onboard?mode=login"
              className="btn-glass px-8 py-3 text-center text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
