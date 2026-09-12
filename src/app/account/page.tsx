"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";

interface UserData {
  email: string;
  subscription_tier: string;
  stripe_customer_id: string | null;
  created_at: string;
  email_verified?: number;
}

export default function AccountPage() {
  const router = useRouter();
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  useEffect(() => {
    setVerifyStatus(new URLSearchParams(window.location.search).get("verify"));
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: UserData };
        if (!data.user) {
          router.push("/onboard");
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push("/onboard"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Delete your account permanently? This removes your baseline, chat history, and subscription. This cannot be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await fetch("/api/auth/account", { method: "DELETE" });
      router.push("/");
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }

  if (!user) return null;

  const isPlus = user.subscription_tier === "sovereign+";
  const emailVerified = Boolean(user.email_verified);
  const unverifiedNotice =
    verifyStatus === "ok" ? "Email verified — thank you."
    : verifyStatus === "invalid" ? "That verification link is invalid."
    : verifyStatus === "expired" ? "That verification link has expired. Request a new one below."
    : verifyStatus === "missing" ? "No verification token was provided."
    : null;

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Nav />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-lg">
          <PageHeader title="Account" description="Your plan, profile, and account preferences." />
          {unverifiedNotice && (
            <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${verifyStatus === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
              {unverifiedNotice}
            </div>
          )}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
                <CardDescription>Your current plan and benefits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${isPlus ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isPlus ? "Sovereign+" : "Free"}
                  </span>
                </div>
                {isPlus ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>✓ Unlimited AI messages</li>
                    <li>✓ Full chat history & threads</li>
                    <li>✓ Advanced pattern analysis</li>
                    <li>✓ Priority AI inference</li>
                  </ul>
                ) : (
                  <>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>5 AI messages per day</li>
                      <li>Baseline computation</li>
                      <li>Basic chat history</li>
                    </ul>
                    <Button className="w-full" onClick={() => router.push("/upgrade")}>
                      Upgrade to Sovereign+
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email status</span>
                  <span className={`text-sm font-medium ${emailVerified ? "text-emerald-400" : "text-amber-400"}`}>
                    {emailVerified ? "✓ Verified" : "Unverified"}
                  </span>
                </div>
                {!emailVerified && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={resent === "sending" || resent === "sent"}
                      onClick={async () => {
                        setResent("sending");
                        try {
                          const r = await fetch("/api/auth/resend", { method: "POST" });
                          const d = await r.json() as { ok?: boolean; error?: string };
                          setResent(d.ok ? "sent" : `error: ${d.error || "Could not send verification email."}`);
                        } catch {
                          setResent("error: Could not send verification email.");
                        }
                      }}
                    >
                      {resent === "sending" ? "Sending..." : resent === "sent" ? "Verification email sent ✓" : "Resend verification email"}
                    </Button>
                    {resent?.startsWith("error:") && (
                      <p className="text-xs text-destructive">{resent.slice(7)}</p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Member since</span>
                  <span className="text-sm font-medium">{memberSince}</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => router.push("/chat")}>Back to Chat</Button>
              <Button variant="outline" className="w-full" onClick={() => router.push("/")}>Home</Button>
              <Button variant="ghost" className="w-full text-destructive" onClick={handleSignOut}>Sign Out</Button>
              <Button
                variant="outline"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
