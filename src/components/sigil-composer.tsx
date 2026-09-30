"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sigil } from "@/components/sigil";
import {
  SIGIL_INTENTS,
  ACTIVE_SIGIL_KEY,
  type SigilIntentId,
} from "@/lib/sigil";

interface ShareResult {
  url: string;
  seed: number;
  intent: SigilIntentId;
  label: string;
  sentence: string;
}

/**
 * The Intent Sigil composer. A person chooses a state they are holding, mints a
 * shareable crest seeded from their own Baseline, and takes the link with them.
 * The crest preview reuses the exact server seed the share link encodes, so what
 * you see here is byte-for-byte what your friend sees in the preview card.
 */
export function SigilComposer() {
  const [intentId, setIntentId] = useState<SigilIntentId>("grounded");
  const [includeName, setIncludeName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const create = useCallback(async () => {
    setBusy(true);
    setNote(null);
    setCopied(false);
    try {
      const res = await fetch("/api/sigil/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intentId, includeName }),
      });
      const data = (await res.json()) as Partial<ShareResult> & { error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't create your Sigil just now.");
      const share: ShareResult = {
        url: data.url,
        seed: data.seed as number,
        intent: data.intent as SigilIntentId,
        label: data.label as string,
        sentence: data.sentence as string,
      };
      setResult(share);
      // Remember the state you're holding, on this device only.
      try {
        localStorage.setItem(ACTIVE_SIGIL_KEY, JSON.stringify({ intentId: share.intent, seed: share.seed, label: share.label }));
      } catch {}
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }, [intentId, includeName]);

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      setNote("Couldn't copy the link on this device.");
    }
  }, [result]);

  const shareNative = useCallback(async () => {
    if (!result) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Intent Sigil", text: result.sentence, url: result.url });
      } catch {
        /* a dismissed share sheet is not an error */
      }
      return;
    }
    void copy();
  }, [result, copy]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SIGIL_INTENTS.map((intent) => {
          const active = intent.id === intentId;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => { setIntentId(intent.id); setResult(null); }}
              aria-pressed={active}
              className={`flex min-h-[44px] items-center justify-center rounded-panel border px-3 text-sm transition-colors duration-200 ${
                active
                  ? "border-foreground/30 bg-white/[0.06] text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {intent.label}
            </button>
          );
        })}
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeName}
          onChange={(e) => setIncludeName(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Show my display name on the shared Sigil
      </label>

      <div className="flex min-h-[176px] items-center justify-center rounded-panel border border-white/[0.06] bg-surface-1/40 p-4">
        {result ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-foreground">
              <Sigil seed={result.seed} intentId={result.intent} size={96} title={`Your ${result.label} Sigil`} />
            </div>
            <p className="max-w-[16rem] text-sm text-foreground">{result.sentence}</p>
            <p className="break-all font-mono text-[11px] text-muted-foreground/70">{result.url}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/70">
            Choose a state, then create your Sigil to share it.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="sm:flex-1" onClick={() => void create()} disabled={busy}>
          {busy ? "Creating…" : result ? "Create again" : "Create my Sigil"}
        </Button>
        {result && (
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void copy()}>
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
            </Button>
            <Button variant="outline" onClick={() => void shareNative()}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        )}
      </div>

      {note && <p role="alert" className="text-xs text-destructive">{note}</p>}
    </div>
  );
}
