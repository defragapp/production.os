import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PageCrown } from "@/components/page-crown";
import { SiteFooter } from "@/components/site-footer";
import { SupportForm } from "./support-form";
import { getEnv } from "@/lib/env";

const description =
  "Get in touch with the Sovereign OS team. Questions about your Baseline, relationships, subscriptions, or the AI itself — we read everything and answer personally.";

export const metadata: Metadata = {
  title: "Support",
  description,
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support · Sovereign OS",
    description,
    url: "/support",
    type: "website",
    images: [{ url: "/opengraph-image?v=6", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
};

// Force dynamic: the page reads the Turnstile site key from the Cloudflare
// bindings. Prerendering it meant a production build had to resolve remote
// bindings just to emit the support page — a build that only succeeded because
// of the local OpenNext dev hook, and one that would hang or fail in any
// hermetic build environment.
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  let turnstileSiteKey: string | undefined;
  try {
    const env = await getEnv();
    turnstileSiteKey = env.TURNSTILE_SITE_KEY;
  } catch {}
  return (
    <>
    <PageShell center={false} wide="wide">
        <div className="relative">
          <div className="hero-light" aria-hidden="true" />
          <div>
            <PageCrown
              align="left"
              eyebrow="Support"
              title="We read everything."
              deck="Questions about your Baseline, a relationship, billing, or the AI itself — send it here. It goes straight to the team, and someone answers personally."
            />
          </div>
        </div>

        {/* Two columns on desktop: the form carries the action, the side
            panel carries the reassurance that used to float under it. */}
        <section className="mt-10 grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-start">
          <div className="glass-panel p-6 md:p-8">
            <SupportForm turnstileSiteKey={turnstileSiteKey} />
          </div>

          <aside className="space-y-4">
            <div className="glass-panel p-6">
              <p className="mb-3 font-display text-lg font-normal tracking-tight text-foreground">
                What happens next
              </p>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li>A person on the team reads it — usually within a day or two.</li>
                <li>The reply goes to the email you gave us, and nowhere else.</li>
                <li>
                  Not a crisis line. If you&apos;re in danger or need urgent care, contact your
                  local emergency services — or, in the US or Canada, call or text
                  {" "}<strong className="text-foreground">988</strong> (Suicide &amp; Crisis Lifeline)
                  or text HOME to <strong className="text-foreground">741741</strong> (Crisis Text Line).
                </li>
              </ul>
            </div>
            <div className="glass-panel p-6">
              <p className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">
                Prefer email?
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Write to{" "}
                <a
                  href="mailto:sovereign@defrag.app"
                  className="text-foreground underline underline-offset-4 transition-colors duration-200 hover:text-foreground/80"
                >
                  sovereign@defrag.app
                </a>{" "}
                directly. Please leave out passwords, card numbers, and other sensitive details.
              </p>
            </div>
            <Link
              href="/faq"
              className="tap-line block text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Looking for a quick answer? Check the FAQ →
            </Link>
          </aside>
        </section>
    </PageShell>
    <SiteFooter />
    </>
  );
}
