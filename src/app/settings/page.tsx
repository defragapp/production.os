"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";
import { LoadingScreen } from "@/components/ui/loading";
import type { RelationshipView } from "@/lib/types";
import { formatD1Date } from "@/lib/utils";

const ROLE_SUGGESTIONS = [
  "friend", "partner", "spouse", "mom", "dad", "sister", "brother", "sibling",
  "child", "parent", "cousin", "best friend", "colleague", "boss", "teammate",
  "in-law", "neighbor", "other",
];

interface InviteRow {
  id: string;
  emailMasked: string;
  role: string;
  status: string;
  lapsed?: boolean;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

function shortDate(iso: string | null): string {
  return iso ? formatD1Date(iso, { month: "short", day: "numeric" }) : "—";
}

export default function SettingsPage() {
  const router = useRouter();
  const [tier, setTier] = useState<"free" | "sovereign+" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displaySaved, setDisplaySaved] = useState(false);

  const [connections, setConnections] = useState<RelationshipView[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteRequiresPlus, setInviteRequiresPlus] = useState(false);

  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    const [relRes, invRes] = await Promise.all([fetch("/api/relationships"), fetch("/api/invites")]);
    if (relRes.ok) {
      const rd = await relRes.json() as { relationships?: RelationshipView[] };
      setConnections(rd.relationships ?? []);
    }
    if (invRes.ok) {
      const id = await invRes.json() as { invites?: InviteRow[] };
      setInvites(id.invites ?? []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json() as { user?: { display_name?: string | null; subscription_tier?: string } | null };
        if (!data.user) {
          router.push("/onboard?mode=login");
          return;
        }
        if (cancelled) return;
        setTier(data.user.subscription_tier === "sovereign+" ? "sovereign+" : "free");
        setDisplayName(data.user.display_name ?? "");
        setDisplayNameDraft(data.user.display_name ?? "");
        await loadPeople();
      } catch {
        if (!cancelled) router.push("/onboard?mode=login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadPeople]);

  const saveDisplayName = async () => {
    const value = displayNameDraft.trim().replace(/\s+/g, " ");
    if (value === displayName) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: value }),
      });
      if (!res.ok) throw new Error("save failed");
      setDisplayName(value);
      setDisplaySaved(true);
      setTimeout(() => setDisplaySaved(false), 2000);
    } catch {
      setDisplayName(displayName);
      setDisplayNameDraft(displayName);
    }
  };

  const sendInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    setInviteRequiresPlus(false);
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError("Enter an email address.");
      return;
    }
    setInviteSending(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole.trim() || undefined }),
      });
      const data = await res.json() as { error?: string; code?: string; invite?: InviteRow };
      if (!res.ok) {
        if (data.code === "plus_required") setInviteRequiresPlus(true);
        else setInviteError(data.error || "Could not send the invitation.");
        return;
      }
      setInviteEmail("");
      setInviteRole("");
      setInviteSuccess(`Invitation sent to ${data.invite?.emailMasked ?? email}.`);
      await loadPeople();
    } catch {
      setInviteError("Could not send the invitation.");
    } finally {
      setInviteSending(false);
    }
  };

  const updateShare = async (row: RelationshipView, value: boolean) => {
    try {
      await fetch(`/api/relationships?id=${encodeURIComponent(row.relationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareBaseline: value }),
      });
      await loadPeople();
    } catch {
      await loadPeople();
    }
  };

  const saveLabel = async (row: RelationshipView) => {
    const value = labelDraft.trim();
    if (value && value !== row.myLabel) {
      await fetch(`/api/relationships?id=${encodeURIComponent(row.relationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myLabel: value }),
      });
    }
    setEditingLabel(null);
    setLabelDraft("");
    await loadPeople();
  };

  const removeConnection = async (row: RelationshipView) => {
    if (!window.confirm(`Remove ${row.personName} from your connections? Their connection with you is removed from both sides.`)) return;
    await fetch(`/api/relationships?id=${encodeURIComponent(row.relationId)}`, { method: "DELETE" });
    await loadPeople();
  };

  const revokeInvite = async (row: InviteRow) => {
    await fetch(`/api/invites/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    setInviteSuccess(null);
    await loadPeople();
  };

  const copyShareLink = async (row: InviteRow) => {
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const data = await res.json() as { shareUrl?: string; error?: string };
      if (!res.ok || !data.shareUrl) throw new Error(data.error || "Couldn't copy the link");
      await navigator.clipboard.writeText(data.shareUrl);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
      await loadPeople();
    } catch {
      setInviteError("Couldn't copy the link. Try again, or ask them to check their email instead.");
    }
  };

  const loading = tier === null && connections === null && invites === null;

  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-start justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-2xl">
          <PageHeader
            title="Settings"
            description="Your profile, connections, and privacy controls."
          />

          {loading ? (
            <LoadingScreen className="py-20" label="Loading your settings" />
          ) : (
            <div className="space-y-6">
              <Section
                title="Profile"
                description="How your name appears to connected people"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="display-name" className="mb-1.5 block text-xs text-muted-foreground">
                      Display name
                    </label>
                    <Input
                      id="display-name"
                      value={displayNameDraft}
                      maxLength={60}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      placeholder="Name shown to people you connect with"
                    />
                  </div>
                  <Button onClick={saveDisplayName} disabled={displayNameDraft.trim().replace(/\s+/g, " ") === displayName}>
                    {displaySaved ? (
                      <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Saved</span>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground/70">
                  If you leave this blank, people you connect with see the name in front of the
                  &ldquo;@&rdquo; in your email. Either way, they never see your full email address
                  or your birth data.
                </p>
              </Section>

              <Section
                title="Connections"
                description="People you've invited and who've accepted. They only ever see your name, your role, and anything you explicitly share."
              >
                  {connections === null ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : connections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tier === "free"
                        ? "No connections yet. Connections grow from invitations, which are part of Sovereign+."
                        : "No connections yet. Send an invitation below and it becomes a connection once the person accepts."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {connections.map((c) => (
                        <li key={c.relationId} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium text-foreground">{c.personName}</span>
                                <span className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  {c.myLabel}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground/80">
                                {c.personEmailMasked}
                                {c.peerLabel && c.peerLabel !== c.myLabel ? <> · you&apos;re <span className="font-mono">{c.peerLabel}</span> to them</> : ""}
                                {" · "}
                                {c.peerHasBaseline
                                  ? c.peerSharesBaseline
                                    ? "shares their baseline with you"
                                    : "hasn't shared their baseline with you yet"
                                  : "no baseline shared yet"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => { setEditingLabel(c.relationId); setLabelDraft(c.myLabel); }}
                                aria-label="Edit label"
                                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeConnection(c)}
                                aria-label="Remove connection"
                                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {editingLabel === c.relationId && (
                            <div className="mt-2 flex gap-2">
                              <Input
                                value={labelDraft}
                                maxLength={40}
                                onChange={(e) => setLabelDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveLabel(c);
                                  if (e.key === "Escape") { setEditingLabel(null); setLabelDraft(""); }
                                }}
                                placeholder="Their role in your life"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => saveLabel(c)}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingLabel(null); setLabelDraft(""); }}>
                                Cancel
                              </Button>
                            </div>
                          )}

                          <label className="mt-2 flex cursor-pointer items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              {c.shareBaseline
                                ? `${c.personName} can read your baseline in your conversations about you both`
                                : `${c.personName} isn't reading your baseline right now`}
                            </span>
                            <input
                              type="checkbox"
                              role="switch"
                              checked={c.shareBaseline}
                              onChange={(e) => updateShare(c, e.target.checked)}
                              className="h-4 w-4 accent-foreground"
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
              </Section>

              <Section
                title="Invitations"
                description="Invite someone to connect. The link is valid for 7 days."
              >
                <div className="space-y-4">
                  {tier === "free" && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Inviting people is part of{" "}
                      <Button variant="link" className="h-auto p-0 text-sm font-medium text-foreground underline underline-offset-2" onClick={() => router.push("/upgrade")}>
                        Sovereign+
                      </Button>
                      . Upgrade to invite someone into your relationships.
                    </div>
                  )}

                  {/* Free tier gets the Sovereign+ gate instead of a form that
                      can only fail on submit. */}
                  {tier === "free" ? (
                    <Button variant="outline" className="w-full" onClick={() => router.push("/upgrade")}>
                      Upgrade to Sovereign+ to send invitations
                    </Button>
                  ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="their@email.com"
                      aria-label="Invite email"
                      className="sm:flex-1"
                    />
                    <Input
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      placeholder="Role (e.g. partner)"
                      aria-label="Role"
                      list="role-suggestions"
                      className="sm:w-44"
                    />
                    <datalist id="role-suggestions">
                      {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
                    </datalist>
                    <Button onClick={sendInvite} disabled={inviteSending}>
                      {inviteSending ? "Sending…" : "Invite"}
                    </Button>
                  </div>
                  )}
                  {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
                  {inviteRequiresPlus && (
                    <p className="text-xs text-muted-foreground">
                      Invitations are part of Sovereign+.{" "}
                      <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => router.push("/upgrade")}>
                        Upgrade
                      </button>{" "}
                      to send one.
                    </p>
                  )}
                  {inviteSuccess && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5" /> {inviteSuccess}
                    </p>
                  )}

                  {/* A free user can't have invitations and is behind the paywall,
                      so showing "No invitations yet" here only contradicts the gate. */}
                  {tier === "free" ? null : invites === null ? null : invites.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">No invitations yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {invites.map((inv) => (
                        <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">
                              {inv.emailMasked}
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                {inv.role}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              {inv.lapsed
                                ? <>Was connected · no longer active</>
                                : inv.acceptedAt
                                  ? <>Accepted · {shortDate(inv.acceptedAt)}</>
                                  : inv.status === "revoked"
                                    ? <>Revoked</>
                                    : <>Invited · {shortDate(inv.createdAt)} · expires {shortDate(inv.expiresAt)}</>}
                            </p>
                          </div>
                          {inv.status === "pending" && (
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyShareLink(inv)}
                                aria-label="Copy invite link"
                              >
                                {copiedId === inv.id ? (
                                  <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Copied</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Copy link</span>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => revokeInvite(inv)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>

              <Section title="Privacy">
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Connections are two-sided but independent. What you share about yourself is a
                    decision you make for each relationship — and either of you can change it at any
                    time. Your baseline data is never sent to another person: they only see your name,
                    your role, and the answer AI gives for questions about you both.
                  </p>
                  <p>Removing a connection stops all sharing in both directions immediately.</p>
                </div>
              </Section>

              <Button variant="outline" className="w-full" onClick={() => router.push("/account")}>
                Back to account
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}