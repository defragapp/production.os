"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineSummary } from "@/components/baseline-summary";
import type { ChatMessage, BaselineData } from "@/lib/types";

interface MessageWithBaseline extends ChatMessage {
  baselineData?: BaselineData;
}

interface ThreadSummary {
  id: string;
  updated_at: string;
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

export function ChatClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithBaseline[]>([]);
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
  const [showVerify, setShowVerify] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const data = await res.json() as { threads?: ThreadSummary[] };
      const items = (data.threads || []).map((t) => ({ id: t.id, updated_at: t.updated_at }));
      setThreads((prev) => {
        const merged = items.map((item) => ({ ...item, label: prev.find((p) => p.id === item.id)?.label }));
        return merged;
      });
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
        const authData = await authRes.json() as { user?: unknown; usage?: { used: number; limit: number | null } };
        if (!authData.user) {
          router.push("/onboard?mode=login");
          return;
        }
        if (authData.usage) setUsage(authData.usage);
        const baselineRes = await fetch("/api/baseline");
        if (baselineRes.ok) {
          const bd = await baselineRes.json() as { baseline?: { nasa_jpl_json_data?: string } };
          if (!bd.baseline || !bd.baseline.nasa_jpl_json_data) {
            router.push("/baseline");
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
        router.push("/onboard");
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [router, refreshThreads, openThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage: MessageWithBaseline = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const startedNewThread = threadId === null;
    let createdThreadId: string | null = null;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          threadId: threadId || undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json() as { error?: string; upgradeRequired?: boolean; code?: string };
        if (response.status === 402 && err.upgradeRequired) {
          setShowUpgrade(true);
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { role: "assistant", content: err.error || "Free tier limit reached." };
            return u;
          });
          return;
        }
        if (response.status === 403 && err.code === "email_unverified") {
          setShowVerify(true);
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { role: "assistant", content: "Please verify your email address to use AI chat. Check your inbox for the verification link." };
            return u;
          });
          return;
        }
        if (response.status === 403 && err.code === "baseline_required") {
          router.push("/baseline");
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
          u[u.length - 1] = { role: "assistant", content: `Error: ${err.error || "Something went wrong."}` };
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
                    baselineData,
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
      console.error("Chat error:", err);
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: "Error: Could not connect to the server." };
        return u;
      });
    } finally {
      refreshUsage();
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, threadId, baselineData, refreshThreads, refreshUsage, router]);

  if (!authChecked) {
    return (
      <>
        <Nav />
        <main className="flex min-h-screen items-center justify-center">
          <LoadingScreen label="Loading your threads" />
        </main>
      </>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Nav />

      {billingSuccess && (
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">
              Welcome to Sovereign+ — your plan is active and your baseline is now fully unlocked.
            </p>
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
        <div className="border-b bg-background px-6 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Verify your email address to unlock AI chat. Check your inbox for the verification link.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const r = await fetch("/api/auth/resend", { method: "POST" });
                  const d = await r.json() as { ok?: boolean; error?: string };
                  alert(d.ok ? "Verification email sent. Please check your inbox." : d.error || "Could not send verification email.");
                } catch {
                  alert("Could not send verification email.");
                }
              }}
            >
              Resend verification email
            </Button>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">
              You have reached the free tier limit. Upgrade to Sovereign+ for unlimited access.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => router.push("/upgrade")}>
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      )}

      {(usage.limit !== null && usage.used >= usage.limit && !showUpgrade && !usageBannerDismissed) && (
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">
              You&apos;ve used all {usage.limit} free messages today. Upgrade to Sovereign+ for unlimited access.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => router.push("/upgrade")}>
                Upgrade
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUsageBannerDismissed(true)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {threads.length > 0 || threadId ? (
        <div className="border-b border-border bg-background px-4 pt-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={startNewThread}
              disabled={isStreaming}
              className="mb-[1px] shrink-0"
            >
              <Plus className="h-4 w-4" />
              New thread
            </Button>
            <div className="flex items-end gap-1 overflow-x-auto">
              {threads.map((t) => {
                const active = t.id === threadId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openThread(t.id)}
                    disabled={isStreaming}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors duration-[240ms] ${
                      active
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {t.label || formatThreadDate(t.updated_at)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center pt-20">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-muted/40">
                  <Logo showWordmark={false} href="#" />
                </div>
                <p className="font-display text-2xl font-normal tracking-tight text-foreground">
                  Ask anything.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Start a conversation to synthesize your emotional expression.
                </p>
                <p className="mt-1 text-sm text-muted-foreground/60">
                  Your baseline is loaded — the AI will reference it as you chat.
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const streamingEmpty =
              msg.role === "assistant" && isLast && isStreaming && !msg.content;
            return (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {streamingEmpty ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                      <span className="ml-1">Thinking…</span>
                    </span>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                      {msg.role === "assistant" && msg.baselineData && msg.content && (
                        <BaselineSummary data={msg.baselineData} />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {usage.limit !== null && (
            <div className="mb-1 flex items-center justify-end gap-2.5">
              <span className="text-xs text-muted-foreground/70">
                {usage.used >= usage.limit
                  ? `${usage.limit} of ${usage.limit} free messages used today`
                  : `${usage.used} of ${usage.limit} free messages used today`}
              </span>
              <div className="h-[3px] w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/50 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                usage.limit !== null && usage.used >= usage.limit
                  ? "Free tier limit reached — upgrade for unlimited access"
                  : "Type your message..."
              }
              disabled={isStreaming || (usage.limit !== null && usage.used >= usage.limit && !showUpgrade)}
            />
            <Button onClick={sendMessage} disabled={isStreaming || !input.trim()}>
              {isStreaming ? "..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}