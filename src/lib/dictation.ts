/**
 * Voice dictation for the composer, on the browser's own speech engine.
 *
 * Zero dependencies, zero server cost, zero retention: the audio never leaves
 * the device's browser, nothing is sent anywhere until the person presses
 * Send, and the words land in the same draft that localStorage already
 * protects — so Device-Only memory mode is unaffected. Chrome, Edge and Safari
 * (including iOS) expose the engine under `SpeechRecognition` or the prefixed
 * `webkitSpeechRecognition`; everywhere else this hook reports `supported:
 * false` and the composer renders exactly what it did before, with no broken
 * control and no console noise.
 *
 * Why the composer is handed a whole string rather than a phrase to append:
 * dictation is only believable if the person can watch it work. With
 * `interimResults = false` a speaker gets six seconds of silence in the text
 * box and concludes the microphone is dead — so interim hypotheses are painted
 * live and replaced, never appended, and each finalized segment takes over
 * exactly the words it was showing. That is the whole duplication story: one
 * rendered string, composed from `base + finalized + provisional`.
 *
 * The three real-world engines' habits this code exists for:
 *  - iOS Safari ends a `continuous` session after a short pause and fires
 *    `onend`. If the person did not ask to stop, we restart — a few times, then
 *    let go rather than looping against a silent microphone.
 *  - Chrome throws `InvalidStateError` when `start()` races a session that is
 *    still winding down. Starting is therefore idempotent.
 *  - A textarea the person edits while we are painting is theirs, not ours:
 *    the divergence is detected, their text becomes the new base, and the
 *    provisional tail we had drawn is stripped so it cannot be pasted twice.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Structural stand-ins for the Web Speech types: TypeScript's DOM lib only
 *  recently added `SpeechRecognition`, and the prefixed spelling never came
 *  with types at all. Declaring the shape we use keeps this compilable on
 *  every browser and honest about what we touch. */
type SpeechAlternative = { transcript?: string };
type SpeechResult = { isFinal?: boolean; 0?: SpeechAlternative };
type SpeechResultsLike = ArrayLike<SpeechResult | undefined>;
interface RecognitionResultEvent {
  resultIndex: number;
  results: SpeechResultsLike;
}
interface RecognitionErrorEvent {
  error?: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Join two pieces of speech without ever producing a double space or eating
 *  the space a person typed at the end of their own sentence. */
function joinWords(a: string, b: string): string {
  if (!b) return a;
  if (!a) return b;
  return `${a.trimEnd()} ${b}`;
}

/** Drop the provisional tail we painted last, so a manual edit reads as
 *  "the person's words" and not "the person's words plus my ghost". */
function stripTail(text: string, tail: string): string {
  const t = tail.trim();
  if (!t) return text;
  return text.endsWith(t) ? text.slice(0, text.length - t.length).trimEnd() : text;
}

/** How many silent restarts to attempt before accepting that the session is
 *  over. Enough to cover iOS's habit of cutting after one pause; not enough to
 *  leave a live microphone running against an empty room. */
const MAX_RESTARTS = 3;
const NOTICE_MS = 6000;

export interface DictationOptions {
  /** The composer's current text, read at the moment dictation acts. */
  getDraft: () => string;
  /** Replace the composer's text. Dictation owns the whole string while it
   *  runs, because the provisional words it paints must be replaceable. */
  setDraft: (text: string) => void;
}

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** True while provisional (not yet finalized) words are on screen — the
   *  composer can hint that they are still the engine's guess. */
  previewing: boolean;
  /** Short, human explanation shown beside the composer; self-clears. */
  notice: string | null;
  toggle: () => void;
  /** Safe to call when nothing is running (send, thread switch, Escape). */
  stop: () => void;
}

export function useDictation({ getDraft, setDraft }: DictationOptions): Dictation {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  // Text the engine no longer owns: the composer as it stood when dictation
  // began, plus everything the person has typed or we have finalized since.
  const baseRef = useRef("");
  // The single string we last wrote. Anything else in the textarea means
  // someone edited it by hand.
  const writtenRef = useRef("");
  const interimRef = useRef("");
  // Set only by our own `stop()`, so `onend` can tell "the engine quit" from
  // "I asked it to quit" — the difference between restarting and going quiet.
  const stoppingRef = useRef(false);
  const restartsRef = useRef(0);
  const heardRef = useRef(false);
  const draftRef = useRef(getDraft);
  const writeRef = useRef(setDraft);
  useEffect(() => {
    draftRef.current = getDraft;
    writeRef.current = setDraft;
  }, [getDraft, setDraft]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  /** Compose base + provisional and put it in the composer. Every paint goes
   *  through here so `writtenRef` stays a faithful record of what we own. */
  const paint = useCallback((interim: string) => {
    interimRef.current = interim;
    const text = joinWords(baseRef.current, interim);
    writtenRef.current = text;
    writeRef.current(text);
    setPreviewing(interim.trim().length > 0);
  }, []);

  /** Adopt whatever is in the textarea as the new base — called before the
   *  first paint of a session and whenever a hand edit is detected. */
  const reanchor = useCallback(() => {
    const draft = draftRef.current();
    baseRef.current = stripTail(draft, interimRef.current);
    interimRef.current = "";
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    stoppingRef.current = true;
    if (!rec) {
      setListening(false);
      setPreviewing(false);
      return;
    }
    // Detach first: `stop()` fires `onend` on some engines, and a handler that
    // runs during teardown must not restart the session or append half-words.
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {}
    }
    // A provisional phrase the engine never got to finalize stays on screen as
    // the person's own text — dropping it would be dropping what they said.
    // Joining with the same helper `paint` used keeps `writtenRef` an exact
    // record of the string on screen, so the next session cannot mistake our
    // own text for a hand edit.
    if (interimRef.current) {
      baseRef.current = joinWords(baseRef.current, interimRef.current);
      interimRef.current = "";
    }
    writtenRef.current = baseRef.current;
    setListening(false);
    setPreviewing(false);
  }, []);

  const start = useCallback(() => {
    // Idempotent: iOS can deliver `onend` a beat after we already replaced the
    // session, and Chrome throws if a second `start()` lands mid-flight.
    if (recRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    let rec: RecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      setNotice("Voice input isn't available right now.");
      return;
    }
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    // Live preview, deliberately: see the module header. The provisional text
    // is always replaced by the next event rather than concatenated, so the
    // finalized pass overwrites the guess instead of repeating it.
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      heardRef.current = true;
      restartsRef.current = 0;
      const results = event.results;
      let provisional = "";
      let finalized = "";
      for (let i = event.resultIndex; i < results.length; i += 1) {
        const result = results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript) continue;
        if (result?.isFinal) finalized = joinWords(finalized, transcript.trim());
        else provisional += transcript;
      }
      // The person may have edited while we were speaking for them. Their text
      // wins, and the ghost of our provisional tail comes out of it first.
      const draft = draftRef.current();
      if (draft !== writtenRef.current) reanchor();
      // The provisional words were never part of `base` — they were only ever
      // painted on top of it — so finalizing is an append plus a repaint, and
      // the guess cannot survive into the committed text twice.
      if (finalized) baseRef.current = joinWords(baseRef.current, finalized);
      paint(provisional);
    };
    rec.onerror = (event) => {
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setNotice("Your browser blocked the microphone. Allow it for this site to dictate.");
      } else if (code === "audio-capture") {
        setNotice("No microphone found. Dictation needs one.");
      } else if (code && code !== "aborted" && code !== "no-speech") {
        setNotice("Voice input stopped. Tap the microphone to try again.");
      }
      // `no-speech` and `aborted` are quiet by design: the person either
      // paused or switched away, and a banner for either would be noise.
      // `onend` follows every error and decides whether we restart.
    };
    rec.onend = () => {
      if (stoppingRef.current) return;
      const live = recRef.current;
      recRef.current = null;
      setPreviewing(false);
      // iOS ends a continuous session after a pause. Restart while the person
      // is still holding the mic, but only a few times and only if the engine
      // actually heard something — a silent loop must not keep the mic open.
      if (live && heardRef.current && restartsRef.current < MAX_RESTARTS) {
        restartsRef.current += 1;
        heardRef.current = false;
        try {
          live.start();
          recRef.current = live;
          return;
        } catch {
          /* fall through to going quiet */
        }
      }
      stoppingRef.current = true;
      // Going quiet means letting go of the engine completely. iOS can deliver a
      // late `onresult` after `onend`, and a handler still attached at that point
      // would paint words into the composer after the microphone is already down
      // (and flip `previewing` on a session that no longer exists).
      if (live) {
        live.onresult = null;
        live.onerror = null;
        live.onend = null;
      }
      setListening(false);
    };
    reanchor();
    restartsRef.current = 0;
    heardRef.current = false;
    stoppingRef.current = false;
    try {
      rec.start();
    } catch (err) {
      // "already started" is the one failure that means success elsewhere:
      // another tab or a race owns the mic, so we take the notice-free exit.
      if (err instanceof Error && err.name !== "InvalidStateError") {
        setNotice("Voice input couldn't start. Tap the microphone to try again.");
        return;
      }
      return;
    }
    recRef.current = rec;
    setNotice(null);
    setListening(true);
  }, [paint, reanchor]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Unmount must never leave the mic hot.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return { supported, listening, previewing, notice, toggle, stop };
}
