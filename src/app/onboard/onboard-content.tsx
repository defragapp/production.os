"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { TurnstileWidget } from "@/components/turnstile";
import { Stepper } from "@/components/stepper";
import { BaselineForm } from "@/components/baseline-form";
import { PasskeySignInButton } from "@/components/passkey";
import { Alert } from "@/components/ui/alert";
import { cn, safeInAppPath } from "@/lib/utils";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const STEPS = ["Account", "Baseline"];

/**
 * Parse a JSON response defensively. A worker crash or proxy error can return
 * an empty/non-JSON body; calling res.json() directly then throws the opaque
 * "Unexpected end of JSON input", so we surface null and let callers decide.
 */
async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

export function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const mode = searchParams.get("mode");
  const inviteToken = searchParams.get("invite");
  // Where the middleware bounced the person from (e.g. /settings via a
  // support reply). Honored after sign-in so intent survives the wall.
  const nextParam = searchParams.get("next");
  // Search params only exist after hydration: SSR always renders the signup
  // markup, so branching on `mode` during the first client paint trips React
  // #418 (hydration text mismatch) and leaves the whole form inert.
  const [mounted, setMounted] = useState(false);
  const isLogin = mounted && mode === "login";

  useEffect(() => { setMounted(true); }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tsFailed, setTsFailed] = useState(false);
  const [tsChecked, setTsChecked] = useState(false);
  const [tsKey, setTsKey] = useState(0);
  const [phase, setPhase] = useState<"account" | "baseline">("account");

  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: { email?: string } | null; turnstileSiteKey?: string | null; hasBaseline?: boolean };
        if (data.user) {
          setExistingUser(true);
          setEmail(data.user.email || "");
          // Already signed in: send people to the workspace. An invitation in
          // the URL takes priority — that's why they're here. Baseline is the
          // only first-time step, so an account without one just continues there.
          if (inviteToken) {
            router.replace(`/invite?token=${encodeURIComponent(inviteToken)}`);
          } else if (data.hasBaseline) {
            router.replace(safeInAppPath(nextParam) ?? "/chat");
          } else {
            setPhase("baseline");
          }
        }
        setTurnstileSiteKey(data.turnstileSiteKey || null);
        setTsChecked(true);
      })
      .catch(() => { setTsChecked(true); });
  }, [router, inviteToken, nextParam]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && !consent) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password,
          intent: isLogin ? "login" : "signup",
          turnstileToken: !isLogin && turnstileSiteKey ? turnstileToken : undefined,
          // Provable clickwrap: the server stamps the version affirmed onto the
          // user row (users.terms_version / terms_accepted_at) at signup.
          termsAccepted: !isLogin && consent ? true : undefined,
          termsVersion: !isLogin && consent ? CURRENT_TERMS_VERSION : undefined,
        }),
      });

      if (!authRes.ok) {
        const err = await readJsonSafe<{ error?: string }>(authRes);
        throw new Error(err?.error || `We couldn't create your account right now (${authRes.status}). Please try again.`);
      }

      const data = await readJsonSafe<{ user?: { email?: string }; hasBaseline?: boolean }>(authRes);
      if (!data) throw new Error("Unexpected response from the server. Please try again.");
      if (data.user?.email) setEmail(data.user.email);
      // Session cookie is set — sync the persistent Nav chrome before the soft
      // navigation, which alone would not remount it (logged-out menu bug).
      window.dispatchEvent(new Event("sovereign:auth"));

      if (isLogin || existingUser) {
        // Invitation links carry the token through auth so the accept screen
        // picks it up on the other side of signup/sign-in.
        if (inviteToken) {
          router.push(`/invite?token=${encodeURIComponent(inviteToken)}`);
        } else if (data.hasBaseline) {
          router.push(safeInAppPath(nextParam) ?? "/chat");
        } else {
          // Returning account that never built a Baseline — same first-time step.
          setExistingUser(true);
          setPhase("baseline");
        }
      } else if (inviteToken) {
        // New account arriving from an invitation: the accept screen gates on
        // the baseline and deep-links back here, so hand off to it directly.
        router.push(`/invite?token=${encodeURIComponent(inviteToken)}`);
      } else {
        // Account created — Baseline is the next, distinct step.
        setPhase("baseline");
      }
      setTurnstileToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (!res.ok) {
        const err = await readJsonSafe<{ error?: string }>(res);
        throw new Error(err?.error || "Failed to send reset email");
      }

      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });

      if (!res.ok) {
        const err = await readJsonSafe<{ error?: string }>(res);
        throw new Error(err?.error || "Failed to reset password");
      }

      setNotice("Password reset successfully. You can now sign in.");
      router.push("/onboard?mode=login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Password reset (token) screen ─────────────────────────────
  // Switching between the two access modes keeps any invite or post-login
  // destination in the URL, so a person arriving from an invitation (or bounced
  // from a protected page) doesn't lose that intent when they toggle.
  const switchMode = (m: "login" | "signup") => {
    setError(null);
    const p = new URLSearchParams();
    p.set("mode", m);
    if (inviteToken) p.set("invite", inviteToken);
    if (nextParam) p.set("next", nextParam);
    router.replace(`/onboard?${p.toString()}`);
  };

  if (!mounted) {
    return (
      <>
        <Nav />
        <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }

  if (resetToken) {
    return (
      <>
        <Nav />
        <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Password reset is an account-recovery side trip, not an
                onboarding step — no stepper. */}
            <div className="mb-8 mt-2 text-center">
              <h1 className="font-display text-3xl font-normal tracking-tight">Set a new password</h1>
            </div>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password (at least 8 characters)</Label>
                    <Input
                      id="new-password"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {error && <Alert>{error}</Alert>}
                  {notice && <Alert tone="notice">{notice}</Alert>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Resetting..." : "Reset password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  // ── Forgot password flow ──────────────────────────────────────
  // `?recover=1` is the single source of truth (pushed, so browser Back
  // unwinds the side trip and re-renders this gate from the URL) and
  // `next` rides along so a bounced user's destination survives the detour.
  const keepNext = nextParam ? `&next=${encodeURIComponent(nextParam)}` : "";
  if (searchParams.get("recover") === "1") {
    if (resetSent) {
      return (
        <>
          <Nav />
          <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
              <h1 className="mb-4 font-display text-3xl font-normal tracking-tight">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{resetEmail}</span>, we&apos;ve
                sent a link to reset your password.
              </p>
              <Button variant="ghost" className="mt-6 w-full" onClick={() => { setError(null); router.replace(`/onboard?mode=login${keepNext}`); }}>
                Back to sign in
              </Button>
            </div>
          </main>
        </>
      );
    }

    return (
      <>
        <Nav />
        <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Forgot-password is recovery, not onboarding — no stepper. */}
            <div className="mb-8 mt-2 text-center">
              <h1 className="font-display text-3xl font-normal tracking-tight">Reset password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  {error && <Alert>{error}</Alert>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send reset link"}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => { setError(null); router.replace(`/onboard?mode=login${keepNext}`); }}>
                    Back
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  // ── Step 1: account (sign in / sign up) ───────────────────────
  if (phase === "account") {
    const title = isLogin ? "Sign in" : "Create your account";
    const description = isLogin
      ? "Welcome back. Sign in to continue where you left off."
      : "Start free. You can build your Baseline right after.";

    return (
      <>
        <Nav />
        <main id="main" className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden p-6">
          <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
          <div className="card-backlight msg-in w-full max-w-md">
            {/* Segmented access switcher — one premium control replaces the old
                bottom "New to Sovereign? / Have an account?" text link, so the
                two modes read as siblings rather than one being an afterthought. */}
            <div className="mb-5 flex justify-center">
              <div
                role="group"
                aria-label="Choose how to continue"
                className="inline-flex rounded-full border border-border bg-surface-1/70 p-1 backdrop-blur"
              >
                {(
                  [
                    ["signup", "Create account"],
                    ["login", "Sign in"],
                  ] as const
                ).map(([m, label]) => {
                  const on = (m === "login") === isLogin;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => switchMode(m)}
                      className={cn(
                        "tap-line rounded-full px-4 py-1.5 text-sm transition-colors",
                        on
                          ? "bg-white/[0.08] font-medium text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* The stepper only applies to new accounts; returning users
                signing in aren't mid-funnel, so "1 of 2" is noise. It sits
                directly above the form as a progress cue rather than floating
                between the switcher and the title, so identity reads as one
                header and the funnel reads as the next thing you do. */}
            <div className={`${isLogin ? "mt-1" : ""} mb-5 text-center`}>
              <h1 className="font-display text-3xl font-normal tracking-tight">{title}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
            </div>
            {!isLogin && <Stepper steps={STEPS} current={0} />}

            <Card>
              <CardContent className="pt-6">
                {isLogin && (
                  <>
                    {/* Passkey-first: the credential-less, one-tap path is the
                        focal action at the top of the card (solid cream), with
                        the email/password form demoted to the fallback beneath
                        an explicit divider. Registration still needs a session,
                        so this focal path lives on sign-in only. */}
                    <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Recommended · fastest way back in
                    </p>
                    <PasskeySignInButton focal />
                    <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or use your password
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete={isLogin ? "username webauthn" : "email"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (at least 8 characters)</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                    />
                  </div>

                  {isLogin && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => { setError(null); router.push(`/onboard?mode=login&recover=1${keepNext}`); }}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {!isLogin && (
                    <>
                      <div className="border-t pt-4" />
                      <div className="flex items-start gap-2 pt-2">
                        <input
                          id="consent"
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          aria-label="I am at least 18 years old and agree to the Terms of Service and Privacy Policy"
                          aria-describedby="consent-note"
                          className="consent-checkbox mt-1 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-input bg-transparent transition-colors checked:border-foreground checked:bg-foreground"
                        />
                        {/* aria-label keeps the announced name concise (no double-read
                            links); the full note rides via aria-describedby and the
                            label still forwards clicks to toggle the box. */}
                        <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                          <span id="consent-note">
                            I am at least 18 years old and agree to the {""}
                            <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>{" and "}
                            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                            My birth data is used only to compute my Baseline, and it&apos;s never
                            shared with anyone else.
                          </span>
                        </Label>
                      </div>
                    </>
                  )}

                  {/* Turnstile guards account creation only. Sign-in is covered
                      by the password check + rate limiter + email verification,
                      so a blocked/expired widget never stands between a
                      returning user and their account. */}
                  {!isLogin && (
                    <>
                      {/* min-h reserves the widget's exact 65px footprint from
                          first paint, so the async site-key fetch + mount cannot
                          push the rows below it down (the onboard CLS blip). */}
                      <div className="min-h-[65px] space-y-2 pt-1">
                        {turnstileSiteKey && !tsFailed && (
                          <TurnstileWidget
                            key={tsKey}
                            siteKey={turnstileSiteKey}
                            onToken={setTurnstileToken}
                            onError={() => {
                              setTurnstileToken(null);
                              setTsFailed(true);
                            }}
                          />
                        )}
                        {!turnstileSiteKey && tsChecked && !tsFailed && (
                          <p className="text-sm text-muted-foreground">Security check unavailable — continuing without it.</p>
                        )}
                      </div>

                      {tsFailed && (
                        <div className="flex items-center justify-between gap-2 border-t pt-4 text-sm text-muted-foreground">
                          <span>Security check unavailable. You can still continue &mdash; we&apos;ll verify your email.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTsFailed(false);
                              setTsKey((k) => k + 1);
                            }}
                            className="tap-line tap-line-center shrink-0 underline underline-offset-4 hover:text-foreground"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {error && <Alert>{error}</Alert>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  // ── Step 2: Baseline — first-time only ────────────────────────
  return (
    <>
      <Nav />
      <main id="main" className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-md">
          <Stepper steps={STEPS} current={1} />
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-normal tracking-tight">Build your Baseline</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              A plain-language picture of how you tend to communicate, feel, and decide — built
              from NASA/JPL planetary data. Takes about a minute.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {/* Value before the ask: a Baseline is only a picture until it's
                  used. Everyone lands in their first conversation — the upgrade
                  surface lives in-chat at the free cap, where intent is earned
                  rather than assumed. */}
              <BaselineForm
                submitLabel="Save Baseline & start asking"
                onSaved={() => router.push(
                  inviteToken
                    ? `/invite?token=${encodeURIComponent(inviteToken)}`
                    : "/chat"
                )}
              />
              <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
                You can update this later on your Baseline page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}