import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";

export const metadata: Metadata = {
  title: "Privacy Policy — Sovereign OS",
  description: "How Sovereign OS collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-14">
        <div className="section-rule absolute inset-x-0 top-0" aria-hidden="true" />
        <PageHeader title="Privacy Policy" description="Last updated: September 23, 2026" center={false} />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">1. What we collect</h2><p>When you create an account, we collect your email address and a password — which we store only as an irreversible encrypted value, never as plain text. To compute your Baseline, we collect your date, time, and place of birth. We also store your chat threads and subscription status.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">2. How we use it</h2><p>Your birth data is used for one thing only: computing your Baseline with the NASA/JPL Horizons API. Your chat history exists to keep your conversations available to you. Your email is used for account verification, password resets, and receipts.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">3. Who sees your data</h2><p>We do not sell your personal data. It reaches only the providers needed to run the Service: Stripe (payments), Resend (transactional email), and NASA/JPL Horizons (planetary positions). Your data — including your conversations, Baseline, and birth information — is never used to train, fine-tune, or feed any third-party AI system, and we actively block automated scraping of the Service (see our <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>).</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">4. Where it lives, and how it&apos;s protected</h2><p>Your data lives in Cloudflare&apos;s D1 database and KV storage, encrypted both in transit and at rest. Passwords are hashed with PBKDF2 (100,000 iterations), so nobody — including us — can read them back. Sign-in sessions use secure, signed cookies that web pages can&apos;t read.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">5. Your rights</h2><p>You can ask to see, correct, or delete your personal data at any time — just contact us. Deleting your account removes everything with it.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">6. Cookies</h2><p>We use one cookie: it keeps you signed in, can&apos;t be read by other websites, and expires after 7 days. We do not use third-party tracking cookies.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">7. Children&apos;s privacy</h2><p>The Service is not directed to individuals under 18. We do not knowingly collect personal information from minors.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">8. Contact</h2><p>Questions about this policy can go to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> or our <a href="/support" className="underline hover:text-foreground">support page</a>.</p></section>
        </div>
        <div className="glass-panel mt-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">Something here unclear?</p>
            <p className="mt-1 text-xs text-muted-foreground">A real person reads every message that comes through support.</p>
          </div>
          <Link href="/support" className="btn-glass shrink-0 px-4 py-2 text-sm font-medium text-foreground">Ask a question</Link>
        </div>
      </main>
    </>
  );
}
