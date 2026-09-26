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

const STEPS = ["Account", "Baseline", "Plan"];

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
  const isLogin = mode === "login";

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
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: { email?: string } | null; turnstileSiteKey?: string | null; hasBaseline?: boolean };
        if (data.user) {
          setExistingUser(true);
          setEmail(data.user.email || "");
          // Already signed in: send people to the workspace. Baseline is the
          // only first-time step, so an account without one just continues there.
          if (data.hasBaseline) {
            router.replace("/chat");
          } else {
            setPhase("baseline");
          }
        }
        setTurnstileSiteKey(data.turnstileSiteKey || null);
        setTsChecked(true);
      })
      .catch(() => { setTsChecked(true); });
  }, [router]);

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
        body: JSON.stringify({ email, password, turnstileToken: turnstileSiteKey ? turnstileToken : undefined }),
      });

      if (!authRes.ok) {
        const err = await readJsonSafe<{ error?: string }>(authRes);
        throw new Error(err?.error || `We couldn't create your account right now (${authRes.status}). Please try again.`);
      }

      const data = await readJsonSafe<{ user?: { email?: string }; hasBaseline?: boolean }>(authRes);
      if (!data) throw new Error("Unexpected response from the server. Please try again.");
      if (data.user?.email) setEmail(data.user.email);

      if (isLogin || existingUser) {
        if (data.hasBaseline) {
          router.push("/chat");
        } else {
          // Returning account that never built a Baseline — same first-time step.
          setExistingUser(true);
          setPhase("baseline");
        }
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
  if (resetToken) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
          <div className="w-full max-w-md">
            <Stepper steps={STEPS} current={0} />
            <div className="mb-8 text-center">
              <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sovereign OS</p>
              <h1 className="font-display text-3xl font-normal tracking-tight">Set a New Password</h1>
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
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {notice && <p className="text-sm text-foreground">{notice}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Resetting..." : "Reset Password"}
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
  if (showForgot) {
    if (resetSent) {
      return (
        <>
          <Nav />
          <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
              <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sovereign OS</p>
              <h1 className="mb-4 font-display text-3xl font-normal tracking-tight">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{resetEmail}</span>, we&apos;ve
                sent a link to reset your password.
              </p>
              <Button variant="ghost" className="mt-6 w-full" onClick={() => { setShowForgot(false); setError(null); }}>
                Back to Sign In
              </Button>
            </div>
          </main>
        </>
      );
    }

    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
          <div className="w-full max-w-md">
            <Stepper steps={STEPS} current={0} />
            <div className="mb-8 text-center">
              <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sovereign OS</p>
              <h1 className="font-display text-3xl font-normal tracking-tight">Reset Password</h1>
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
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => { setShowForgot(false); setError(null); }}>
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
    const title = isLogin ? "Sign In" : "Create Your Account";
    const description = isLogin
      ? "Welcome back. Sign in to continue where you left off."
      : "Start free. You can build your Baseline right after.";

    return (
      <>
        <Nav />
        <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
          <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
          <div className="w-full max-w-md">
            <Stepper steps={STEPS} current={0} />
            <div className="mb-8 text-center">
              <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sovereign OS</p>
              <h1 className="font-display text-3xl font-normal tracking-tight">{title}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLogin && (
                  <>
                    <PasskeySignInButton />
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
                        onClick={() => { setShowForgot(true); setError(null); }}
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
                          required
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                          I agree to the{" "}
                          <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>{" "}
                          and{" "}
                          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                          My birth data is used only to compute my Baseline, and it&apos;s never
                          shared with anyone else.
                        </Label>
                      </div>
                    </>
                  )}

                  {/* Sign in and sign up are both protected by Turnstile. */}
                  <div className="space-y-2 pt-1">
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
                        className="shrink-0 underline underline-offset-4 hover:text-foreground"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                  </Button>
                </form>

                <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
                  {isLogin ? (
                    <>
                      New to Sovereign?{" "}
                      <a href="/onboard?mode=signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Create your account
                      </a>
                    </>
                  ) : (
                    <>
                      Have an account?{" "}
                      <a href="/onboard?mode=login" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Sign in
                      </a>
                    </>
                  )}
                </p>
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
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-md">
          <Stepper steps={STEPS} current={1} />
          <div className="mb-8 text-center">
            <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sovereign OS</p>
            <h1 className="font-display text-3xl font-normal tracking-tight">Build Your Baseline</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              A plain-language picture of how you tend to communicate, feel, and decide — built
              from NASA/JPL planetary data. Takes about a minute.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <BaselineForm
                submitLabel="Save Baseline & Continue"
                onSaved={() => router.push(existingUser ? "/chat" : "/upgrade?from=baseline")}
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