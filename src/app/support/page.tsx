import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { SupportForm } from "./support-form";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Support — Sovereign OS",
  description:
    "Get in touch with the Sovereign team. Questions about your Baseline, relationships, subscriptions, or the AI itself — we read everything and answer personally.",
};

export default async function SupportPage() {
  let turnstileSiteKey: string | undefined;
  try {
    const env = await getEnv();
    turnstileSiteKey = env.TURNSTILE_SITE_KEY;
  } catch {}
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />

        <section className="mx-auto max-w-lg px-6 pb-16 pt-16 md:pt-24">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Sovereign OS · Support
          </p>
          <h1 className="font-display text-4xl font-normal leading-[1.1] tracking-tight text-foreground md:text-5xl">
            We read everything.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Questions about your Baseline, a relationship, billing, or the AI itself — send it here.
            It goes straight to the team, and someone answers personally.
          </p>

          <div className="mt-10">
            <SupportForm turnstileSiteKey={turnstileSiteKey} />
          </div>

          <div className="mt-10 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Prefer email? You can write to{" "}
              <span className="text-foreground">sovereign@defrag.app</span> directly.
            </p>
            <p>
              Please don&apos;t include passwords, payment card numbers, or other sensitive details in
              support messages.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}