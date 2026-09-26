"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/turnstile";

const TOPICS = ["General", "Billing & subscription", "Account & sign-in", "Baseline data", "Relationships", "AI answers", "Privacy", "Bug report"];

export function SupportForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tsFailed, setTsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="glass-panel p-8">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Message sent</p>
        <h2 className="mt-2 font-display text-2xl font-normal text-foreground">We received it.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Thanks for reaching out. Someone will get back to you at <strong className="text-foreground">{email}</strong>.
          Your message stays private and is only used to answer your question.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topic: topic.trim(),
          message: message.trim(),
          turnstileToken: turnstileSiteKey ? turnstileToken : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setTurnstileToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-name">Your name</Label>
          <Input id="support-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-email">Email for the reply</Label>
          <Input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-topic">Topic</Label>
        <select
          id="support-topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select a topic…</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-message">What&apos;s happening?</Label>
        <textarea
          id="support-message"
          required
          minLength={10}
          maxLength={6000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A few words about what you need help with…"
          className="flex min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {turnstileSiteKey && !tsFailed && (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={setTurnstileToken}
          onError={() => { setTsFailed(true); setTurnstileToken(null); }}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="btn-aurora inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send message"}
      </button>

      <p className="text-center text-xs leading-5 text-muted-foreground/70">
        Goes straight to the Sovereign team — never a third party.
      </p>
    </form>
  );
}