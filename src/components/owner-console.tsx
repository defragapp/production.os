"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { LoadingScreen } from "@/components/ui/loading";
import { formatD1Date } from "@/lib/utils";

/**
 * The Owner Console. Rendered inside /account for everyone, but it self-gates:
 * it fetches /api/owner/overview, and a non-owner gets the same 404 an unknown
 * path returns — so nothing renders, and the surface's existence is not
 * observable from outside. Only the verified owner account ever sees this.
 */
interface Grant {
  codeHashTail: string;
  durationDays: number;
  maxRedemptions: number;
  redeemedCount: number;
  redeemed: boolean;
  note: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  open: boolean;
  revokeKey: string;
}

interface DunningAccount {
  customerId: string;
  email: string | null;
  lastNudgeAt: number | null;
}

interface Overview {
  metrics: {
    totalUsers: number;
    verifiedUsers: number;
    baselinesCompleted: number;
    journeysActive: number;
    journeysComplete: number;
    tiers: { free: number; paidPlus: number; giftedPlus: number };
    turnsToday: number;
    modelErrorsToday: number;
  };
  /** Live `dunning:*` KV stamps — paid accounts that missed a payment recently. */
  billing?: { dunningCount: number; dunning: DunningAccount[] };
  /** Gift-pass funnel: minted vs claimed vs still open. */
  promos?: { minted: number; claimed: number; redemptions: number; revoked: number; open: number };
  grants: Grant[];
  lookup: unknown;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel px-4 py-3">
      <div className="font-mono text-xl tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{label}</div>
    </div>
  );
}

export function OwnerConsole() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"checking" | "hidden" | "ready" | "error">("checking");

  // Mint form.
  const [minting, setMinting] = useState(false);
  const [note, setNote] = useState("");
  const [mintedLink, setMintedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Email lookup.
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<unknown>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/overview");
      // 404 = not the owner (or no session). Render nothing, silently.
      if (res.status === 404 || res.status === 401) {
        setState("hidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      setData((await res.json()) as Overview);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The console is invisible to everyone but the owner, so a non-owner's page
  // must not show a loading flash before the 404 resolves to nothing.
  if (state === "checking") return null;
  if (state === "hidden") return null;

  const handleMint = async () => {
    setMinting(true);
    setMintedLink(null);
    setCopied(false);
    try {
      const res = await fetch("/api/owner/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const d = await res.json() as { link?: string; error?: string };
      if (res.ok && d.link) setMintedLink(d.link);
    } catch {
      /* surfaced below as a stayed-empty state */
    } finally {
      setMinting(false);
    }
  };

  const copyLink = async () => {
    if (!mintedLink) return;
    try {
      await navigator.clipboard.writeText(mintedLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async (codeHash: string) => {
    await fetch("/api/owner/promo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeHash }),
    });
    await load();
  };

  const handleLookup = async () => {
    const email = lookupEmail.trim();
    if (!email) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/owner/overview?email=${encodeURIComponent(email)}`);
      const d = await res.json() as { lookup?: unknown };
      setLookupResult(d.lookup ?? null);
    } catch {
      setLookupResult({ error: "lookup_failed" });
    } finally {
      setLookingUp(false);
    }
  };

  if (state === "error") {
    return (
      <Section title="Owner Console" description="Couldn't load platform metrics.">
        <Button variant="outline" onClick={() => { setState("checking"); void load(); }}>Retry</Button>
      </Section>
    );
  }

  const m = data?.metrics;

  return (
    <Section title="Owner Console" description="Live platform signals and gift-pass tools — visible only to you.">
      <div className="space-y-5">
        {m ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Total users" value={m.totalUsers} />
              <Metric label="Verified" value={m.verifiedUsers} />
              <Metric label="Baselines done" value={m.baselinesCompleted} />
              <Metric label="Journeys active" value={m.journeysActive} />
              <Metric label="Free" value={m.tiers.free} />
              <Metric label="Paid Sovereign+" value={m.tiers.paidPlus} />
              <Metric label="Gifted (live)" value={m.tiers.giftedPlus} />
              <Metric label="Journeys complete" value={m.journeysComplete} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="AI turns today" value={m.turnsToday} />
              <Metric label="Model errors today" value={m.modelErrorsToday} />
              <Metric label="Payment issues (14d)" value={data?.billing?.dunningCount ?? 0} />
              <Metric label="Passes open / minted" value={`${data?.promos?.open ?? 0} / ${data?.promos?.minted ?? 0}`} />
            </div>
          </>
        ) : (
          <LoadingScreen className="py-6" label="Loading metrics" />
        )}

        {/* ── Payment issues (dunning) ────────────────────────── */}
        {(data?.billing?.dunning.length ?? 0) > 0 && (
          <div className="glass-panel space-y-2 p-4">
            <p className="text-sm font-medium text-foreground">Accounts with a failed payment (last 14 days)</p>
            <ul className="space-y-1">
              {(data?.billing?.dunning ?? []).slice(0, 10).map((d) => (
                <li key={d.customerId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{d.email ?? d.customerId}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {d.lastNudgeAt ? `nudge ${formatD1Date(new Date(d.lastNudgeAt).toISOString())}` : "awaiting retry"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Stripe Smart Retries keeps charging; the tier holds during the window. A raised count means invoices,
              not your code — check Stripe&rsquo;s dunning reports before anything here.
            </p>
          </div>
        )}

        {/* ── Gift-pass funnel ────────────────────────────────── */}
        {data?.promos && data.promos.minted > 0 && (
          <p className="text-xs text-muted-foreground">
            Gift passes: {data.promos.minted} minted · {data.promos.claimed} claimed
            ({data.promos.redemptions} redemptions) · {data.promos.open} still open
            {data.promos.revoked > 0 ? ` · ${data.promos.revoked} revoked` : ""}.
          </p>
        )}

        {/* ── Mint a 30-day pass ─────────────────────────────────────── */}
        <div className="glass-panel space-y-3 p-4">
          <p className="text-sm font-medium text-foreground">Mint a 30-day Sovereign+ pass</p>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note — who is this for?"
            maxLength={80}
            aria-label="Pass note"
          />
          <Button className="w-full" onClick={handleMint} disabled={minting}>
            {minting ? "Minting…" : "Mint pass link"}
          </Button>
          {mintedLink && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Copy this link now — it is shown only once and cannot be retrieved after.
              </p>
              <p className="break-all font-mono text-xs text-foreground">{mintedLink}</p>
              <Button variant="outline" className="w-full" onClick={copyLink}>
                {copied ? "Copied for iMessage / Email ✓" : "Copy link for iMessage / Email"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Issued passes ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Issued passes</p>
          {(data?.grants ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No passes minted yet.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.grants ?? []).map((g) => (
                <li key={g.revokeKey} className="glass-panel flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {g.note || <span className="text-muted-foreground">Pass · …{g.codeHashTail}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.durationDays}d · {g.redeemedCount}/{g.maxRedemptions} redeemed ·{" "}
                      {g.revokedAt ? "revoked" : g.open ? (g.redeemed ? "claimed" : "open") : "closed"}
                      {g.expiresAt ? ` · link ends ${formatD1Date(g.expiresAt)}` : ""}
                    </p>
                  </div>
                  {g.open && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleRevoke(g.revokeKey)}>
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Account lookup ─────────────────────────────────────────── */}
        <div className="glass-panel space-y-3 p-4">
          <p className="text-sm font-medium text-foreground">Look up an account</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="user@email.com"
              inputMode="email"
              aria-label="Lookup email"
              className="sm:flex-1"
            />
            <Button variant="outline" onClick={handleLookup} disabled={lookingUp}>
              {lookingUp ? "Checking…" : "Inspect"}
            </Button>
          </div>
          {lookupResult != null && typeof lookupResult === "object" && "email" in (lookupResult as Record<string, unknown>) && (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs text-foreground">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </Section>
  );
}
