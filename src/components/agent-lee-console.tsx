"use client";

import { useMemo, useState } from "react";
import { ArrowUp, RefreshCw } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

const QUICK_PROMPTS = [
  "Summarize the launch risks in priority order.",
  "Give me the next three checks before a public release.",
  "Review the route and worker wiring for anything unfinished.",
];

export function AgentLeeConsole() {
  const initialMessages = useMemo<ChatMessage[]>(
    () => [
      {
        role: "assistant",
        content:
          "I’m Agent Lee. I’ll review launch readiness, Cloudflare wiring, and the next smallest step, and I’ll keep it concise.",
      },
    ],
    [],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(messageText: string) {
    const content = messageText.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setPrompt("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/agent-lee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Agent Lee couldn't answer right now.");
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: "I couldn't reach the Gateway just now. Try again in a moment.",
          },
        ]);
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply ?? "" }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent Lee couldn't answer right now.";
      setError(message);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "I couldn't reach the Gateway just now. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass-panel rounded-panel border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Agent Lee</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            A launch-focused console for direct checks, route review, and clear next steps.
          </p>
        </div>
        {loading && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Thinking
          </span>
        )}
      </div>

      <div className="space-y-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "assistant"
                ? "max-w-[92%] rounded-panel rounded-tl-sm bg-white/[0.05] p-3.5 text-sm leading-7 text-foreground md:max-w-[80%]"
                : "ml-auto max-w-[92%] rounded-panel rounded-br-sm bg-primary px-3.5 py-3 text-sm leading-7 text-primary-foreground md:max-w-[80%]"
            }
          >
            {message.content}
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-muted-foreground">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => void submit(item)}
            disabled={loading}
            className="tap-line rounded-full border border-border/70 bg-background/40 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground disabled:opacity-60"
          >
            {item}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(prompt);
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ask Agent Lee to review launch readiness, routes, or Cloudflare wiring"
          className="min-h-[84px] flex-1 rounded-panel border border-border/70 bg-background/50 px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="btn-focal inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          Send
        </button>
      </form>
    </section>
  );
}

