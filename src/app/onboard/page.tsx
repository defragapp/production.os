"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Nav } from "@/components/nav";

export default function OnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { user?: { email?: string } }) => {
        if (d.user) {
          setExistingUser(true);
          setEmail(d.user.email || "");
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consent && !existingUser) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    try {
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!authRes.ok) {
        const err = await authRes.json() as { error?: string };
        throw new Error(err.error || "Authentication failed");
      }

      if (dob && tob && pob) {
        const baselineRes = await fetch("/api/baseline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tob, pob, dob }),
        });

        if (!baselineRes.ok) {
          const err = await baselineRes.json() as { error?: string };
          throw new Error(err.error || "Failed to save baseline");
        }
      }

      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
        const err = await res.json() as { error?: string };
        throw new Error(err.error || "Failed to send reset email");
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
        const err = await res.json() as { error?: string };
        throw new Error(err.error || "Failed to reset password");
      }

      setNotice("Password reset successfully. You can now sign in.");
      router.push("/onboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Sovereign OS
              </p>
              <h1 className="text-2xl font-bold">Set a New Password</h1>
            </div>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password (min 8 characters)</Label>
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
                  {notice && <p className="text-sm text-green-600">{notice}</p>}
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

  if (showForgot) {
    if (resetSent) {
      return (
        <>
          <Nav />
          <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
              <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Sovereign OS
              </p>
              <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
              <p className="text-muted-foreground">
                If an account exists for <strong>{resetEmail}</strong>, we&apos;ve sent a password reset link.
                It expires in 30 minutes.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}>
                Back
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
            <div className="mb-8 text-center">
              <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Sovereign OS
              </p>
              <h1 className="text-2xl font-bold">Reset Password</h1>
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

  return (
    <>
      <Nav />
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Sovereign OS
            </p>
            <h1 className="text-2xl font-bold">
              {existingUser ? "Welcome Back" : "Set Your Baseline"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {existingUser
                ? "Sign in to continue to your AI workspace."
                : "Enter your birth data to generate your baseline. Computed using the NASA/JPL Horizons API. Your data is never sent to third parties."}
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (min 8 characters)</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setError(null); }}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {!existingUser && (
                  <>
                    <div className="border-t pt-4" />
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tob">Time of Birth (24h)</Label>
                      <Input
                        id="tob"
                        type="time"
                        required
                        value={tob}
                        onChange={(e) => setTob(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pob">Place of Birth</Label>
                      <Input
                        id="pob"
                        type="text"
                        required
                        value={pob}
                        onChange={(e) => setPob(e.target.value)}
                        placeholder="City, Country"
                      />
                    </div>

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
                        I understand my birth data is used to compute my baseline and is never shared with third parties.
                      </Label>
                    </div>
                  </>
                )}

                {existingUser && (
                  <p className="text-sm text-muted-foreground">
                    Already have a baseline? You can update it later from your account.
                  </p>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Computing baseline..."
                    : existingUser
                      ? "Sign In"
                      : "Create Baseline"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
