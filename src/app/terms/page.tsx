import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";

const description = "Terms of Service for Sovereign OS, your private space for understanding yourself and the people around you.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service · Sovereign OS",
    description,
    url: "/terms",
    type: "website",
    images: [{ url: "/opengraph-image?v=6", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
};

export default function TermsPage() {
  return (
    <>
    <PageShell center={false} wide="prose" rule>
        <PageHeader title="Terms of Service" description="Last updated: September 29, 2026" center={false} />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">1. Agreeing to these terms</h2>
            <p>By creating an account or using Sovereign OS (&quot;the Service&quot;), you agree to these Terms of Service. At signup you affirmatively accept the current version of these Terms, and we keep a dated record of that acceptance with your account. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">2. What Sovereign OS does</h2>
            <p>Sovereign OS provides AI-assisted insight and understanding based on your Baseline — computed from your date, time, and place of birth using NASA/JPL planetary data. The Service helps a person reflect on their experiences, relationships, and family dynamics for personal understanding. Outputs are provided for your personal, non-commercial use within the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">3. Who can use it</h2>
            <p>You must be at least 18 years old — and otherwise capable of forming a binding contract with us — to create an account or submit a date, time, and place of birth. We verify this with an age affirmation at signup and an 18-or-older check on every Baseline. If you are under 18, please don&apos;t create an account.</p>
            <p className="mt-2">You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating an account.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">4. Plans and billing</h2>
            <p>The Service offers a free tier and a paid subscription (&quot;Sovereign+&quot;). Paid subscriptions are billed monthly or annually through Stripe. You may cancel at any time; access continues through the end of the paid period.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">5. What you agree not to do</h2>
            <p>You agree not to misuse the Service or attempt to undermine it, including:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Accessing or attempting to access another user&apos;s account, Baseline, conversation, or data without authorization;</li>
              <li><strong className="text-foreground">Scraping our private surfaces.</strong> Automatically collecting any area that requires an account, any other person&apos;s data, or any output of the Engine — by any means, manual or automated. Our public pages (this one, our philosophy, the FAQ, and support) are published for search engines and AI assistants to read and index, and doing so is welcome. Everything behind a session is not.</li>
              <li>Reverse-engineering, decompiling, disassembling, or otherwise attempting to derive the source code, algorithms, prompts, derivation logic, or operation of the Service&apos;s AI engine (&quot;the Engine&quot;);</li>
              <li>Copying, reproducing, redistributing, or building competing or derivative products or services from the Service or its outputs;</li>
              <li>Using Service outputs to train, fine-tune, seed, or otherwise develop any other AI, machine-learning, or predictive system — including using your own conversation history for such purposes;</li>
              <li>Probing or scanning for vulnerabilities, circumventing rate limits or access controls, or using the Service for any unlawful purpose.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">6. Your content, and the license you give us</h2>
            <p>You retain ownership of the information you provide. By providing it, you grant Sovereign OS a limited, non-exclusive license to store, process, and transmit that information solely to operate the Service (including computing your Baseline and delivering AI responses) and to comply with legal obligations. You can download a copy of everything we hold, or delete it, yourself from your <a href="/account" className="underline hover:text-foreground">Account</a> page at any time.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">7. What belongs to Sovereign OS</h2>
            <p>© 2026 Sovereign OS. All rights reserved. The Service — including the Engine, its derivation logic, the Baseline output format, the AI system prompt, its trade dress, and the &quot;Sovereign OS&quot; and &quot;Sovereign+&quot; wordmarks (used as common-law trademarks) and the chalice mark — is licensed to you for your personal use, not sold. Nothing in these Terms grants you any right, title, or license (by implication, estoppel, or otherwise) in the Service or its intellectual property. You may not use the Sovereign OS wordmark or mark to endorse or imply any association without our prior written consent.</p>
            <p className="mt-2">What you bring to a conversation is yours. What the Service generates — its Baseline derivations, its answers, and the method by which it produces them — belongs to Sovereign OS. You may use your transcripts and outputs for your own personal record-keeping, but not to extract, redistribute, or reconstruct the Service itself.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">8. Your feedback</h2>
            <p>If you share suggestions, ideas, or improvements, you grant Sovereign OS a perpetual, irrevocable, worldwide, royalty-free license to use them to operate and improve the Service. You are not entitled to compensation for them.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">9. AI answers, and what they are not</h2>
            <p>Sovereign OS is a self-reflection tool. It is <strong className="text-foreground">not</strong> medical care, mental health treatment, psychotherapy, clinical psychology, psychiatric diagnosis, crisis counseling, or legal or financial advice, and no AI reflection, Baseline synthesis, or relational insight is offered as any of those things. AI-generated content is for informational and reflective purposes only and may contain inaccuracies. Where your Baseline is computed from an approximate birth time, output that depends on precise timing is approximate as well.</p>
            <p className="mt-2"><strong className="text-foreground">Express Release of Liability &amp; Assumption of Risk.</strong> Your use of the Service — including how you interpret or act on any AI reflection, Baseline synthesis, or relational insight — is voluntary and at your own risk. You assume full responsibility for any personal, relational, career, financial, or other life decisions or actions you take in connection with the Service, and you expressly release Sovereign OS and its owner and operators from any liability arising from those interpretations, decisions, or actions. Nothing on the Service creates a therapist-client, clinician-patient, or fiduciary relationship between you and us.</p>
            <p className="mt-2"><strong className="text-foreground">If you are in crisis.</strong> The Service is not equipped for emergencies, and a real human is. In the US or Canada, call or text <strong className="text-foreground">988</strong> (Suicide &amp; Crisis Lifeline); text HOME to <strong className="text-foreground">741741</strong> (Crisis Text Line); the National Domestic Violence Hotline is <strong className="text-foreground">1-800-799-7233</strong>. In immediate danger, call your local emergency number.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">10. No warranties</h2>
            <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">11. Our limit on liability</h2>
            <p>To the maximum extent permitted by law, Sovereign OS shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Where liability cannot be excluded, our total aggregate liability for all claims arising out of or relating to the Service is limited to the amount actually paid by you to Sovereign OS in the three (3) months preceding the event giving rise to the claim — or, for accounts on the free tier, $0 CAD (or, where a nominal monetary floor is required by applicable law, $10 CAD). This limitation applies whether the claim is based on contract, tort, statute, or any other theory.</p>
            <p className="mt-2">The disclaimers in Sections 9 and 10, this Section 11, and Sections 13 and 15 survive termination of your account or of these Terms. We may suspend or terminate an account, and revoke access, for conduct that breaches the rules in Section 5 or endangers the Service or other people.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">12. Copyright claims (DMCA)</h2>
            <p>If you believe material on the Service infringes your copyright, send a notice to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> containing your contact information, identification of the work and the infringing material with a URL, a statement of good faith belief, and a statement under penalty of perjury that the information is accurate and you are authorized to act. We respond to valid takedown requests in accordance with applicable law.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">13. If your use causes a claim</h2>
            <p>You agree to indemnify and hold harmless Sovereign OS and its operators from claims, losses, and costs (including reasonable legal fees) arising from your breach of these Terms, especially the prohibited-conduct provisions in Section 5, or your misuse of the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">14. Changes to these terms</h2>
            <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">15. Governing law and disputes</h2>
            <p>These Terms are governed by the laws of Canada and the Province of Ontario, without regard to conflict-of-law principles. You consent to the exclusive jurisdiction of the courts of Ontario for any dispute arising under these Terms. Nothing in this section limits our right to seek injunctive relief in any jurisdiction to protect our intellectual property or enforce Section 5.</p>
            <p className="mt-2"><strong className="text-foreground">Individual disputes only.</strong> To the fullest extent permitted by applicable law, you and Sovereign OS each agree that any dispute, claim, or proceeding arising out of or relating to the Service or these Terms will be brought and resolved only in your or our individual capacity, and not as a plaintiff or class member in any purported class, collective, consolidated, or representative proceeding. Class-action waivers, class arbitrations, and private-attorney-general actions are prohibited to the extent permitted by law. Nothing in this section waives any non-waivable consumer right you hold under applicable law.</p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-normal tracking-tight text-foreground">16. Contact</h2>
            <p>Questions about these Terms can be directed to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a>.</p>
          </section>
        </div>
        <div className="glass-panel mt-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">Want any of this in plain terms?</p>
            <p className="mt-1 text-xs text-muted-foreground">Reach out and ask — a real person reads every message that comes through support.</p>
          </div>
          <Link href="/support" className="btn-glass shrink-0 px-4 py-2 text-sm font-medium text-foreground">Ask a question</Link>
        </div>
    </PageShell>
    <SiteFooter />
    </>
  );
}