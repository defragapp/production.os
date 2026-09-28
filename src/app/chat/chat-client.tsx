"use client";
import type React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Plus, Square, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineDrawer } from "@/components/baseline-drawer";
import { RichText } from "@/components/rich-text";
import { ShareCardButton } from "@/components/share-card";
import type { ChatMessage, BaselineData, RelationshipView } from "@/lib/types";

interface InviteView {
  id: string;
  emailMasked: string;
  role: string;
  /** The inviter's label for who this is for ("Mom", "Alex") — may be absent. */
  name?: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface ThreadSummary {
  id: string;
  updated_at: string;
  title?: string;
  label?: string;
}

function threadLabel(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content;
  return first ? (first.length > 36 ? `${first.slice(0, 36)}…` : first) : "Untitled thread";
}

function formatThreadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** The server clips titles at a raw character count; soften that to a word
 *  edge. `<` (not `<=`) because a title sitting exactly on the server's clip
 *  length is a mid-word cut, not a message that happened to end there. */
function clipWords(s: string, max: number): string {
  if (s.length < max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).trimEnd();
}

/** Chips stay one calm line: clip the server title at a word, not mid-word. */
function chipLabel(t: ThreadSummary): string {
  const base = t.label?.trim();
  if (!base) return formatThreadDate(t.updated_at);
  if (base.length <= 36) return base;
  return `${clipWords(base, 36)}…`;
}

// The four levels the AI already reasons across (Reflection, Meaning,
// Relationship, System), turned into the questions a person actually arrives
// with. Each seeds the composer rather than firing it — the opening is a
// scaffold to make their own, never a canned prompt to send as-is.
const STARTING_POINTS = [
  {
    level: "About me",
    prompt: "Help me see a pattern in how I show up that I might not be naming.",
  },
  {
    level: "What this means",
    prompt: "I keep saying I want more space. Help me work out what I actually mean by it.",
  },
  {
    level: "Between us",
    prompt: "There's tension with someone I love. Help me separate what happened from what I've made it mean.",
  },
  {
    level: "The whole system",
    prompt: "Help me understand the dynamic in my family — the part everyone feels but no one says out loud.",
  },
];

/**
 * "Start with what's real": the empty-state picker. On a phone it stacks; on
 * the desktop rail the compact variant lists the four levels as a navigator.
 */
function StartingPoints({
  onPick,
  disabled,
  compact,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1.5" : "mt-8 w-full"}>
      {!compact && (
        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
          Start with what&apos;s real
        </p>
      )}
      <div className={compact ? "space-y-1.5" : "mx-auto grid max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2"}>
        {STARTING_POINTS.map((p, i) => (
          <button
            key={p.level}
            type="button"
            onClick={() => onPick(p.prompt)}
            disabled={disabled}
            style={compact ? undefined : { animationDelay: `${120 + i * 70}ms` }}
            className={`group block w-full text-left transition-all duration-[240ms] ${
              compact
                ? "rounded-lg border border-transparent px-3 py-2 hover:border-border/60 hover:bg-white/[0.03]"
                : `msg-in rounded-panel border border-border/60 bg-white/[0.03] p-4 hover:-translate-y-[1px] hover:border-foreground/30 hover:bg-white/[0.05]`
            }`}
          >
            <span className={`block font-mono uppercase tracking-[0.16em] text-muted-foreground/60 group-hover:text-foreground/70 ${compact ? "text-[9px]" : "text-[10px]"}`}>
              {p.level}
            </span>
            <span className={`mt-1.5 block font-display leading-snug text-foreground/90 ${compact ? "line-clamp-2 text-[13px]" : "text-[15px]"}`}>
              {p.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The assistant's side of the thread: one clean glass bubble, no avatar. */
function AssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full">
      {/* Sovereign's voice is set in the brand display serif — an answer, not
          a chat log. The user answers in sans; only one of you is an oracle. */}
      <div className="glass-panel max-w-[92%] rounded-panel rounded-tl-sm px-4 py-3 font-display text-[16px] leading-[1.7] text-foreground sm:max-w-[80%]">
        {children}
      </div>
    </div>
  );
}

/**
 * Desktop thread library: a quiet, persistent rail so members can see and
 * reach their whole history without it competing with the conversation.
 * Below lg the same choices live in the chip strip above the thread.
 */
function ThreadLibrary({
  threads,
  activeId,
  isStreaming,
  onOpen,
  onNew,
  onSeed,
}: {
  threads: ThreadSummary[];
  activeId: string | null;
  isStreaming: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSeed: (prompt: string) => void;
}) {
  return (
    <aside className="sticky top-[3.5rem] hidden h-[calc(100vh-3.5rem)] w-[264px] shrink-0 flex-col border-r border-border/70 bg-background/60 backdrop-blur-sm lg:flex">
      <div className="px-3 pt-4">
        <Button variant="outline" size="sm" onClick={onNew} disabled={isStreaming} className="w-full">
          <Plus className="h-4 w-4" />
          New thread
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4">
        <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
          Threads
        </p>
        {threads.length === 0 ? (
          <div className="px-1">
            <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground/60">
              Start with what&apos;s real — pick a level, and make the question your own.
            </p>
            <StartingPoints compact onPick={onSeed} disabled={isStreaming} />
          </div>
        ) : (
          <nav aria-label="Thread library" className="space-y-1">
            {threads.map((t) => {
              const active = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpen(t.id)}
                  disabled={isStreaming}
                  aria-current={active ? "true" : undefined}
                  className={`block w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-[240ms] ${
                    active
                      ? "border-white/10 bg-white/[0.05] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.08)]"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-white/[0.02] hover:text-foreground"
                  }`}
                >
                  <p className="line-clamp-2 text-[13px] leading-snug">
                    {t.label?.trim() || formatThreadDate(t.updated_at)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                    {formatThreadDate(t.updated_at)}
                  </p>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}

export function ChatClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [baselineData, setBaselineData] = useState<BaselineData | undefined>();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [usageBannerDismissed, setUsageBannerDismissed] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number | null }>({ used: 0, limit: null });
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [confirmingPlan, setConfirmingPlan] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [resendState, setResendState] = useState<string | null>(null);
  const [tier, setTier] = useState<"free" | "sovereign+" | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Seed the composer with a starting point and put the caret at the end, so
  // the person finishes the sentence in their own words instead of sending ours.
  const seedComposer = useCallback((prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(prompt.length, prompt.length);
      }
    });
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      if (!res.ok) return;
      const data = await res.json() as { usage?: { used: number; limit: number | null } };
      if (data.usage) setUsage(data.usage);
    } catch {}
  }, []);

  const refreshThreads = useCallback(async (): Promise<ThreadSummary[]> => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) return [];
      const data = await res.json() as { threads?: { id: string; updated_at: string; title?: string }[] };
      const items = (data.threads || []).map((t) => ({ id: t.id, updated_at: t.updated_at, title: t.title }));
      setThreads((prev) => items.map((item) => ({
        ...item,
        // Server-derived title wins (re-clipped at a word boundary); the
        // optimistic client label only bridges the window before the first
        // list refresh lands.
        label: clipWords(item.title?.trim() || "", 48) || prev.find((p) => p.id === item.id)?.label,
      })));
      return items;
    } catch {
      return [];
    }
  }, []);

  const openThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/threads?id=${id}`);
      if (!res.ok) return;
      const data = await res.json() as { thread?: { messages?: ChatMessage[] } };
      const msgs = data.thread?.messages || [];
      setMessages(msgs.map((m) => ({ ...m })));
      setThreadId(id);
      const label = threadLabel(msgs);
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)));
    } catch {}
  }, []);

  const startNewThread = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json() as { user?: { subscription_tier?: string | null; email_verified?: number | boolean } | null; usage?: { used: number; limit: number | null } };
        if (!authData.user) {
          router.push("/onboard?mode=login");
          return;
        }
        setTier(authData.user.subscription_tier === "sovereign+" ? "sovereign+" : "free");
        // Surface the verification nudge up front instead of letting the
        // user's first message dead-end in a 403.
        if (!authData.user.email_verified) setShowVerify(true);
        if (authData.usage) setUsage(authData.usage);
        const baselineRes = await fetch("/api/baseline");
        if (baselineRes.ok) {
          const bd = await baselineRes.json() as { baseline?: { nasa_jpl_json_data?: string } };
          if (!bd.baseline || !bd.baseline.nasa_jpl_json_data) {
            router.push("/baseline?from=chat");
            return;
          }
          try {
            setBaselineData(JSON.parse(bd.baseline.nasa_jpl_json_data));
          } catch {}
        }
        const items = await refreshThreads();
        if (items.length > 0) {
          await openThread(items[0].id);
        }
      } catch {
        router.push("/onboard?mode=login");
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [router, refreshThreads, openThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Usage should self-heal without a page reload: if the daily window rolls
  // over or the plan changes while this tab sits backgrounded, revalidating on
  // re-focus unlocks the composer (or updates the meter) the moment you return.
  useEffect(() => {
    const revalidate = () => { void refreshUsage(); };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [refreshUsage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      setBillingSuccess(true);
      params.delete("billing");
      const qs = params.toString();
      history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, []);

  // After checkout, Stripe's webhook flips the tier asynchronously — so the tier
  // we fetched on mount can still read "free" even though payment succeeded.
  // Rather than assert "you're upgraded" (and risk being wrong), poll /api/auth
  // for a short window (it also reconciles against Stripe) and unlock only once
  // the server actually reports sovereign+.
  useEffect(() => {
    if (!billingSuccess || tier === "sovereign+") {
      setConfirmingPlan(false);
      return;
    }
    setConfirmingPlan(true);
    let cancelled = false;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch("/api/auth");
        if (res.ok && !cancelled) {
          const data = await res.json() as { user?: { subscription_tier?: string | null }; usage?: { used: number; limit: number | null } };
          if (data.usage) setUsage(data.usage);
          if (data.user?.subscription_tier === "sovereign+") {
            setTier("sovereign+");
            setShowUpgrade(false);
            setConfirmingPlan(false);
            clearInterval(timer);
            router.refresh();
            return;
          }
        }
      } catch {}
      if (tries >= 8) { clearInterval(timer); if (!cancelled) setConfirmingPlan(false); }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [billingSuccess, tier, router]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    const userMessage: ChatMessage = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const startedNewThread = threadId === null;
    let createdThreadId: string | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          threadId: threadId || undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json() as { error?: string; upgradeRequired?: boolean; code?: string };
        if (response.status === 402 && err.upgradeRequired) {
          setShowUpgrade(true);
          // If the gate was dismissed earlier in the session, a fresh attempt
          // to send earns a fresh look at it.
          setUsageBannerDismissed(false);
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { role: "assistant", content: err.error || "You've used today's answers — Sovereign+ picks up where this leaves off." };
            return u;
          });
          return;
        }
        if (response.status === 403 && err.code === "email_unverified") {
          setShowVerify(true);
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { role: "assistant", content: "Verify your email to keep chatting with the AI — the link is in your inbox." };
            return u;
          });
          return;
        }
        if (response.status === 403 && err.code === "baseline_required") {
          router.push("/baseline?from=chat");
          return;
        }
        if (response.status === 403 && err.code === "subscription_required") {
          router.push("/upgrade?from=baseline");
          return;
        }
        if (response.status === 401) {
          // Session expired or invalid — send the user to sign-in.
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { role: "assistant", content: "Your session has expired. Redirecting you to sign in…" };
            return u;
          });
          setTimeout(() => router.push("/onboard?mode=login"), 1200);
          return;
        }
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = { role: "assistant", content: err.error || "Something went wrong — please try again." };
          return u;
        });
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.threadId) {
                createdThreadId = parsed.threadId as string;
                setThreadId(parsed.threadId);
                continue;
              }
              if (parsed.content) {
                setMessages((prev) => {
                  const u = [...prev];
                  u[u.length - 1] = {
                    role: "assistant",
                    content: u[u.length - 1].content + parsed.content,
                  };
                  return u;
                });
              }
            } catch {}
          }
        }
      }
      if (createdThreadId) {
        const final = await refreshThreads();
        const stored = final.find((t) => t.id === createdThreadId);
        if (stored && (startedNewThread || !stored.label)) {
          const label = threadLabel([...newMessages, { role: "assistant", content: "" }]);
          setThreads((prev) => prev.map((t) => (t.id === createdThreadId ? { ...t, label } : t)));
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User pressed Stop — keep the partial response as-is.
        return;
      }
      console.error("Chat error:", err);
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: "Couldn't reach Sovereign — check your connection and try again." };
        return u;
      });
    } finally {
      abortRef.current = null;
      refreshUsage();
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, threadId, refreshThreads, refreshUsage, router]);

  if (!authChecked) {
    return (
      <>
        <Nav />
        <main id="main" className="flex min-h-screen items-center justify-center">
          <LoadingScreen label="Loading your threads" />
        </main>
      </>
    );
  }

  return (
    <main id="main" className="flex min-h-screen flex-col">
      <Nav />
      {/* App screen: the conversation itself is the content, so the page
          title exists for assistive tech only (every page carries one h1). */}
      <h1 className="sr-only">Chat with Sovereign</h1>

      {billingSuccess && (
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            {confirmingPlan ? (
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                </span>
                Confirming your payment and unlocking Sovereign+…
              </p>
            ) : (
              <p className="text-sm font-medium text-foreground">
                Welcome to Sovereign+ — your plan is active and your Baseline is now fully unlocked.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBillingSuccess(false)}
              aria-label="Dismiss"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {showVerify && (
        <div className="border-b border-border bg-surface-1 px-6 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground">
                <span className="font-medium">Verify your email to unlock AI chat.</span>{" "}
                <span className="text-muted-foreground">Check your inbox for the verification link.</span>
              </p>
              {/* A lost email can't be a dead end: name the second place to look
                  and leave a human door open. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Not there? Check spam and promotions — or{" "}
                <Link href="/support" className="underline underline-offset-2 hover:text-foreground">tell us and we&apos;ll sort it</Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {resendState?.startsWith("error:") && (
                <p className="text-xs text-destructive" role="alert">{resendState.slice(7)}</p>
              )}
              <Button
                size="sm"
                className="shrink-0"
                disabled={resendState === "sending"}
                onClick={async () => {
                  setResendState("sending");
                  try {
                    const r = await fetch("/api/auth/resend", { method: "POST" });
                    const d = await r.json() as { ok?: boolean; error?: string };
                    setResendState(d.ok ? "sent" : `error: ${d.error || "Could not send verification email."}`);
                  } catch {
                    setResendState("error: Could not send verification email.");
                  }
                }}
              >
                {resendState === "sending" ? "Sending…" : resendState === "sent" ? "Verification email sent ✓" : "Resend verification email"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ThreadLibrary
          threads={threads}
          activeId={threadId}
          isStreaming={isStreaming}
          onOpen={openThread}
          onNew={startNewThread}
          onSeed={seedComposer}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-background px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startNewThread}
                disabled={isStreaming}
                className="shrink-0 lg:hidden"
              >
                <Plus className="h-4 w-4" />
                New thread
              </Button>
              {threads.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto lg:hidden">
                  {threads.map((t) => {
                    const active = t.id === threadId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openThread(t.id)}
                        disabled={isStreaming}
                        title={t.label || undefined}
                        className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs transition-all duration-[240ms] ${
                          active
                            ? "border-foreground/30 bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]"
                            : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {chipLabel(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeopleOpen((v) => !v)}
                disabled={isStreaming}
                aria-expanded={peopleOpen}
                className="ml-auto shrink-0"
              >
                <Users className="h-4 w-4" />
                People
              </Button>
            </div>
          </div>

          {peopleOpen && <PeoplePanel tier={tier} onClose={() => setPeopleOpen(false)} />}

          {/* role="log": screen readers announce each newly appended message as a
              conversation, without re-reading the whole history. */}
          <div className="flex-1 overflow-y-auto px-4 py-6" role="log" aria-live="polite" aria-label="Conversation">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center pt-20">
                  <div className="msg-in text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
                      <Logo showWordmark={false} href="#" markClassName="h-10 w-auto" />
                    </div>
                    <p className="font-display text-2xl font-normal tracking-tight text-foreground">
                      Ask anything.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      About yourself, what you&apos;re sitting with, the people in your life — or the whole system they make.
                    </p>
                    <StartingPoints onPick={seedComposer} disabled={isStreaming} />
                  </div>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1;
                const streamingEmpty =
                  msg.role === "assistant" && isLast && isStreaming && !msg.content;
                // Stopped before the first token arrived — without this the bubble
                // would render as empty space with no explanation.
                const stoppedEmpty =
                  msg.role === "assistant" && isLast && !isStreaming && !msg.content;
                return (
                  <div
                    key={idx}
                    className={`msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="flex flex-col gap-1.5">
                        <AssistantTurn>
                          {streamingEmpty ? (
                            <>
                              <span aria-hidden="true" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-foreground/70" />
                              </span>
                              <span className="sr-only">Sovereign is thinking…</span>
                            </>
                          ) : stoppedEmpty ? (
                            <p className="text-sm text-muted-foreground">Response stopped.</p>
                          ) : (
                            <RichText text={msg.content} />
                          )}
                        </AssistantTurn>
                        {/* Every finished answer is worth keeping — the share card
                            turns a passage into an artifact the person owns. */}
                        {!isStreaming && !streamingEmpty && !stoppedEmpty && msg.content.trim() && (
                          <div>
                            <ShareCardButton text={msg.content} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-[88%] rounded-panel rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-18px_rgba(0,0,0,0.8)] sm:max-w-[80%]">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t px-4 pb-safe">
            <div className="mx-auto max-w-3xl py-4">
              {/* Overlay mode: the panel folds up as a floating popover so opening
                  it never pushes the composer off-screen. */}
              <BaselineDrawer data={baselineData} overlay />
              <div className="mt-2">
                {/* The cap, when you reach it, is one quiet card — not a meter you
                    watch drain. No counter, no countdown while messages remain:
                    premium restraint, in the exact spot the composer would falter. */}
                {(showUpgrade || (usage.limit !== null && usage.used >= usage.limit)) && !usageBannerDismissed && (
                  <div className="glass-panel msg-in mb-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4">
                    <div className="flex items-center gap-3.5">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/emblem-core-bold.png" alt="" className="h-5 w-auto" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">You&apos;ve used today&apos;s answers.</p>
                        <p className="text-xs text-muted-foreground">Sovereign+ removes the daily cap — go as deep as you need.</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => router.push("/upgrade")}>
                        Upgrade
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setUsageBannerDismissed(true)}>
                        Not now
                      </Button>
                    </div>
                  </div>
                )}
                <div className="composer-pill flex items-center gap-2 pl-5 pr-1.5 py-1.5">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    // The input never goes dead — at the cap, sending simply returns
                    // the quiet gate card above, which is far more graceful than a
                    // disabled field.
                    placeholder="Ask Sovereign…"
                    disabled={isStreaming}
                    className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                  {isStreaming ? (
                    <Button onClick={stopStreaming} variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full">
                      <Square className="h-3.5 w-3.5" />
                      <span className="sr-only">Stop</span>
                    </Button>
                  ) : (
                    <Button onClick={() => sendMessage()} disabled={!input.trim()} size="icon" className="h-11 w-11 shrink-0 rounded-full">
                      <ArrowUp className="h-4 w-4" />
                      <span className="sr-only">Send</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Keeps the composer clear of the fixed standalone tab bar (no-op in the browser). */}
      <div className="tab-bar-spacer standalone-only sm:hidden" aria-hidden="true" />
    </main>
  );
}

/**
 * The People strip in chat: who you're connected to and who you've invited.
 * Read-only summary — full label/consent control lives in /settings.
 */
function PeoplePanel({
  tier,
  onClose,
}: {
  tier: "free" | "sovereign+" | null;
  onClose: () => void;
}) {
  const [connections, setConnections] = useState<RelationshipView[] | null>(null);
  const [invites, setInvites] = useState<InviteView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [relRes, invRes] = await Promise.all([
          fetch("/api/relationships"),
          fetch("/api/invites"),
        ]);
        if (cancelled) return;
        if (relRes.ok) {
          const rd = await relRes.json() as { relationships?: RelationshipView[] };
          setConnections(rd.relationships ?? []);
        } else {
          setConnections([]);
        }
        if (invRes.ok) {
          const id = await invRes.json() as { invites?: InviteView[] };
          setInvites(id.invites ?? []);
        } else {
          setInvites([]);
        }
      } catch {
        if (!cancelled) {
          setConnections([]);
          setInvites([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-b border-border bg-background px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            People
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close people panel"
            className="text-muted-foreground transition-colors duration-[240ms] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {connections === null || invites === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connections yet. They form when an invitation is accepted — one you sent, or one you received.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((c) => (
                  <li key={c.relationId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">{c.personName}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {c.myLabel}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      {c.peerSharesBaseline
                        ? "shares their baseline with you"
                        : "hasn't shared their baseline with you"}
                      {!c.shareBaseline ? " · you're not sharing yours" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {invites.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{i.name || i.emailMasked}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {i.role}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                      {i.acceptedAt ? "accepted" : i.status === "revoked" ? "revoked" : "invited"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {tier !== "sovereign+" && (
              <p className="mt-4 text-sm text-muted-foreground">
                Inviting people is part of Sovereign+.{" "}
                <Link href="/upgrade" className="font-medium text-foreground underline underline-offset-2">
                  Upgrade
                </Link>{" "}
                to invite someone. And if someone invites you first — accepting is always free.
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/60">
              Someone you invited sees only your name and role — never your birth data. You stay in
              control of sharing in{" "}
              <Link href="/settings" className="font-medium text-foreground/80 underline underline-offset-2">
                Settings
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}