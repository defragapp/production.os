import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageTexture } from "@/components/page-texture";
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
      <PageTexture />
      <Nav />
      <main className="relative overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
        <section className="relative overflow-hidden">
          <div className="hero-light" aria-hidden="true" />
          <div className="mx-auto max-w-5xl px-6 pb-14 pt-16 md:pt-20">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Sovereign OS · Support
            </p>
            <h1 className="font-display text-4xl font-normal leading-[1.1] tracking-tight text-foreground md:text-5xl">
              We read everything.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Questions about your Baseline, a relationship, billing, or the AI itself — send it
              here. It goes straight to the team, and someone answers personally.
            </p>
          </div>
        </section>

        {/* Two columns on desktop: the form carries the action, the side
            panel carries the reassurance that used to float under it. */}
        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 md:grid-cols-[1.2fr_0.8fr] md:items-start">
          <div className="glass-panel p-6 md:p-8">
            <SupportForm turnstileSiteKey={turnstileSiteKey} />
          </div>

          <aside className="space-y-4">
            <div className="glass-panel p-6">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                What happens next
              </p>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li>A person on the team reads it — usually within a day or two.</li>
                <li>The reply goes to the email you gave us, and nowhere else.</li>
                <li>
                  Not a crisis line. If you&apos;re in danger or need urgent care, contact your
                  local emergency services.
                </li>
              </ul>
            </div>
            <div className="glass-panel p-6">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Prefer email?
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Write to <span className="text-foreground">sovereign@defrag.app</span> directly.
                Please leave out passwords, card numbers, and other sensitive details.
              </p>
            </div>
            <Link
              href="/faq"
              className="block text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Looking for a quick answer? Check the FAQ →
            </Link>
          </aside>
        </section>
      </main>
    </>
  );
}
