"use client";
import type React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Compass, Globe, Lock, Mic, MicOff, Plus, RefreshCw, Search, Shield, Square, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { LoadingScreen } from "@/components/ui/loading";
import { BaselineDrawer } from "@/components/baseline-drawer";
import { RichText } from "@/components/rich-text";
import { ShareCardButton } from "@/components/share-card";
import { Sigil } from "@/components/sigil";
import { ACTIVE_SIGIL_KEY, getSigilIntent, sigilSeedFromId, type ActiveSigil } from "@/lib/sigil";
import { JourneyBar, PastJourneysSheet, MILESTONE_STEP_LABELS } from "@/components/journey-canvas";
import { useJourney } from "@/lib/journey-store";
import { useDictation } from "@/lib/dictation";
import { keyboardPinHeight } from "@/lib/viewport";
import { parseD1Date } from "@/lib/utils";
import type { JourneyState } from "@/lib/sovereign-journey";
import type { ChatMessage, BaselineData, MemoryMode, RelationshipView } from "@/lib/types";

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
  // The arc this conversation is carrying, joined server-side from journeys.
  // Present only when the thread links a stored journey row; null otherwise,
  // which the library reads as "no badge" rather than a placeholder.
  journey_goal?: string | null;
  journey_status?: string | null;
  journey_step?: string | null;
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

/** Recency a returning person actually wants: "4h ago" for today, "3d ago"
 *  for this week, the dated stamp only past a week. D1 stores `updated_at` as
 *  UTC without a zone marker, so it is anchored through parseD1Date before the
 *  subtraction — a raw `new Date()` reads it as local time and every age drifts
 *  by the viewer's offset. The thread list is fetched client-side, so this never
 *  paints on the server and cannot introduce a hydration mismatch. */
function relativeThreadDate(iso: string): string {
  const then = parseD1Date(iso)?.getTime();
  if (then === undefined || !Number.isFinite(then)) return formatThreadDate(iso);
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatThreadDate(iso);
}

// The canonical five-step order, so a linked arc can be named by where it
// stands, not only what it is about. Mirrors DEFAULT_JOURNEY_STEPS ids.
const JOURNEY_STEP_ORDER = ["surface-signal", "name-what-landed", "separate-the-parts", "widen-the-frame", "grounded-next-step"];

/** The linked arc in the few words a library row can hold — where it stands and
 *  what it is about, or that it is finished. No goal means no badge is drawn at
 *  all, so an unlinked thread never wears a borrowed journey. */
function journeyBadge(t: ThreadSummary): string | null {
  if (!t.journey_goal) return null;
  if (t.journey_status === "complete") return "Journey complete";
  const goal = t.journey_goal.trim();
  if (!goal) return null;
  const idx = t.journey_step ? JOURNEY_STEP_ORDER.indexOf(t.journey_step) : -1;
  const step = idx >= 0 ? `Step ${idx + 1} of ${JOURNEY_STEP_ORDER.length} · ` : "";
  return `${step}${goal.length > 40 ? `${clipWords(goal, 40)}…` : goal}`;
}

// The four levels the AI already reasons across (Reflection, Meaning,
// Relationship, System), turned into the questions a person actually arrives
// with. Each seeds the composer rather than firing it — the opening is a
// scaffold to make their own, never a canned prompt to send as-is.
const STARTING_POINTS = [
  {
    level: "About me",
    prompt: "Help me see what keeps happening in how I show up that I might not be naming.",
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
        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
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
            <span className={`block font-mono uppercase tracking-[0.16em] text-muted-foreground/70 group-hover:text-foreground/70 ${compact ? "text-[9px]" : "text-[10px]"}`}>
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
        <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Threads
        </p>
        {threads.length === 0 ? (
          <div className="px-1">
            <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground/70">
              Start with what&apos;s real — pick a level, and make the question your own.
            </p>
            <StartingPoints compact onPick={onSeed} disabled={isStreaming} />
          </div>
        ) : (
          <nav aria-label="Thread library" className="space-y-1">
            {threads.map((t) => {
              const active = t.id === activeId;
              const badge = journeyBadge(t);
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
                    {t.label?.trim() || "Untitled thread"}
                  </p>
                  {badge && (
                    <p className="journey-thread-badge mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      <Compass className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{badge}</span>
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                    {relativeThreadDate(t.updated_at)}
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
  const [memoryMode, setMemoryMode] = useState<MemoryMode>("server");
  const [userScope, setUserScope] = useState("");
  const [memoryMenuOpen, setMemoryMenuOpen] = useState(false);
  const [memorySwitching, setMemorySwitching] = useState(false);
  const [memoryNote, setMemoryNote] = useState<string | null>(null);
  const [journeyDismissed, setJourneyDismissed] = useState(false);
  // The veil is an overlay, so its taller view is a choice, never a surprise:
  // the journey arrives as the compact summary band (exactly the space the
  // transcript reserves above its first row) and the canvas + step list only
  // appear when tapped. `journeyVisible` is the reveal itself — deferred one
  // frame after the bar mounts so the veil always transitions from a painted
  // closed state, which is what keeps its arrival at CLS 0.0000.
  const [journeyVisible, setJourneyVisible] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(false);
  // Offered once, in the empty state of a brand-new conversation: "this thread
  // will carry on with the journey already running — or you can start a fresh
  // one". Two topics fused to one five-step arc is the dead end this undoes.
  const [freshOffer, setFreshOffer] = useState(false);
  // The archive is opened, not navigated to: a person finishing an arc should be
  // able to see the one they just closed without leaving the conversation.
  const [pastOpen, setPastOpen] = useState(false);
  // ── Semantic recall (Workers Paid / Vectorize) ────────────────────
  // A slide-down panel above the transcript that turns a natural-language
  // question ("what did we say about sleep last month?") into ranked
  // snippets from server-memory threads. Debounced 350ms; the search
  // endpoint itself is rate-limited to 20/min, and the panel is inert
  // for Device-Only accounts (nothing to index). `indexed` reflects
  // whether *any* vectors exist for this user yet, so the empty-state
  // copy can differentiate "you have no matches for this phrase" from
  // "your history has not been embedded yet — start chatting".
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ threadId: string; turnIndex: number; role: "user" | "assistant"; snippet: string; score: number; updatedAt: string | null }> | null
  >(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIndexed, setSearchIndexed] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  // The exact text of a turn that couldn't be delivered, plus why: `unreachable`
  // never got an answer at all (dropped connection, 429, 503), `incomplete` means
  // the stream opened and then died before an answer arrived. Holding it lets us
  // offer a one-tap "Try again" that re-sends the same message without
  // duplicating it in the transcript — the user's words are never lost.
  const [failedTurn, setFailedTurn] = useState<{ text: string; kind: "unreachable" | "incomplete" } | null>(null);
  const [offline, setOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Milestones are announced once per identity, not once per state frame —
  // assistive tech hears a fresh unlock, never a re-read of the whole bar.
  const announcedMilestones = useRef<Set<string>>(new Set());
  const [milestoneAnnouncement, setMilestoneAnnouncement] = useState("");

  // The journey bar earns its place back with progress, not nagging: dismissal
  // is session-local, and the next confirmed unlock quietly re-reveals it.
  const revealJourney = useCallback(() => setJourneyDismissed(false), []);
  const { view: journey, past, selectLinked, applyStateFrame, applyControl, completeJourney, startFreshJourney } = useJourney(memoryMode, userScope, revealJourney);

  // The veil's own box, so the page can ask it how much is out of reach, and
  // the transcript's scroller, so switching conversations can send the caret
  // reader back to the top instead of leaving them mid-thread.
  const veilRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // True while the expanded panel is capped AND there are still steps below the
  // fold — the only signal that a clipped row is more to read, not a bug.
  const [veilHasMore, setVeilHasMore] = useState(false);

  // ── Voice dictation, on the browser's own speech engine ─────────
  // The engine owns the whole composer string while it runs, because the words
  // it is still guessing must be replaceable: `base + finalized + provisional`
  // is painted as one value, so a guess becomes its finalized form without ever
  // appearing twice. Words land in the same draft typed words live in — same
  // localStorage mirror, same auto-grow — and nothing leaves the device until
  // Send. Browsers without the API never see the control at all.
  const draftValueRef = useRef("");
  useEffect(() => {
    draftValueRef.current = input;
  }, [input]);
  const readDraft = useCallback(() => draftValueRef.current, []);
  const writeDraft = useCallback((text: string) => setInput(text), []);
  const {
    supported: dictationSupported,
    listening: dictating,
    previewing: dictationPreview,
    notice: dictationNotice,
    toggle: toggleDictation,
    stop: stopDictation,
  } = useDictation({ getDraft: readDraft, setDraft: writeDraft });

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
      const data = await res.json() as { threads?: { id: string; updated_at: string; title?: string; journey_goal?: string | null; journey_status?: string | null; journey_step?: string | null }[] };
      const items = (data.threads || []).map((t) => ({ id: t.id, updated_at: t.updated_at, title: t.title, journey_goal: t.journey_goal ?? null, journey_status: t.journey_status ?? null, journey_step: t.journey_step ?? null }));
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

  // Thread switching is a navigation, and a navigation must not carry the
  // previous page's transient state with it: an armed retry banner whose
  // "Try again" would otherwise re-send thread A's words into thread B, an
  // expanded step panel belonging to a different conversation, a scroll
  // position left mid-thread, and a microphone still open. The draft
  // deliberately survives — it belongs to the person, not to a thread.
  const clearThreadContext = useCallback(() => {
    setFailedTurn(null);
    setJourneyExpanded(false);
    setVeilHasMore(false);
    setFreshOffer(false);
    setPastOpen(false);
    stopDictation();
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [stopDictation]);

  // The canvas follows the conversation: a thread that carries a `journey_id`
  // shows that journey, and an unlinked thread (or one whose journey row was
  // deleted) falls back to the active journey rather than keeping the previous
  // thread's steps on screen.
  const journeyIdRef = useRef<string | null>(null);
  // The hook's reader changes identity as the account and memory mode resolve;
  // hold it in a ref so the callbacks below stay stable — otherwise the mount
  // effect would re-run and open a thread twice.
  const selectLinkedRef = useRef(selectLinked);
  useEffect(() => {
    selectLinkedRef.current = selectLinked;
  }, [selectLinked]);

  const linkJourneyToThread = useCallback(async (journeyId: string | null) => {
    const next = await selectLinkedRef.current(journeyId);
    const previous = journeyIdRef.current;
    if (next && previous && next.id !== previous) {
      // A journey the person has never seen earns its place back: dismissal is
      // per journey, not a permanent mute for the whole account.
      setJourneyDismissed(false);
    }
    journeyIdRef.current = next?.id ?? null;
  }, []);

  const openThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/threads?id=${id}`);
      if (!res.ok) return;
      const data = await res.json() as { thread?: { messages?: ChatMessage[]; journey_id?: string | null } };
      const msgs = data.thread?.messages || [];
      clearThreadContext();
      setMessages(msgs.map((m) => ({ ...m })));
      setThreadId(id);
      const label = threadLabel(msgs);
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)));
      await linkJourneyToThread(data.thread?.journey_id ?? null);
    } catch {}
  }, [clearThreadContext, linkJourneyToThread]);

  // Open a thread from a search hit and scroll the referenced turn into the
  // middle of the viewport, flashing a short highlight so the eye can find
  // it. Two nested rAFs: the first lets setMessages commit, the second lets
  // the transcript paint before we ask the browser to scroll — otherwise
  // the anchor node does not yet exist and the call is silently a no-op.
  const jumpToTurn = useCallback(async (targetThreadId: string, turnIndex: number) => {
    setSearchOpen(false);
    await openThread(targetThreadId);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(`[data-turn="${turnIndex}"]`);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("turn-highlight");
      window.setTimeout(() => node.classList.remove("turn-highlight"), 1800);
    }));
  }, [openThread]);

  // Debounced semantic search. Every keystroke resets the pending request
  // via AbortController; the network call itself fires 350ms after typing
  // stops. Escape closes the panel; empty/short queries clear results
  // without a fetch.
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      return;
    }
    setSearchLoading(true);
    const timeoutId = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      try {
        const res = await fetch("/api/chat/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, topK: 8 }),
          signal: ac.signal,
        });
        if (!res.ok) {
          setSearchResults([]);
          setSearchIndexed(false);
          return;
        }
        const data = await res.json() as {
          results?: Array<{ threadId: string; turnIndex: number; role: "user" | "assistant"; snippet: string; score: number; updatedAt: string | null }>;
          indexed?: boolean;
        };
        setSearchResults(data.results ?? []);
        setSearchIndexed(Boolean(data.indexed));
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setSearchResults([]);
      } finally {
        if (searchAbortRef.current === ac) setSearchLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchOpen, searchQuery]);

  const startNewThread = useCallback(() => {
    clearThreadContext();
    setMessages([]);
    setThreadId(null);
    // A fresh conversation has no journey of its own: return to the active one
    // and let the next `{ state }` frame correct it the moment the engine
    // infers something new. But a brand-new topic deserves its own arc, so the
    // choice is offered once, here, where the person is about to start typing.
    setFreshOffer(Boolean(journey) && journey?.status !== "complete");
    void linkJourneyToThread(null);
  }, [clearThreadContext, linkJourneyToThread, journey]);

  // Archive what is finished, and the next conversation starts its own arc.
  // Both memory modes reach this one call: the server PATCHes the row to
  // `complete` then mints a blank successor; the device replaces its single
  // vault record, which is the same two moves at that scale.
  const completeCurrentJourney = useCallback(() => {
    const id = journey?.id;
    if (id) void completeJourney(id);
  }, [journey?.id, completeJourney]);

  const beginFreshJourney = useCallback(async () => {
    setFreshOffer(false);
    setJourneyDismissed(false);
    await startFreshJourney(journey?.id ?? null);
  }, [journey?.id, startFreshJourney]);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json() as { user?: { id?: string; email?: string; subscription_tier?: string | null; email_verified?: number | boolean; memory_mode?: string } | null; usage?: { used: number; limit: number | null } };
        if (!authData.user) {
          router.push("/onboard?mode=login");
          return;
        }
        setTier(authData.user.subscription_tier === "sovereign+" ? "sovereign+" : "free");
        // Device-Only vaults are keyed per account: the email is stable, unique,
        // and already in the session — no extra lookup to scope local records.
        setUserScope(authData.user.email ?? authData.user.id ?? "");
        setMemoryMode(authData.user.memory_mode === "local" ? "local" : "server");
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
    // Only follow the conversation once it exists. On an empty thread this
    // would scroll past the "Ask anything" empty state to its bottom, hiding
    // the emblem and headline above the fold.
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (journey && !journeyDismissed) {
      // Defer the reveal by a frame so the veil always transitions from a
      // painted closed state — opening in the same tick as the bar's mount
      // would render as a jump instead of the slide.
      const raf = requestAnimationFrame(() => setJourneyVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setJourneyVisible(false);
  }, [journey, journeyDismissed]);

  useEffect(() => {
    // The expanded panel is capped to its own box (`max-height: 100%`), so on a
    // short viewport it scrolls internally. Mark that only while there really
    // is more below, and clear it at the bottom so the cue never lies.
    const el = veilRef.current;
    if (!el || !journeyExpanded) {
      setVeilHasMore(false);
      return;
    }
    const measure = () => {
      setVeilHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // iOS does not fire `resize` when the keys come up, and the panel's own
    // height cap just changed: `visualViewport` is the only event that says so.
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [journeyExpanded, journey]);

  // Two effortless ways to put the panel away, because reaching for "Hide steps"
  // inside the panel it just covered is the long way round: `Escape` anywhere,
  // and a tap on the conversation underneath it. Both collapse inside the
  // out-of-flow veil, so the gesture costs nothing above the fold (measured
  // CLS 0.0000).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      // The inline rename field handles its own Escape (it cancels the edit);
      // stealing it mid-name would be a worse edit than leaving the panel open.
      if (active instanceof HTMLInputElement) return;
      const wasListening = dictating;
      stopDictation();
      // Escape's first job is always the microphone; the panel waits for the
      // next press rather than folding away under someone still speaking.
      if (wasListening || !journeyExpanded) return;
      const focusWasInside = veilRef.current?.contains(active) ?? false;
      setJourneyExpanded(false);
      if (focusWasInside) {
        // The expanded controls unmount on the next commit: hand focus to the
        // compact band's own toggle instead of dropping it to <body>.
        requestAnimationFrame(() => {
          document.querySelector<HTMLButtonElement>(".journey-veil-compact button")?.focus();
        });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [journeyExpanded, dictating, stopDictation]);

  // One path for opening and closing the recall panel, shared by the header
  // button and the ⌘K / Ctrl+K shortcut below, so the two can never drift.
  const toggleSearch = useCallback(() => {
    setSearchOpen((v) => {
      const next = !v;
      if (next) requestAnimationFrame(() => searchInputRef.current?.focus());
      else { setSearchResults(null); setSearchQuery(""); }
      return next;
    });
  }, []);

  // The keyboard shortcut the desktop composer already implies: ⌘K (Ctrl+K
  // off Apple keyboards) summons the past-conversation search. It never fires
  // mid-generation — the panel can't be read while an answer is arriving —
  // and never from the composer textarea, where the person is writing, not
  // navigating. From the search field itself it closes the panel, which is
  // the same contract as the button's toggle.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (isStreaming) return;
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement) return;
      toggleSearch();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isStreaming, toggleSearch]);

  useEffect(() => {
    // Tapping the transcript means "I'm reading, not looking at steps". Bound
    // through the ref rather than a JSX prop so the scroller keeps its plain
    // `role="log"` semantics for assistive tech.
    const el = scrollerRef.current;
    if (!el || !journeyExpanded) return;
    const onClick = () => {
      // A drag that selects a sentence ends in a click too: quoting your own
      // words is not a request to fold the canvas away.
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      setJourneyExpanded(false);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [journeyExpanded]);

  useEffect(() => {
    const fresh = (journey?.newlyUnlocked ?? []).filter((m) => !announcedMilestones.current.has(m));
    if (journey && fresh.length > 0) {
      for (const m of fresh) announcedMilestones.current.add(m);
      const labels = fresh.map((m) => MILESTONE_STEP_LABELS[m] ?? m).join(", ");
      setMilestoneAnnouncement(`Milestone unlocked: ${labels}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.newlyUnlocked]);

  // ── Never lose a user's words ──────────────────────────────────
  // A draft survives reloads and a dropped cell connection: it is mirrored to
  // per-account local storage as the person types, restored on mount, and
  // cleared only once a turn is actually handed to the server (send) — so a
  // crash, refresh, or offline send never strands a half-written thought.
  const draftKey = userScope ? `sovereign-chat-draft:${userScope}` : null;
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setInput(saved);
    } catch {}
    // Restore once when the account scope becomes known.
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (input) localStorage.setItem(draftKey, input);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [input, draftKey]);

  // The composer grows with the thought, up to a sane ceiling, so a long
  // reflection stays readable on a 390px phone without the pill climbing over
  // the header or pushing the JourneyBar off-screen. Height resets on send
  // because `input` returns to empty.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [input]);

  // The software keyboard, which `100dvh` does not know about. On iOS (in the
  // browser and in standalone PWA mode) the layout viewport keeps its full
  // height while the keys cover the bottom of the screen, so a composer pinned
  // to the bottom of `100dvh` sits under the keyboard: the person types into a
  // field they can see the caret in but cannot tap. `visualViewport.height` is
  // the honest measure, so while the keys are up the shell is pinned to it and
  // the flex column hands the difference back to the transcript — which already
  // owns its own scrolling, so the caret stays in view. Rendered through state
  // rather than an imperative style write, because the shell's `style`
  // attribute also carries `--journey-progress`: React rewrites the whole
  // attribute when the journey moves, and would silently drop a height it does
  // not know about (the composer straight back under the keyboard).
  const [shellHeight, setShellHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => setShellHeight(keyboardPinHeight(window.innerHeight, vv.height));
    apply();
    vv.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  // A calm, non-intrusive offline signal, so a person never taps send into a
  // dead connection. `navigator.onLine` seeds it; the events keep it honest.
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

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

  // One-click memory-mode switch, offered right where the choice matters.
  // The server owns the preference; this tab adopts it optimistically and
  // hands the note back if the write never lands.
  const switchMemoryMode = useCallback(async (mode: MemoryMode) => {
    setMemoryMenuOpen(false);
    if (mode === memoryMode) return;
    setMemorySwitching(true);
    const prev = memoryMode;
    setMemoryMode(mode);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryMode: mode }),
      });
      if (!res.ok) {
        setMemoryMode(prev);
        const data = await res.json().catch(() => ({})) as { error?: string };
        setMemoryNote(data.error || "Couldn't change memory mode — try again in a moment.");
      } else {
        setMemoryNote(mode === "local"
          ? "Device-Only is on. New conversations stay on this device — history no longer follows you between devices."
          : "Server memory is back on. New conversations will sync across your devices.");
      }
    } catch {
      setMemoryMode(prev);
      setMemoryNote("Couldn't change memory mode — check your connection and try again.");
    } finally {
      setMemorySwitching(false);
    }
  }, [memoryMode]);

  // The single request/SSE core. Both a fresh send and a failed-turn retry flow
  // through here, so a retry replays the exact same history — never a duplicate
  // user message. `requestMessages` already ends at the user turn to answer.
  const performTurn = useCallback(async (requestMessages: ChatMessage[]) => {
    const sentText = [...requestMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const startedNewThread = threadId === null;
    let createdThreadId: string | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setMessages([...requestMessages, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
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
        // Any other non-OK (503 inference failure, 429 burst limit, 500, an
        // unexpected proxy error): the turn is recoverable. Keep the words and
        // offer a one-tap retry instead of silently dropping them.
        setFailedTurn({ text: sentText, kind: "unreachable" });
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = { role: "assistant", content: err.error || "Couldn't finish that answer — your message is safe, tap Try again." };
          return u;
        });
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      let buffer = "";
      // A stream that opens and then dies is the train-tunnel failure: the
      // request looked like it worked while the turn quietly evaporated. The
      // committed route always ends `content` → `[DONE]`, so either flag still
      // false at EOF means the answer never really arrived.
      let sawDone = false;
      let sawContent = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              sawDone = true;
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.threadId) {
                createdThreadId = parsed.threadId as string;
                setThreadId(parsed.threadId);
                continue;
              }
              // The confirmed `{ state }` frame lands before any answer text:
              // the canvas converges while the person is still reading nothing
              // but the typing dots, and every later frame keeps it honest.
              if (parsed.state) {
                const js = parsed.state as JourneyState;
                const jid = typeof parsed.journeyId === "string" ? (parsed.journeyId as string) : null;
                void applyStateFrame(js, jid);
                continue;
              }
              if (parsed.content) {
                sawContent = true;
                setMessages((prev) => {
                  const u = [...prev];
                  u[u.length - 1] = {
                    role: "assistant",
                    content: u[u.length - 1].content + parsed.content,
                  };
                  return u;
                });
                continue;
              }
              // The `{ recall: true }` frame follows the answer text and simply
              // flags the assistant message being built. The reserved label slot
              // above the bubble already holds its height, so flipping this on
              // reveals the caption with zero layout shift. Session-only: the
              // flag is stripped before anything is persisted.
              if (parsed.recall) {
                setMessages((prev) => {
                  const u = [...prev];
                  u[u.length - 1] = { ...u[u.length - 1], recalled: true };
                  return u;
                });
              }
            } catch {}
          }
        }
      }
      if (!sawDone || !sawContent) {
        // Truncated or empty: the words are safe and the turn is re-runnable.
        // Anything that did paint stays on screen — it is their context now —
        // and the retry replays up to the user turn, so nothing duplicates.
        setFailedTurn({ text: sentText, kind: "incomplete" });
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.role === "assistant" && last.content.trim()) return prev;
          u[u.length - 1] = { role: "assistant", content: "Sovereign's answer stopped before it arrived — your message is safe, tap Try again." };
          return u;
        });
        return;
      }
      if (createdThreadId) {
        const final = await refreshThreads();
        const stored = final.find((t) => t.id === createdThreadId);
        if (stored && (startedNewThread || !stored.label)) {
          const label = threadLabel([...requestMessages, { role: "assistant", content: "" }]);
          setThreads((prev) => prev.map((t) => (t.id === createdThreadId ? { ...t, label } : t)));
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User pressed Stop — keep the partial response as-is.
        return;
      }
      console.error("Chat error:", err);
      // A dropped mobile connection is the prime "lost words" case — recover it.
      setFailedTurn({ text: sentText, kind: "unreachable" });
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: "Couldn't reach Sovereign — your message is safe, tap Try again." };
        return u;
      });
    } finally {
      abortRef.current = null;
      refreshUsage();
      setIsStreaming(false);
    }
  }, [threadId, refreshThreads, refreshUsage, router, applyStateFrame]);

  const sendMessage = useCallback(async () => {
    if (isStreaming) return;
    // Nobody wants a microphone still open while their words are flying: stop
    // first, then read the composer — a provisional phrase already painted on
    // screen is the person's own wording, and `inputRef` holds it a render
    // before `input` state does.
    stopDictation();
    const content = (inputRef.current?.value ?? input).trim();
    if (!content) return;
    setFailedTurn(null);
    setInput("");
    setFreshOffer(false);
    await performTurn([...messages, { role: "user", content }]);
  }, [input, isStreaming, messages, performTurn, stopDictation]);

  // One-tap recovery: replay the transcript up to (and including) the failed
  // user message — dropping the trailing error bubble — so the retry never
  // duplicates the turn in the thread history.
  const retryLastTurn = useCallback(async () => {
    if (!failedTurn || isStreaming) return;
    setFailedTurn(null);
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    await performTurn(messages.slice(0, lastUserIdx + 1));
  }, [failedTurn, isStreaming, messages, performTurn]);

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
    // Bounded app shell: the conversation is the scroll surface and the
    // composer stays pinned to the bottom on every viewport. `min-h-screen`
    // let the page grow, so on phones the tall empty state pushed the input
    // below the fold — `h-[100dvh]` keeps the shell to the screen and lets
    // the inner `overflow-y-auto` own scrolling. dvh tracks mobile browser chrome;
    // while the keyboard is up it is overridden with the visible height, above.
    <main id="main" className="flex h-[100dvh] flex-col" style={{ "--journey-progress": String(journey?.visual_progress ?? 0), height: shellHeight ? `${shellHeight}px` : undefined } as React.CSSProperties}>
      <Nav />
      {/* App screen: the conversation itself is the content, so the page
          title exists for assistive tech only (every page carries one h1). */}
      <h1 className="sr-only">Chat with Sovereign</h1>

      {billingSuccess && (
        // A fixed, out-of-flow toast: it announces what the payment unlocked
        // without entering the `h-[100dvh]` flex column, so the conversation it
        // floats over never moves — measured arrival CLS stays 0.0000. The URL
        // param was already stripped on the frame that set this state, so a
        // refresh can't re-show it.
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-50 px-4">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-start justify-between gap-4 rounded-panel border border-border/70 bg-surface-2/95 px-4 py-3 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm">
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
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Sovereign+ is active — welcome.</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  You now have up to 150 AI messages a day, the full depth of your Baseline,
                  and the ability to invite the people you&apos;re figuring things out with.
                </p>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBillingSuccess(false)}
              aria-label="Dismiss"
              className="tap-line shrink-0"
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
                    setResendState(d.ok ? "sent" : `error: ${d.error || "Couldn't send that email — try again in a moment."}`);
                  } catch {
                    setResendState("error: Couldn't send that email — try again in a moment.");
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
        <div className="relative flex min-w-0 flex-1 flex-col">
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
                        {t.journey_goal && (
                          <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/45 align-middle" />
                        )}
                        {chipLabel(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Device-Only vs. Server memory, one click away right where
                  the choice is felt. The icon is the whole story at a glance:
                  a globe for cross-device, a lock for this-device-only. */}
              <div className="relative shrink-0 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMemoryMenuOpen((v) => !v)}
                  disabled={isStreaming || memorySwitching}
                  aria-haspopup="menu"
                  aria-expanded={memoryMenuOpen}
                  title={memoryMode === "local" ? "Device-Only memory" : "Server memory"}
                  className={`memory-pill ${memoryMode === "local" ? "gap-1.5" : "gap-1.5 lg:px-2.5"}`}
                >
                  {memorySwitching ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" /> : memoryMode === "local" ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
                  <span className="hidden lg:inline">{memorySwitching ? "Switching…" : memoryMode === "local" ? "On device" : "All devices"}</span>
                  <span className="sr-only">Memory mode: {memoryMode === "local" ? "Device-Only" : "Server"}. Change it.</span>
                </Button>
                {memoryMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close memory menu"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setMemoryMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-40 mt-2 w-64 rounded-panel border border-foreground/10 bg-surface-2 p-1.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)]"
                    >
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={memoryMode === "server"}
                        onClick={() => void switchMemoryMode("server")}
                        className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span><span className="block font-medium text-foreground">All devices</span><span className="block mt-0.5 text-xs">Conversations sync across your devices.</span></span>
                      </button>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={memoryMode === "local"}
                        onClick={() => void switchMemoryMode("local")}
                        className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span><span className="block font-medium text-foreground">On this device only</span><span className="block mt-0.5 text-xs">New chats are never stored on our servers.</span></span>
                      </button>
                      <Link href="/settings" className="block rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" onClick={() => setMemoryMenuOpen(false)}>
                        Details in <Shield className="inline h-3 w-3 -mt-0.5" aria-hidden="true" /> Settings
                      </Link>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSearch}
                disabled={isStreaming}
                aria-expanded={searchOpen}
                title="Search past conversations (⌘K)"
                className="shrink-0"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Search</span>
                <span className="sr-only">Search past conversations (⌘K)</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeopleOpen((v) => !v)}
                disabled={isStreaming}
                aria-expanded={peopleOpen}
                className="shrink-0"
              >
                <Users className="h-4 w-4" />
                People
              </Button>
            </div>
          </div>

          {peopleOpen && <PeoplePanel tier={tier} onClose={() => setPeopleOpen(false)} />}

          {/* Semantic search panel — slides down between the header and the
              transcript. Escape closes; a result click calls `jumpToTurn`
              which opens the referenced thread and scrolls to the exact
              turn. Local accounts get a different hint because there is
              literally nothing to search server-side. */}
          {searchOpen && (
            <div className="border-b border-border bg-surface-1/95 px-4 py-3 backdrop-blur-sm">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setSearchOpen(false); setSearchQuery(""); setSearchResults(null); } }}
                    placeholder="Search your past conversations…"
                    aria-label="Search your past conversations"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  {searchLoading && (
                    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent text-muted-foreground" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults(null); }}
                    aria-label="Close search"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {memoryMode === "local" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Device-Only memory keeps your history off our servers, so there is nothing to search here. Switch to All devices in the memory menu to search your past conversations.
                  </p>
                ) : searchQuery.trim().length < 2 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Type at least two characters. Ask in plain words — “what did we say about sleep?” — and it will find the moment.</p>
                ) : searchResults && searchResults.length === 0 && !searchLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {!searchIndexed
                      ? "Nothing indexed yet. New conversations appear here within a moment of being sent."
                      : "No matches for that phrase. Try asking the way you'd say it out loud."}
                  </p>
                ) : searchResults && searchResults.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {searchResults.map((r) => (
                      <li key={`${r.threadId}:${r.turnIndex}:${r.role}`}>
                        <button
                          type="button"
                          onClick={() => void jumpToTurn(r.threadId, r.turnIndex)}
                          className="w-full rounded-lg border border-border/50 bg-surface-2/40 px-3 py-2 text-left transition-colors hover:border-border hover:bg-surface-2"
                        >
                          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                            {r.role === "assistant" ? "Sovereign" : "You"}
                            {r.updatedAt ? ` · ${(() => { try { return new Date(r.updatedAt.endsWith("Z") ? r.updatedAt : r.updatedAt + "Z").toLocaleDateString(); } catch { return ""; } })()}` : ""}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-foreground">{r.snippet}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* Rendered as a sibling of the veil, never a descendant: the veil
              carries `backdrop-filter`, which makes it the containing block for
              any fixed element inside it — a sheet mounted in there would be
              trapped in the panel's box instead of covering the page. Closing
              hands focus back to the control the person tapped, which only
              exists while the panel is expanded, so the lookup is optional. */}
          {pastOpen && past.length > 0 && (
            <PastJourneysSheet
              arcs={past}
              onClose={() => {
                setPastOpen(false);
                requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".journey-past-trigger")?.focus());
              }}
            />
          )}

          {/* One polite, one-shot line per fresh unlock — the bar itself never
              lives in an aria-live region, so frames don't spam assistive tech. */}
          <p className="sr-only" role="status" aria-live="polite">{milestoneAnnouncement}</p>

          {/* The transcript owns the veil. Measured before this wrapper existed:
              anchored to the chat column, an open panel covered y=66..440 —
              New thread, memory mode and People sat underneath it (a real tap on
              People landed on the panel's own Dismiss button), and the first
              message of a short thread painted straight through the journey
              text. Anchoring the overlay to the scroll area's box confines it to
              conversation space, where the reserved clearance below already
              keeps the first row out from under it. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* The journey, surfaced the way Q1 locked it: inferred from the
                conversation, shown only once it exists, dismissible in one click
                — and re-revealed only by a fresh unlock, never by nagging. The
                wrapper never unmounts; it is an absolutely-positioned veil that
                arrives via transform/opacity, so nothing in flow ever moves and
                CLS stays exactly zero (measured: any in-flow height change, even
                animated 0fr→1fr, is a shift in Chrome). */}
            <div ref={veilRef} className={`journey-veil bg-background/80 backdrop-blur-sm ${journeyVisible && journey && !journeyDismissed ? "journey-veil-open" : ""} ${journeyExpanded && veilHasMore ? "journey-veil-fade" : ""}`}>
              <div className="px-4 py-3">
                <div className="mx-auto max-w-3xl">
                  {journey && !journeyDismissed && (
                    <JourneyBar
                      journey={{
                        id: journey.id,
                        goal: journey.goal,
                        status: journey.status,
                        steps: journey.steps,
                        progress: journey.visual_progress,
                        newlyUnlocked: journey.newlyUnlocked,
                        inquiryLevel: journey.inquiryLevel,
                      }}
                      expanded={journeyExpanded}
                      onToggleExpanded={() => setJourneyExpanded((v) => !v)}
                      onRename={(goal) => { void applyControl({ id: journey.id, rename: goal }); }}
                      onPauseResume={() => { void applyControl({ id: journey.id, pause: journey.status !== "paused" }); }}
                      onDismiss={() => setJourneyDismissed(true)}
                      onStepBack={(stepId) => { void applyControl({ id: journey.id, overrideStep: stepId }); }}
                      onComplete={completeCurrentJourney}
                      onStartFresh={() => { void beginFreshJourney(); }}
                      pastCount={past.length}
                      onShowPast={() => setPastOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* role="log": screen readers announce each newly appended message as a
                conversation, without re-reading the whole history. `journey-clearance`
                is static from the first frame (see globals.css): it is what lets the
                panel cover nothing but the space it owns, without the reveal costing
                a point of layout shift. */}
            <div ref={scrollerRef} className="journey-clearance flex-1 overflow-y-auto px-4 py-6" role="log" aria-live="polite" aria-label="Conversation">
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.length === 0 && (
                  <div className="flex min-h-full flex-col px-2 py-10">
                    {/* my-auto centers the empty state when it fits, and collapses
                        to a top alignment when it overflows — unlike items-center,
                        which clips the emblem/headline out of reach on short phones. */}
                    <div className="msg-in my-auto w-full text-center">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
                        <Logo showWordmark={false} href={null} markClassName="h-10 w-auto" />
                      </div>
                      <p className="font-display text-2xl font-normal tracking-tight text-foreground">
                        Ask anything.
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        About yourself, what you&apos;re sitting with, the people in your life — or the whole system they make.
                      </p>
                      <StartingPoints onPick={seedComposer} disabled={isStreaming} />
                      {/* The new-thread half of "one arc per topic". It sits in the
                          empty state rather than in a dialog because this is the
                          only moment the choice means anything: before the first
                          message, while either path is still free. */}
                      {freshOffer && journey && (
                        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 border-t border-border/50 pt-5 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
                          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                            {"This conversation picks up your current journey"}
                            {journey.goal ? `: ${journey.goal}` : ""}{"."}
                          </p>
                          <button
                            type="button"
                            onClick={() => { void beginFreshJourney(); }}
                            className="inline-flex min-h-[2.75rem] shrink-0 items-center rounded-md border border-border/60 px-3 text-xs font-medium text-foreground transition-colors duration-[240ms] hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            Start a fresh journey
                          </button>
                        </div>
                      )}
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
                      data-turn={idx}
                      className={`msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="flex flex-col gap-1.5">
                          {/* Reserved from mount in both states (only visibility
                              toggles), so the recall caption arriving after the
                              answer text never shifts the bubble — measured CLS
                              stays 0.0000. Quiet, non-interactive, adds no data. */}
                          <div
                            aria-hidden={!msg.recalled}
                            style={{ visibility: msg.recalled ? "visible" : "hidden" }}
                            className="flex h-4 items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70"
                          >
                            <span className="h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
                            From your history
                          </div>
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
                        <p className="text-xs text-muted-foreground">Sovereign+ lifts the cap to 150 messages a day — go as deep as you need.</p>
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
                {/* Offline is surfaced calmly, never as a blocking modal — the
                    draft is already held, so a person can keep writing and send
                    the moment the connection returns. */}
                {offline && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-2 flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
                    You&apos;re offline — keep typing, we&apos;ll hold your words until the connection returns.
                  </div>
                )}
                {/* A turn that couldn't be delivered leaves the user's words and
                    a single, obvious way to send them again — no retyping, no
                    duplicate in the history. */}
                {failedTurn && !isStreaming && (
                  <div className="msg-in mb-2 flex items-center justify-between gap-3 rounded-panel border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5">
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {failedTurn.kind === "incomplete"
                        ? "Sovereign's answer got cut off. Your message is safe."
                        : "Your message is safe. We couldn't reach Sovereign just now."}
                    </p>
                    <Button size="sm" onClick={() => void retryLastTurn()} className="min-h-[44px] shrink-0">
                      <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Try again
                    </Button>
                  </div>
                )}
                {/* Dictation trouble (a blocked microphone, an engine that
                    refused to start) reads as one calm line above the pill —
                    never a modal, and it clears itself. */}
                {dictationNotice && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-2 flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
                    {dictationNotice}
                  </div>
                )}
                <div className="composer-pill flex items-end gap-2 pl-5 pr-1.5 py-1.5">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    // The composer never goes dead — at the cap, sending simply
                    // returns the quiet gate card above, which is far more
                    // graceful than a disabled field. Multi-line by design: a
                    // long thought stays readable and auto-grows (see effect).
                    aria-label="Message Sovereign"
                    placeholder="Ask Sovereign…"
                    rows={1}
                    disabled={isStreaming}
                    // On a phone the panel is the difference between reading room
                    // and typing room, so an expanded step list folds away the
                    // moment the caret goes to work. Desktop keeps whatever the
                    // person opened.
                    onFocus={() => {
                      if (window.matchMedia("(max-width: 640px)").matches) setJourneyExpanded(false);
                    }}
                    className="max-h-44 min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2.5 text-sm leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {/* Voice dictation, for browsers that have it and nobody else.
                      Same 44px circle as Send, an `aria-pressed` state instead of
                      a colour-only cue, and the recording dot is absolutely
                      positioned so listening can never reflow the pill (a width
                      change in this row would itself be a layout shift). */}
                  {dictationSupported && !isStreaming && (
                    <button
                      type="button"
                      onClick={toggleDictation}
                      aria-pressed={dictating}
                      aria-label={dictating ? "Stop dictation" : "Dictate your message"}
                      // `previewing` is deliberately only in the tooltip: any
                      // in-flow "listening…" caption would reflow the pill on
                      // every guess the engine revises, and a revised guess is
                      // exactly the moment a person should not lose their place.
                      title={dictating ? (dictationPreview ? "Listening — tap to stop" : "Stop dictation") : "Dictate"}
                      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-[240ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        dictating
                          ? "border-foreground/35 bg-white/[0.10] text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {dictating ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                      {dictating && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-400 motion-reduce:animate-none"
                        />
                      )}
                    </button>
                  )}
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

      {memoryNote && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-8">
          <div className="msg-in glass-panel pointer-events-auto flex max-w-md items-start gap-3 px-4 py-3 text-sm text-foreground">
            <p className="flex-1 leading-snug">{memoryNote}</p>
            <button type="button" onClick={() => setMemoryNote(null)} aria-label="Dismiss notice" className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * The People strip in chat: who you're connected to and who you've invited.
 * Read-only summary — full label/consent control lives in /settings.
 */
/** Initials for a connection avatar — first+last name, or first two of one word. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PeoplePanel({
  tier,
  onClose,
}: {
  tier: "free" | "sovereign+" | null;
  onClose: () => void;
}) {
  const [connections, setConnections] = useState<RelationshipView[] | null>(null);
  const [invites, setInvites] = useState<InviteView[] | null>(null);
  // The state this person is holding, kept on-device (never a server row).
  const [activeSigil, setActiveSigil] = useState<ActiveSigil | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read the device-held intent once; a private-mode quota throw is ignored.
    try {
      const raw = localStorage.getItem(ACTIVE_SIGIL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ActiveSigil>;
        // Validate the intent id against the real set, so a stale or hand-edited
        // key can never draw one crest while naming it with a borrowed label. The
        // stored label is discarded in favour of the intent's own — words and
        // glyph always agree.
        const intent = typeof parsed.intentId === "string" ? getSigilIntent(parsed.intentId) : undefined;
        if (intent && typeof parsed.seed === "number" && typeof parsed.label === "string") {
          setActiveSigil({ seed: parsed.seed, intentId: intent.id, label: intent.label });
        }
      }
    } catch {}
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
    <div className="border-b border-border bg-surface-1/60 px-4 py-4 backdrop-blur-xl">
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

        {activeSigil && (
          <div className="mb-3 flex items-center gap-2.5 rounded-panel border border-white/[0.06] bg-surface-1/40 px-3 py-2">
            <span className="text-foreground">
              <Sigil seed={activeSigil.seed} intentId={activeSigil.intentId} size={22} />
            </span>
            <p className="text-xs text-muted-foreground">
              You&apos;re holding <span className="font-medium text-foreground">{activeSigil.label.toLowerCase()}</span>
            </p>
          </div>
        )}

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
                  <li
                    key={c.relationId}
                    className="flex items-center gap-3 rounded-panel border border-white/[0.06] bg-surface-1/40 px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground"
                    >
                      {initials(c.personName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">{c.personName}</span>
                        <span className="shrink-0 rounded-full border border-border bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {c.myLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {c.peerSharesBaseline
                          ? "Shares their baseline with you"
                          : "Hasn't shared their baseline yet"}
                        {!c.shareBaseline ? " · you're not sharing yours" : ""}
                      </p>
                    </div>
                    {/* A quiet crest for this thread — seeded from the pair, never
                        from either person's birth data. Purely a marker. */}
                    <span className="shrink-0 text-foreground/35" aria-hidden="true">
                      <Sigil seed={sigilSeedFromId(c.relationId)} intentId="open" size={20} />
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
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
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

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/70">
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