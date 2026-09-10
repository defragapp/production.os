"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ChatMessage, BaselineData } from "@/lib/types";

interface MessageWithBaseline extends ChatMessage { baselineData?: BaselineData; }

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithBaseline[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [baselineData, setBaselineData] = useState<BaselineData | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json();
        if (!authData.user) { router.push("/onboard"); return; }
        const baselineRes = await fetch("/api/baseline");
        if (baselineRes.ok) {
          const bd = await baselineRes.json();
          if (!bd.baseline || !bd.baseline.nasa_jpl_json_data) { router.push("/onboard"); return; }
          try { setBaselineData(JSON.parse(bd.baseline.nasa_jpl_json_data)); } catch {}
        }
        const threadsRes = await fetch("/api/threads");
        if (threadsRes.ok) {
          const threadsData = await threadsRes.json();
          const threads = threadsData.threads || [];
          if (threads.length > 0) {
            const latestThread = threads[0];
            const threadRes = await fetch(`/api/threads?id=${latestThread.id}`);
            if (threadRes.ok) {
              const threadData = await threadRes.json();
              if (threadData.thread?.messages) {
                const restoredMessages: MessageWithBaseline[] = threadData.thread.messages.map((m: ChatMessage) => ({ ...m, baselineData: m.role === "assistant" ? undefined : undefined }));
                setMessages(restoredMessages);
                setThreadId(latestThread.id);
              }
            }
          }
        }
      } catch { router.push("/onboard"); } finally { setAuthChecked(true); }
    })();
  }, [router]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage: MessageWithBaseline = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    const assistantMessage: MessageWithBaseline = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMessages.map((m) => ({ role: m.role, content: m.content })), threadId: threadId || undefined }) });
      if (!response.ok) {
        const err = await response.json();
        setMessages((prev) => { const updated = [...prev]; updated[updated.length - 1] = { role: "assistant", content: `Error: ${err.error || "Something went wrong."}` }; return updated; });
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
              if (parsed.threadId) { setThreadId(parsed.threadId); continue; }
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: updated[updated.length - 1].content + parsed.content, baselineData };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => { const updated = [...prev]; updated[updated.length - 1] = { role: "assistant", content: "Error: Could not connect to the server." }; return updated; });
    } finally { setIsStreaming(false); }
  }, [input, isStreaming, messages, threadId, baselineData]);

  if (!authChecked) return (<main className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></main>);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4"><h1 className="text-xl font-semibold">Sovereign OS</h1></header>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (<div className="flex h-full items-center justify-center pt-20"><p className="text-muted-foreground">Start a conversation to synthesize your emotional expression.</p></div>)}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && msg.baselineData && msg.content && (
                  <Accordion type="single" collapsible className="mt-3 border-t pt-2">
                    <AccordionItem value="baseline" className="border-b-0">
                      <AccordionTrigger className="text-xs opacity-70 hover:opacity-100">View Baseline Data</AccordionTrigger>
                      <AccordionContent><pre className="max-h-64 overflow-auto rounded-md bg-background/50 p-3 text-xs">{JSON.stringify(msg.baselineData, null, 2)}</pre></AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="border-t px-4 py-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type your message..." disabled={isStreaming} />
          <Button onClick={sendMessage} disabled={isStreaming || !input.trim()}>{isStreaming ? "..." : "Send"}</Button>
        </div>
      </div>
    </main>
  );
}
