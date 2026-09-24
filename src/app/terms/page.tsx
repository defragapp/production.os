import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Terms of Service — Sovereign OS",
  description: "Terms of Service for Sovereign OS, your personal intelligence layer.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <PageHeader title="Terms of Service" description="Last updated: September 23, 2026" center={false} />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By creating an account or using Sovereign OS (&quot;the Service&quot;), you agree to these Terms of Service. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">2. The Service</h2>
            <p>Sovereign OS provides AI-assisted insight and pattern awareness based on your baseline — computed from your date, time, and place of birth using NASA/JPL planetary data. The Service helps a person reflect on their experiences, relationships, and family patterns for personal understanding. Outputs are provided for your personal, non-commercial use within the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">3. Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating an account.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">4. Subscriptions &amp; Billing</h2>
            <p>The Service offers a free tier and a paid subscription (&quot;Sovereign+&quot;). Paid subscriptions are billed monthly or annually through Stripe. You may cancel at any time; access continues through the end of the paid period.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">5. Prohibited Conduct</h2>
            <p>You agree not to misuse the Service or attempt to undermine it, including:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Accessing or attempting to access another user&apos;s account, baseline, conversation, or data without authorization;</li>
              <li>Scraping, crawling, spidering, harvesting, or automatically collecting the Service, its pages, its outputs, or its data by any means, whether manual or automated;</li>
              <li>Reverse-engineering, decompiling, disassembling, or otherwise attempting to derive the source code, algorithms, prompts, derivation logic, or operation of the Service&apos;s AI engine (&quot;the Engine&quot;);</li>
              <li>Copying, reproducing, redistributing, or building competing or derivative products or services from the Service or its outputs;</li>
              <li>Using Service outputs to train, fine-tune, seed, or otherwise develop any other AI, machine-learning, or predictive system — including using your own conversation history for such purposes;</li>
              <li>Probing or scanning for vulnerabilities, circumventing rate limits or access controls, or using the Service for any unlawful purpose.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">6. Your Content &amp; Limited License</h2>
            <p>You retain ownership of the information you provide. By providing it, you grant Sovereign OS a limited, non-exclusive license to store, process, and transmit that information solely to operate the Service (including computing your Baseline and delivering AI responses) and to comply with legal obligations. You may request deletion of your data at any time through your account or <a href="/support" className="underline hover:text-foreground">Support</a>.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">7. Intellectual Property</h2>
            <p>© 2026 Sovereign OS. All rights reserved. The Service — including the Engine, its derivation logic, the Baseline output format, the AI system prompt, its trade dress, and the &quot;Sovereign OS&quot; and &quot;Sovereign+&quot; wordmarks (used as common-law trademarks) and chalice mark — is licensed to you for your personal use, not sold. Nothing in these Terms grants you any right, title, or license (by implication, estoppel, or otherwise) in the Service or its intellectual property. You may not use the Sovereign OS wordmark or mark to endorse or imply any association without our prior written consent.</p>
            <p className="mt-2">What you bring to a conversation is yours. What the Service generates — its Baseline derivations, its reads, and the method by which it produces them — belongs to Sovereign OS. You may use your transcripts and outputs for your own personal record-keeping, but not to extract, redistribute, or reconstruct the Service itself.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">8. Feedback</h2>
            <p>If you share suggestions, ideas, or improvements, you grant Sovereign OS a perpetual, irrevocable, worldwide, royalty-free license to use them to operate and improve the Service. You are not entitled to compensation for them.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">9. AI Outputs &amp; No Reliance</h2>
            <p>AI-generated content is for informational and reflective purposes only and is not professional, medical, legal, financial, or psychological advice. It may contain inaccuracies, and it is not a substitute for qualified professional care, including in any crisis or safety situation. Where your Baseline is computed from an approximate birth time, output that depends on precise timing is approximate as well.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">10. Disclaimer of Warranties</h2>
            <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">11. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Sovereign OS shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Where liability cannot be excluded, it is limited to the amount paid by you in the three months preceding the claim or $100, whichever is greater.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">12. Infringement Notices (DMCA)</h2>
            <p>If you believe material on the Service infringes your copyright, send a notice to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a> containing your contact information, identification of the work and the infringing material with a URL, a statement of good faith belief, and a statement under penalty of perjury that the information is accurate and you are authorized to act. We respond to valid takedown requests in accordance with applicable law.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">13. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Sovereign OS and its operators from claims, losses, and costs (including reasonable legal fees) arising from your breach of these Terms, especially the prohibited-conduct provisions in Section 5, or your misuse of the Service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">14. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">15. Governing Law &amp; Disputes</h2>
            <p>These Terms are governed by the laws of Canada and the Province of Ontario, without regard to conflict-of-law principles. You consent to the exclusive jurisdiction of the courts of Ontario for any dispute arising under these Terms. Nothing in this section limits our right to seek injunctive relief in any jurisdiction to protect our intellectual property or enforce Section 5.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">16. Contact</h2>
            <p>Questions about these Terms can be directed to <a href="mailto:sovereign@defrag.app" className="underline hover:text-foreground">sovereign@defrag.app</a>.</p>
          </section>
        </div>
      </main>
    </>
  );
}