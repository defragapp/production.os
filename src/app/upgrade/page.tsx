"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type PaymentIntent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { LoadingScreen } from "@/components/ui/loading";
import { PricingTable } from "@/components/pricing-table";
import Link from "next/link";

type Interval = "monthly" | "annual";

/**
 * Prices mirror the two allowlisted Stripe products the server already sells
 * (see configuredPrice() in src/lib/stripe.ts and the FAQ/landing copy).
 * They are display-only: the amount charged is whichever price id the server
 * resolves for the chosen interval — the client never sends one.
 */
const PLAN_PRICE: Record<Interval, { amount: string; cadence: string; renews: string }> = {
  monthly: { amount: "$20", cadence: "/month", renews: "Bills every month. Cancel anytime before the next charge." },
  annual: { amount: "$99", cadence: "/year", renews: "One charge today, then once a year. Cancel anytime before renewal." },
};

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/** Small label/value row for the order summary — mono meta, cream value. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Order summary — what is being bought, at what cadence, and on what terms.
 * Rendered next to the Payment Element so the money facts are the last thing
 * the person reads before paying. Amounts come from PLAN_PRICE (display
 * mirror of the configured Stripe prices); renewal terms are the plain truth
 * of a recurring subscription.
 */
function OrderSummary({ interval }: { interval: Interval }) {
  const price = PLAN_PRICE[interval];
  return (
    <div className="rounded-panel border border-foreground/15 bg-[hsl(var(--surface-1))] px-4 py-3">
      <SummaryRow label="Plan" value="Sovereign+" />
      <SummaryRow label="Billing" value={interval === "annual" ? "Annual" : "Monthly"} />
      <div className="flex items-baseline justify-between gap-4 border-t border-foreground/10 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Due today</span>
        <span className="font-display text-2xl font-normal text-foreground">
          {price.amount}
          <span className="ml-1 align-baseline text-xs text-muted-foreground">{price.cadence}</span>
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{price.renews}</p>
    </div>
  );
}

/** Legal footer shared by the payment step — plain links, never a wall of text. */
function LegalFooter() {
  return (
    <p className="text-center text-xs text-muted-foreground/70">
      Payment is processed securely by Stripe. Sovereign OS never sees your card details.{" "}
      <Link className="underline underline-offset-2" href="/terms">Terms</Link> ·{" "}
      <Link className="underline underline-offset-2" href="/privacy">Privacy</Link> · Cancel anytime in your account.
    </p>
  );
}

interface PaymentStepProps {
  interval: Interval;
  clientSecret: string;
  onBack: () => void;
}

/**
 * The payment step: Stripe's Payment Element (card fields live inside
 * Stripe's own iframes — raw numbers never touch this app's origin or our
 * endpoints) plus the order summary and the confirm button.
 *
 * Confirmation contract with the server:
 *   • confirmPayment with redirect:"if_required" so on-site completion and
 *     3-D Secure are both handled from the returned status, not a redirect.
 *   • A browser "succeeded" is NOT treated as an upgrade. We then poll
 *     /api/auth — which reports only what the webhook (or the bounded Stripe
 *     reconciliation) has written server-side — and show a pending state if
 *     it hasn't landed yet. Entitlement stays authoritative on the server.
 */
function PaymentStep({ interval, clientSecret, onBack }: PaymentStepProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsAuthUrl, setNeedsAuthUrl] = useState<string | null>(null);

  const pollEntitlement = useCallback(async () => {
    // Bounded poll: the webhook usually lands within a couple of seconds; if
    // it hasn't after ~16s we say so honestly rather than spinning forever.
    const started = Date.now();
    while (Date.now() - started < 16000) {
      try {
        const r = await fetch("/api/auth");
        const j = await r.json() as { user?: { subscription_tier?: string } };
        if (j.user?.subscription_tier === "sovereign+") {
          router.push("/chat?billing=success");
          return;
        }
      } catch { /* transient — keep polling inside the window */ }
      await new Promise((res) => setTimeout(res, 800));
    }
    setPending(true);
    setSubmitting(false);
  }, [router]);

  const completeWithStatus = useCallback(async (status: string, pi?: PaymentIntent | null) => {
    if (status === "succeeded") {
      setPending(true); // "Confirming…" while the server establishes the subscription
      await pollEntitlement();
      return;
    }
    if (status === "requires_action") {
      // 3-D Secure / SCA. Stripe.js gives us the hosted redirect for the
      // authentication step; payment itself is still Stripe's, and the
      // webhook is still the authority on what happens after.
      const url = pi?.next_action?.redirect_to_url?.url;
      if (url) { window.location.href = url; return; }
      setNeedsAuthUrl(pi?.client_secret ? "resume" : null);
      setError("Your bank needs one more step to approve this payment.");
      setSubmitting(false);
      return;
    }
    // processing (deferred payment method) — the webhook finalises it.
    if (status === "processing") {
      setPending(true);
      await pollEntitlement();
      return;
    }
    setError("The payment didn't complete. Nothing was charged twice — you can try again.");
    setSubmitting(false);
  }, [pollEntitlement]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return; // guards double submission
    setError(null);
    setSubmitting(true);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + "/upgrade" },
      redirect: "if_required",
    });
    if (confirmError) {
      // Card-level declines are recoverable in place — Stripe shows field
      // hints; we surface the message and leave the form intact.
      setError(confirmError.message || "The payment couldn't be confirmed. Check the details and try again.");
      setSubmitting(false);
      return;
    }
    await completeWithStatus(paymentIntent?.status || "unknown", paymentIntent);
  };

  const resumeAuth = async () => {
    if (!stripe) return;
    const { error: retrieveError, paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
    if (retrieveError || !paymentIntent) {
      setError(retrieveError?.message || "Couldn't reach the payment. Try again in a moment.");
      return;
    }
    await completeWithStatus(paymentIntent.status, paymentIntent);
  };

  if (pending) {
    // Payment went through on Stripe's side; the entitlement is settled by
    // the webhook (or the server's own Stripe reconciliation). Honest
    // pending state — never a premature "you're upgraded".
    return (
      <Card className="card-backlight card-lift border border-foreground/25">
        <CardHeader>
          <CardTitle className="text-base">Payment received</CardTitle>
          <CardDescription>We&apos;re confirming your subscription with Stripe — this usually takes a moment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="notice">Still confirming. If this is a first payment, activation can take up to a minute.</Alert>
          <Button className="w-full" variant="outline" onClick={() => router.push("/chat")}>
            Continue — we&apos;ll show Sovereign+ once it&apos;s active
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-backlight card-lift border border-foreground/25">
      <CardHeader>
        <CardTitle className="text-base">Payment for Sovereign+</CardTitle>
        <CardDescription>Enter your card details — they go straight to Stripe, not to us.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OrderSummary interval={interval} />
        <form onSubmit={onSubmit} className="space-y-3">
          <PaymentElement options={{ layout: "tabs" }} />
          {error && <Alert>{error}</Alert>}
          {needsAuthUrl && (
            <Button type="button" variant="outline" className="w-full" onClick={resumeAuth}>
              Complete bank authentication
            </Button>
          )}
          <Button type="submit" className="w-full" disabled={submitting || !stripe || !elements}>
            {submitting
              ? "Confirming payment…"
              : `Pay ${PLAN_PRICE[interval].amount}${PLAN_PRICE[interval].cadence} now`}
          </Button>
        </form>
        <LegalFooter />
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="btn btn-link mx-auto block text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Change plan
        </button>
      </CardContent>
    </Card>
  );
}

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState<Interval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  // undefined = still discovering, null = unavailable (fall back to hosted),
  // string = embedded Payment Element is live.
  const [publishableKey, setPublishableKey] = useState<string | null | undefined>(undefined);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  // The on-site payment step, present only once the server has created an
  // incomplete subscription and handed back its client secret.
  const [payment, setPayment] = useState<{ interval: Interval; clientSecret: string } | null>(null);
  // Cancellation recovery: the hosted flow's cancel_url and a declined init
  // both land back on the picker with a reason, never a dead end.
  const [notice, setNotice] = useState<string | null>(null);
  // Free-tier daily counter, mirrored from /api/auth → `usage` (see
  // src/app/api/auth/route.ts). null while loading; {used:0,limit:5} for
  // brand-new free accounts; null for sovereign+ accounts (no cap to show).
  const [usage, setUsage] = useState<{ used: number; limit: number | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as {
          user?: { subscription_tier?: string } | null;
          usage?: { used: number; limit: number | null };
        };
        if (!data.user) { router.push("/onboard?mode=signup&next=%2Fupgrade"); return; }
        setIsPlus(data.user.subscription_tier === "sovereign+");
        if (data.usage) setUsage(data.usage);
      } catch { router.push("/onboard?mode=signup&next=%2Fupgrade"); }
      finally { setAuthChecked(true); }
    })();
  }, [router]);

  // Discover whether embedded payment is available. Missing publishable key
  // (or a failed probe) is not an error — it just keeps hosted Checkout.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stripe/config");
        const data = await res.json() as { publishableKey?: string | null };
        if (data.publishableKey) {
          setPublishableKey(data.publishableKey);
          setStripePromise(loadStripe(data.publishableKey));
        } else {
          setPublishableKey(null);
        }
      } catch {
        setPublishableKey(null);
      }
    })();
  }, []);

  // Returning from a cancelled hosted Checkout (`STRIPE_CANCEL_URL` carries
  // ?billing=cancelled) — name the state plainly and get out of the URL so a
  // refresh doesn't resurrect the banner.
  useEffect(() => {
    if (searchParams.get("billing") === "cancelled") {
      setNotice("Checkout was cancelled — nothing was charged. Pick a plan again whenever you're ready.");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/upgrade?${qs}` : "/upgrade");
    }
  }, [searchParams]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing-portal");
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't open billing — try again in a moment.");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Couldn't open billing — try again in a moment.");
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (interval: Interval) => {
    setLoading(interval);
    setError(null);
    setNotice(null);
    try {
      // Prefer the on-site payment step when Stripe.js is configured;
      // otherwise keep the documented hosted-Checkout redirect.
      if (publishableKey && stripePromise) {
        const res = await fetch("/api/subscribe/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval }),
        });
        const data = await res.json() as {
          clientSecret?: string | null; status?: string; error?: string;
        };
        if (res.status === 409) {
          // Already subscribed, or a subscription is active server-side —
          // refresh the tier view instead of starting a second payment.
          setError(data.error || "A subscription is already active on this account.");
          setIsPlus(true);
          return;
        }
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error || "Couldn't start payment — try again in a moment.");
        }
        setPayment({ interval, clientSecret: data.clientSecret });
      } else {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval }),
        });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout — try again in a moment.");
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment — try again in a moment.");
    } finally { setLoading(null); }
  };

  if (!authChecked) {
    return (<><Nav /><LoadingScreen className="min-h-[calc(100dvh-3.5rem)]" label="Checking your plan" /></>);
  }

  const body = (
    <PageShell center={false} wide="prose">
      <PageHeader
        title={isPlus ? "You're on Sovereign+" : payment ? "Complete your payment" : "Pick your plan"}
        description={
          isPlus
            ? "Update your payment method, download receipts, or cancel — all in one place."
            : payment
              ? "You're one step from Sovereign+. The summary below is exactly what Stripe will charge."
              : "Free includes your full Baseline and five AI answers a day. Sovereign+ lifts that to 150 a day and opens invites."
        }
      />

      {notice && !isPlus && !payment && (
        <div className="mb-4"><Alert tone="notice">{notice}</Alert></div>
      )}

      {isPlus ? (
        <Card className="card-backlight card-lift border border-foreground/25">
          <CardHeader>
            <CardTitle className="text-base">Sovereign+ subscription</CardTitle>
            <CardDescription>Active on your account — billing runs through Stripe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <PlanFeature>Up to 150 AI messages a day</PlanFeature>
              <PlanFeature>Invite people into your relationships</PlanFeature>
              <PlanFeature>Your full Baseline, same private engine</PlanFeature>
            </ul>
            <Button className="w-full" onClick={handleManageBilling} disabled={portalLoading}>
              {portalLoading ? "Opening billing..." : "Manage subscription"}
            </Button>
            <p className="text-center text-xs text-muted-foreground/70">Cancel anytime — no emails needed.</p>
            {portalError && <Alert>{portalError}</Alert>}
          </CardContent>
        </Card>
      ) : payment && publishableKey && stripePromise ? (
        <Elements
          key={payment.clientSecret}
          stripe={stripePromise}
          options={{ clientSecret: payment.clientSecret }}
        >
          <PaymentStep
            interval={payment.interval}
            clientSecret={payment.clientSecret}
            onBack={() => { setPayment(null); setError(null); }}
          />
        </Elements>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="card-lift flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>Free</span>
                {usage && usage.limit !== null && (
                  // Usage pill — a live “you’ve used X of 5 today”, so the
                  // cap is a fact the user can see rather than an abstract
                  // promise. Renders only once /api/auth has responded.
                  <span
                    className="rounded-full border border-foreground/20 bg-foreground/[0.04] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                    aria-label={`You have used ${usage.used} of ${usage.limit} AI messages today`}
                  >
                    {usage.used}/{usage.limit} today
                  </span>
                )}
              </CardTitle>
              <CardDescription>Five good answers a day</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="mb-4 font-display text-3xl font-normal">$0</p>
              <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                <PlanFeature>5 AI messages per day</PlanFeature>
                <PlanFeature>Your full Baseline</PlanFeature>
                <PlanFeature>Your conversations stay with you</PlanFeature>
              </ul>
              <Button variant="outline" className="mt-6 w-full" onClick={() => router.push("/chat")}>
                Continue with Free
              </Button>
            </CardContent>
          </Card>
          <Card className="card-backlight card-lift relative border border-foreground/25">
            <CardHeader><CardTitle className="text-base">Sovereign+</CardTitle><CardDescription>150 messages a day — room to go as deep as you want</CardDescription></CardHeader>
            <CardContent className="flex flex-col">
              <div className="mb-4 flex items-baseline gap-2"><span className="font-display text-3xl font-normal">$99</span><span className="text-sm text-muted-foreground">/year</span></div>
              <p className="mb-4 text-sm text-muted-foreground">Best value when billed yearly</p>
              <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                <PlanFeature>Up to 150 AI messages a day</PlanFeature>
                <PlanFeature>Invite people into your relationships</PlanFeature>
                <PlanFeature>Your full Baseline, same private engine</PlanFeature>
              </ul>
              <div className="mt-6 space-y-2">
                <Button className="w-full" onClick={() => handleUpgrade("annual")} disabled={loading !== null}>
                  {publishableKey ? (loading === "annual" ? "Preparing…" : "Get Sovereign+ — $99/year") : (loading === "annual" ? "Redirecting..." : "Get Sovereign+ — $99/year")}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => handleUpgrade("monthly")} disabled={loading !== null}>
                  {publishableKey ? (loading === "monthly" ? "Preparing…" : "Or pay monthly — $20/mo") : (loading === "monthly" ? "Redirecting..." : "Or pay monthly — $20/mo")}
                </Button>
                <p className="text-center text-xs text-muted-foreground/70">US dollars. {publishableKey ? "Secure payment by Stripe." : "Secure checkout by Stripe."} Cancel anytime.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison table — same data the landing shows, but reached
          already-warm: the reader is on the account, deciding. */}
      <div className="mt-2">
        <PricingTable />
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="ghost" onClick={() => router.push("/chat")}>Back to chat</Button>
        <Button variant="ghost" onClick={() => router.push("/account")}>Account</Button>
      </div>
    </PageShell>
  );

  return body;
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Checking your plan" />}>
      <UpgradeContent />
    </Suspense>
  );
}
