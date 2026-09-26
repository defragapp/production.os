"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";
import { LoadingScreen } from "@/components/ui/loading";
import { AddPasskeyButton } from "@/components/passkey";
import { formatD1Date } from "@/lib/utils";

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg viewBox="0 0 16 16" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 8.5l4 4 7-9" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

interface UserData {
  email: string;
  display_name?: string | null;
  subscription_tier: string;
  stripe_customer_id: string | null;
  created_at: string;
  email_verified?: number;
}

interface UsageData {
  used: number;
  limit: number | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [resent, setResent] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    setVerifyStatus(new URLSearchParams(window.location.search).get("verify"));
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: UserData; usage?: UsageData };
        if (!data.user) {
          router.push("/onboard?mode=login");
          return;
        }
        setUser(data.user);
        setUsage(data.usage ?? null);
      })
      .catch(() => router.push("/onboard?mode=login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  // Escape closes the destructive-action dialog without deleting anything.
  useEffect(() => {
    if (!showDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowDelete(false); setDeleteText(""); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDelete]);

  const openDelete = () => { setDeleteText(""); setShowDelete(true); };
  const cancelDelete = () => { setShowDelete(false); setDeleteText(""); };

  const confirmDelete = async () => {
    if (deleteText.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    try {
      await fetch("/api/auth/account", { method: "DELETE" });
      router.push("/");
    } catch {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing-portal");
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't open billing — try again in a moment.");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Nav />
        <LoadingScreen className="min-h-[calc(100vh-3.5rem)]" label="Loading your account" />
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

  // D1's datetime('now') yields "YYYY-MM-DD HH:MM:SS" (UTC, no marker),
  // which Safari refuses to parse — formatD1Date normalizes before formatting.
  const memberSince = formatD1Date(user.created_at, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-lg">
          <PageHeader title="Account" description="Your plan, profile, and account preferences." />
          {unverifiedNotice && (
            <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${verifyStatus === "ok" ? "border-border bg-muted/30 text-foreground" : "border-border/80 bg-muted/40 text-foreground"}`}>
              {unverifiedNotice}
            </div>
          )}
          <div className="space-y-6">
            <Section
              title="Subscription"
              description="Where you stand right now"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${isPlus ? "bg-primary text-primary-foreground" : "border border-border bg-muted text-muted-foreground"}`}>
                    {isPlus ? "Sovereign+" : "Free"}
                  </span>
                </div>
                {isPlus ? (
                  <>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <PlanFeature>Unlimited AI messages — no daily cap</PlanFeature>
                      <PlanFeature>Invite people into your relationships</PlanFeature>
                      <PlanFeature>Your full Baseline, same private engine</PlanFeature>
                    </ul>
                    <Button
                      className="w-full"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                    >
                      {portalLoading ? "Opening billing..." : "Manage subscription"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground/70">Cancel anytime — two clicks, no emails.</p>
                    {portalError && <p className="text-xs text-destructive">{portalError}</p>}
                  </>
                ) : (
                  <>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <PlanFeature>5 AI messages per day</PlanFeature>
                      <PlanFeature>Your full Baseline</PlanFeature>
                      <PlanFeature>Your conversations stay with you</PlanFeature>
                    </ul>
                    {usage && usage.limit !== null && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Messages used today</span>
                          <span className="font-mono">
                            {Math.min(usage.used, usage.limit)} / {usage.limit}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/60"
                            style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <Button className="w-full" onClick={() => router.push("/upgrade")}>
                      Upgrade to Sovereign+
                    </Button>
                  </>
                )}
              </div>
            </Section>
            <Section
              title="Profile"
              description="Your account information"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Display name</span>
                  <span className="text-sm font-medium">
                    {user.display_name || (
                      <span className="text-muted-foreground/60">— not set —</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email status</span>
                  <span className={`text-sm font-medium ${emailVerified ? "text-foreground" : "text-muted-foreground"}`}>
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
              </div>
            </Section>
            <Section
              title="Security"
              description="Sign in faster — and safer — with a passkey"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Use Face ID, Touch ID, or your device&apos;s unlock. Your password stays as a backup,
                  so you can never get locked out.
                </p>
                <AddPasskeyButton />
              </div>
            </Section>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => router.push("/chat")}>
                Back to chat
              </Button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => router.push("/baseline")}>View Baseline</Button>
                <Button variant="outline" onClick={() => router.push("/settings")}>Connections &amp; invites</Button>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/[0.04] p-4">
              <p className="text-sm font-medium text-foreground">Sign out or delete</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Signing out ends this session on this device. Deleting erases your Baseline, chat
                history, and subscription for good — there&apos;s no way back.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-1" onClick={handleSignOut}>
                  Sign Out
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 sm:flex-1"
                  onClick={openDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </Button>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Return to homepage
              </Link>
            </div>
          </div>
        </div>
      </main>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={cancelDelete}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-account-title" className="font-display text-xl font-normal tracking-tight text-foreground">
              Delete your account?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This permanently erases your Baseline, chat history, connections, and subscription
              for <span className="font-medium text-foreground">{user.email}</span>. There is no way
              back.
            </p>
            <label htmlFor="delete-confirm" className="mt-4 block text-sm font-medium text-foreground">
              Type <span className="font-mono">DELETE</span> to confirm
            </label>
            <Input
              id="delete-confirm"
              autoFocus
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="DELETE"
              className="mt-2"
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 sm:flex-1"
                onClick={confirmDelete}
                disabled={deleting || deleteText.trim().toUpperCase() !== "DELETE"}
              >
                {deleting ? "Deleting..." : "Permanently delete"}
              </Button>
              <Button variant="ghost" className="sm:flex-1" onClick={cancelDelete} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
