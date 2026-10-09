import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";

const description = "How Sovereign OS collects, uses, and protects your data.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · Sovereign OS",
    description,
    url: "/privacy",
    type: "website",
    images: [{ url: "/opengraph-image?v=6", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
};

export default function PrivacyPage() {
  return (
    <>
    <PageShell center={false} wide="prose" rule>
        <PageHeader title="Privacy Policy" description="Last updated: September 29, 2026" center={false} />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">1. What we collect</h2><p>When you create an account, we collect your email address and a password — which we store only as an irreversible encrypted value, never as plain text. To compute your Baseline, we collect your date, time, and place of birth. We also store your chat threads and subscription status.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">2. How we use it</h2><p>Your birth data is used for one thing only: computing your Baseline with the NASA/JPL Horizons API. Your chat history exists to keep your conversations available to you. Your email is used for account verification, password resets, and receipts.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">3. Who sees your data</h2><p>We do not sell your personal data. It reaches only the providers needed to run the Service:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-foreground">Cloudflare</strong> — hosting, and the database and key-value storage your account lives in.</li>
              <li><strong className="text-foreground">Cloudflare Workers AI</strong> — the model that writes your answers. When you send a message, the text you wrote, a plain-language summary of your Baseline, and a summary of any connection who has agreed to be included are sent to this model to produce the reply. It is used to generate that one answer.</li>
              <li><strong className="text-foreground">Stripe</strong> — payments and subscription billing.</li>
              <li><strong className="text-foreground">Resend</strong> — transactional email (verification, receipts, support replies).</li>
              <li><strong className="text-foreground">NASA/JPL Horizons</strong> — the planetary positions used to compute your Baseline. Only the date, time, and place are used to ask for them, and nothing about you is stored there.</li>
            </ul>
            <p className="mt-2">Your data — including your conversations, Baseline, and birth information — is never used to train, fine-tune, or otherwise feed any third-party AI system, and we never allow a provider to use it for their own purposes. We also actively block automated scraping of the Service (see our <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>).</p>
          </section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">4. Where it lives, and how it&apos;s protected</h2><p>Your account, Baseline, and conversations live in Cloudflare&apos;s D1 database and KV storage, encrypted in transit and at rest. Passwords are stored only as a salted, one-way hash (PBKDF2, 100,000 iterations) — nobody, including us, can read them back. Sign-in sessions use signed cookies that web pages can&apos;t read, and signing out or resetting your password cancels every other signed-in session on your account.</p>
            <p className="mt-2">Beyond your account records, we keep a small amount of short-lived operational data in KV storage: a counter of how many answers you&apos;ve used today, throttling records keyed by a one-way hash of your IP address and, for sign-in attempts, the email address you typed (kept for up to an hour), and markers that stop duplicate payment emails from being sent (kept for up to 30 days). None of it is used to profile you and all of it expires on its own.</p>
            <p className="mt-2"><strong className="text-foreground">Server or device-only.</strong> By default your conversations are stored on our servers, so you can pick a thread up on your phone and finish it on your laptop. If you would rather your conversations never reach us at all, you can switch your account to device-only mode in Settings: your history is then encrypted on your own device with a key that never leaves it, and answers are generated and returned without being stored. In that mode, history does not follow you between devices — that is the trade. You can switch back at any time, and you can export everything first.</p>
            <p className="mt-2"><strong className="text-foreground">On your own device.</strong> A few things live only in your browser, and never on our servers:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-foreground">Your unsent message.</strong> A chat draft you typed but didn&apos;t send is kept in your browser&apos;s <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code> (under <code className="rounded bg-muted px-1 py-0.5 text-xs">sovereign-chat-draft:&lt;your account&gt;</code>) so it survives an accidental reload, and is cleared the moment you send.</li>
              <li><strong className="text-foreground">Install-prompt state.</strong> If you dismiss the &ldquo;add to home screen&rdquo; suggestion, that choice is remembered in <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code> (<code className="rounded bg-muted px-1 py-0.5 text-xs">sovereign-install-dismissed</code>) so we never ask again.</li>
              <li><strong className="text-foreground">The device-only vault.</strong> If you choose device-only memory, your encrypted conversation history lives in your browser&apos;s <code className="rounded bg-muted px-1 py-0.5 text-xs">IndexedDB</code> database (<code className="rounded bg-muted px-1 py-0.5 text-xs">sovereign-memory</code>) as AES-GCM ciphertext, with the key held only on your device — we could not read it even if we wanted to.</li>
            </ul>
          </section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">5. Your rights</h2><p>Everything you can ask us for, you can do yourself, without asking: view, correct, export, and delete your data, all on your <a href="/account" className="underline hover:text-foreground">Account</a> page. To update your email address, or for any privacy request you&apos;d rather make by hand, write to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a>:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-foreground">See it.</strong> &ldquo;Download my data&rdquo; on your Account page gives you one file with your Baseline, every conversation, your connections, and the invitations you&apos;ve sent.</li>
              <li><strong className="text-foreground">Delete it.</strong> Deleting your account removes your Baseline, conversations, connections, invitations, passkeys, subscription, per-day usage counters, journey events, and the semantic-recall embeddings your chat history produced in Cloudflare Vectorize — immediately. There is no undo, and no copy is kept for recovery.</li>
            </ul>
            <p className="mt-2">Two things survive a deletion, and we would rather say so than let you assume otherwise: payment records (invoices and receipts) are held by Stripe, as our payment processor and as required for tax and accounting; and if you invited someone, their side of that connection stays on their own account, showing your name and role and no other detail. Short-lived operational records also expire on the schedule in section 4.</p>
          </section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">6. Cookies, storage, analytics, and email</h2><p>We use one first-party cookie: it keeps you signed in, can&apos;t be read by other websites, and expires after 7 days. Beyond that, two vendor domains may set their own security or checkout cookies when you actually meet their surfaces: <strong className="text-foreground">Cloudflare Turnstile</strong> (<code className="rounded bg-muted px-1 py-0.5 text-xs">challenges.cloudflare.com</code>, on account creation) and <strong className="text-foreground">Stripe</strong> (<code className="rounded bg-muted px-1 py-0.5 text-xs">checkout.stripe.com</code>, during checkout). We do not use advertising or third-party tracking cookies, and we do not build profiles or follow you across the web. What your own browser keeps locally is listed in section 4.</p>
            <p className="mt-2">We do use two unobtrusive forms of measurement, so you know about them:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-foreground">Cloudflare Web Analytics</strong> — aggregate page views only. It sets no cookies and does not identify you.</li>
              <li><strong className="text-foreground">Email measurement</strong> — our email provider records whether a message was opened and which links were clicked. This applies to account and billing emails, and it exists to confirm delivery. If you would rather it were off, tell us and we will turn it off for your account.</li>
            </ul>
            <p className="mt-2">Because the only cookies the Service itself sets are strictly necessary for authentication, and the third-party cookies above fire only when you interact with Turnstile or Stripe on their own surfaces, we do not display a cookie-consent banner. There is nothing optional to consent to. If we ever add a non-essential cookie (a preference or a marketing tag), a consent banner will appear first.</p>
            <p className="mt-2">When the Terms or Privacy Policy changes materially, we version them and ask every existing account to re-affirm on the next visit. Your stored affirmation is a version string and a timestamp, never the text itself.</p>
          </section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">7. How long we keep things</h2><p>Your account, Baseline, conversations, and connections are kept until you delete them — from your Account page or by deleting your account, which removes the rows immediately and completely. Short-lived operational records expire on their own: rate-limit and throttling counters within an hour, email-delivery markers within 30 days, unused invitation and reset tokens when their link lapses. Payment records (invoices and receipts) are retained by Stripe for as long as tax and accounting law requires. Nothing else is kept &ldquo;just in case.&rdquo;</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">8. International transfers</h2><p>Sovereign OS is operated from Canada, but the Service runs on infrastructure located in the United States and worldwide: Cloudflare (hosting, database, AI), Stripe (payments, in the US), Resend (email), and NASA/JPL (planetary position lookups). Your personal data is therefore processed and stored outside your country, including in the United States, under the safeguards these providers publish. We send only what each provider needs to do its job, and nothing about you is retained by NASA/JPL.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">9. CCPA / CPRA notice (California)</h2><p>We do not sell or share your personal information as those terms are defined by the CCPA/CPRA, and we never have. The categories we collect — identifiers, commercial information, and the personal information described in Cal. Civ. Code § 1798.80(e) that you give us for your Baseline — are used only as disclosed in sections 1–4. You have the right to access, delete, and correct, and to exercise both through your Account page without contacting us. Exercising any of these rights will never cost you a lower service level or price.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">10. Complaints to a regulator</h2><p>If you are in Canada and feel we have mishandled your personal information, you may complain to the Office of the Privacy Commissioner of Canada (privacycommissioner.gc.ca); under the GDPR or a comparable law, to your local supervisory authority. We would rather hear from you first — write to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> and a real person will read it.</p></section>
          <section id="security"><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">11. Responsible disclosure</h2><p>Found a security issue? Tell us privately at <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> (our <a href="/.well-known/security.txt" className="underline hover:text-foreground">security.txt</a> carries the same address) before disclosing it publicly, and we&apos;ll work to fix it fast. Please don&apos;t probe other people&apos;s accounts or data — that is the one thing the Service never tolerates.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">12. Children&apos;s privacy</h2><p>The Service is not directed to individuals under 18, and creating an account requires an affirmation that you are at least 18 (see our <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>). We do not knowingly collect personal information from minors.</p></section>
          <section><h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">13. Contact</h2><p>Questions about this policy can go to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> or our <a href="/support" className="underline hover:text-foreground">support page</a>.</p></section>
        </div>
        <div className="glass-panel mt-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">Something unclear?</p>
            <p className="mt-1 text-xs text-muted-foreground">A real person reads every message that comes through support.</p>
          </div>
          <Link href="/support" className="btn-glass shrink-0 px-4 py-2 text-sm font-medium text-foreground">Ask a question</Link>
        </div>
    </PageShell>
    <SiteFooter />
    </>
  );
}
