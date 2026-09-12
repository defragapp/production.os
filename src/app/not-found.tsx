import Link from "next/link";
import { Nav } from "@/components/nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          404 — Page not found
        </p>
        <h1 className="mb-4 text-4xl font-medium text-foreground md:text-5xl">
          Nothing is here — yet.
        </h1>
        <p className="mb-10 text-lg text-muted-foreground">
          The pattern you&apos;re looking for doesn&apos;t exist on this server.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-md bg-primary px-8 py-3 font-medium text-primary-foreground transition-all duration-[240ms] hover:-translate-y-[2px] hover:bg-neutral-200"
          >
            Back to Home
          </Link>
          <Link
            href="/onboard?mode=login"
            className="rounded-md border border-border bg-white/10 px-8 py-3 font-medium text-foreground transition-all duration-[240ms] hover:-translate-y-[2px] hover:bg-white/20"
          >
            Sign In
          </Link>
        </div>
      </main>
    </>
  );
}
