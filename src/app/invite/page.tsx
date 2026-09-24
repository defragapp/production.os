"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";
import { LoadingScreen } from "@/components/ui/loading";

type InviteStatus = "invalid" | "revoked" | "accepted" | "expired" | "pending";

interface InfoData {
  status: InviteStatus;
  emailMasked?: string;
  inviterName?: string;
  role?: string;
}

function AcceptCard({
  info,
  token,
  onAccepted,
}: {
  info: InfoData;
  token: string;
  onAccepted: (inviterName: string) => void;
}) {
  const router = useRouter();
  const emailMasked = info.emailMasked ?? "";
  const inviterName = info.inviterName ?? "Someone";
  const role = info.role ?? "friend";

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsBaseline, setNeedsBaseline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: unknown };
        if (!cancelled) setAuthed(Boolean(data.user));
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    setNeedsBaseline(false);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        onAccepted(inviterName);
        return;
      }
      const data = await res.json() as { error?: string; code?: string };
      if (res.status === 428 && data.code === "baseline_required") {
        setNeedsBaseline(true);
        setError("Finish setting up your baseline first. You're almost there.");
        return;
      }
      if (res.status === 403 && data.code === "email_mismatch") {
        setError(
          `This invitation is for ${emailMasked}, but you're signed in with a different account. Sign out, then sign in with that account.`,
        );
        return;
      }
      if (res.status === 410) {
        setError((data.error as string) || "This invitation is no longer active.");
        return;
      }
      if (res.status === 409) {
        onAccepted(inviterName);
        return;
      }
      setError(data.error || "Could not accept the invitation.");
    } catch {
      setError("Could not accept the invitation. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const signOutForSwitch = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push(`/onboard?mode=login&invite=${encodeURIComponent(token)}`);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-lg">{inviterName} has invited you</CardTitle>
        <CardDescription>
          They see you as &ldquo;{role}&rdquo; — and you&apos;ll be able to say who they are to you.
          No birth data is exchanged through this connection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {authed === null ? (
          <LoadingScreen className="py-8" label="Checking your account" />
        ) : authed === false ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This invitation was sent to <span className="font-medium text-foreground">{emailMasked}</span>.
              You&apos;ll need an account with that email address to accept it.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/onboard?mode=signup&invite=${encodeURIComponent(token)}`}
                className="btn-aurora w-full px-4 py-2.5 text-center text-sm font-medium"
              >
                Create a free account
              </Link>
              <Link
                href={`/onboard?mode=login&invite=${encodeURIComponent(token)}`}
                className="btn-glass w-full px-4 py-2.5 text-center text-sm font-medium text-foreground"
              >
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              You&apos;re signed in. When you accept,{" "}
              <span className="font-medium text-foreground">{inviterName}</span> becomes a connection
              and you can choose how much of your baseline to share with them.
            </div>

            {error && (
              <p className="text-sm leading-relaxed text-destructive">{error}</p>
            )}

            {needsBaseline ? (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/baseline?invite=${encodeURIComponent(token)}`}
                  className="btn-aurora w-full px-4 py-2.5 text-center text-sm font-medium"
                >
                  Set up my baseline
                </Link>
                <Button variant="outline" onClick={handleAccept} disabled={accepting}>
                  {accepting ? "Checking…" : "Check again"}
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? "Accepting…" : `Accept & connect with ${inviterName}`}
              </Button>
            )}

            <button
              type="button"
              onClick={signOutForSwitch}
              className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Sign out and use a different account
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<InfoData | null>(null);
  const [acceptedAs, setAcceptedAs] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token")?.trim() || "";
    setToken(t || null);
    if (!t) {
      setInfo({ status: "invalid" });
      return;
    }
    let cancelled = false;
    fetch(`/api/invites/info?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setInfo(d as InfoData);
      })
      .catch(() => {
        if (!cancelled) setInfo({ status: "invalid" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connectedHref = "/chat";

  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-md">
          {!token ? (
            <>
              <PageHeader title="Invitation" description="This invitation link doesn't look right." />
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    It looks like the link got cut off — the part that identifies your invitation is
                    missing. Ask the person who invited you to send it again, and make sure the
                    whole link comes along.
                  </p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/")}>
                    Back to Sovereign
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : info === null ? (
            <PageHeader title="Invitation" description="Checking your invitation…" />
          ) : info.status === "invalid" ? (
            <>
              <PageHeader title="Invitation" description="This invitation isn't valid." />
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    We couldn&apos;t find this invitation. It may have been replaced by a newer
                    invite link. Ask the person who invited you to share their current link.
                  </p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/")}>
                    Back to Sovereign
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : info.status === "revoked" ? (
            <>
              <PageHeader title="Invitation" description="This invitation was revoked." />
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {info.inviterName ?? "The person who invited you"} has cancelled this
                    invitation. If you think this is a mistake, reach out and ask them to invite
                    you again.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                    Back to Sovereign
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : info.status === "expired" ? (
            <>
              <PageHeader title="Invitation" description="This invitation has expired." />
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Invitations last for 7 days. Ask {info.inviterName ?? "the person who invited you"}{" "}
                    to send a fresh invite link.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                    Back to Sovereign
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : info.status === "accepted" ? (
            <>
              <PageHeader title="Already connected" description="You've accepted this invitation." />
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4" />
                    {info.inviterName ?? "The person who invited you"} and you are already connected.
                  </div>
                  <Button className="w-full" onClick={() => router.push(connectedHref)}>
                    Open Chat
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <PageHeader
                title="You're invited"
                description={`Connect with ${info.inviterName ?? "someone"} as their ${info.role ?? "friend"}.`}
              />
              {acceptedAs ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4" />
                      You and {acceptedAs} are now connected.
                    </div>
                    <Button className="w-full" onClick={() => router.push(connectedHref)}>
                      Open Chat
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <AcceptCard
                  info={info}
                  token={token}
                  onAccepted={(name) => setAcceptedAs(name)}
                />
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}