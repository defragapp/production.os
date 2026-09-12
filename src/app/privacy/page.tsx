import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <PageHeader title="Privacy Policy" description="Last updated: September 11, 2026" center={false} />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">1. Information We Collect</h2><p>When you create an account, we collect your email address and a password (stored as a salted hash). To compute your baseline, we collect your date, time, and place of birth. We also store your chat threads and subscription status.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">2. How We Use Your Information</h2><p>Your birth data is used solely to compute your baseline via the NASA/JPL Horizons API. Your chat history maintains your conversation threads. Your email is used for account verification, password resets, and transactional notifications.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">3. Data Sharing</h2><p>We do not sell your personal data. We share data only with service providers necessary to operate the Service: Stripe (payment processing), Resend (transactional email), and NASA/JPL Horizons (planetary position computation).</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">4. Data Storage &amp; Security</h2><p>Your data is stored in Cloudflare D1 (SQLite) and Workers KV, encrypted in transit and at rest. Passwords are hashed with PBKDF2 (100,000 iterations). Session tokens are signed JWTs stored in httpOnly, secure cookies.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">5. Your Rights</h2><p>You may request access to, correction of, or deletion of your personal data at any time by contacting us.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">6. Cookies</h2><p>We use a single session cookie to keep you signed in. It is httpOnly, SameSite=Lax, and expires after 7 days. We do not use third-party tracking cookies.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">7. Children&apos;s Privacy</h2><p>The Service is not directed to individuals under 18. We do not knowingly collect personal information from minors.</p></section>
          <section><h2 className="mb-2 text-lg font-semibold text-foreground">8. Contact</h2><p>Questions about this policy can be directed to <a href="mailto:info@sovereign.os" className="underline hover:text-foreground">info@sovereign.os</a>.</p></section>
        </div>
      </main>
    </>
  );
}
