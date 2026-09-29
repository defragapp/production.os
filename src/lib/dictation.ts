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
 * Deliberately not a recording: dictated phrases are appended as finalized text
 * so the person always reviews and edits before sending, and only one
 * recognition instance can ever be live (starting is idempotent, and unmount
 * aborts) because a microphone that outlives the page is a privacy bug.
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

export interface DictationOptions {
  /** Called once per finalized phrase. The caller owns where the words go. */
  onText: (text: string) => void;
}

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** Short, human explanation shown beside the composer; self-clears. */
  notice: string | null;
  toggle: () => void;
  /** Safe to call when nothing is running (send, thread switch, Escape). */
  stop: () => void;
}

const NOTICE_MS = 6000;

export function useDictation({ onText }: DictationOptions): Dictation {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognition instance.
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    // Detach first: `stop()` fires `onend` on some engines, and a handler that
    // runs during teardown must not append half-words to the draft.
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
    setListening(false);
  }, []);

  const start = useCallback(() => {
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
    // Finalized segments only: interim text flickering into a draft the person
    // may send by reflex is worse than a half-second wait for the phrase.
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const results = event.results;
      for (let i = event.resultIndex; i < results.length; i += 1) {
        const result = results[i];
        if (!result?.isFinal) continue;
        const text = result[0]?.transcript?.trim();
        if (text) onTextRef.current(text);
      }
    };
    rec.onerror = (event) => {
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setNotice("Your browser blocked the microphone. Allow it for this site to dictate.");
      } else if (code && code !== "aborted" && code !== "no-speech") {
        setNotice("Voice input stopped. Tap the microphone to try again.");
      }
      // `no-speech` and `aborted` are quiet by design: the person either
      // paused or switched away, and a banner for either would be noise.
      stop();
    };
    rec.onend = () => {
      // Engines end by themselves (Safari after a phrase, Chrome after
      // silence). The control reflects reality rather than pretending to
      // still be listening.
      recRef.current = null;
      setListening(false);
    };
    try {
      rec.start();
    } catch {
      setNotice("Voice input couldn't start. Tap the microphone to try again.");
      return;
    }
    recRef.current = rec;
    setNotice(null);
    setListening(true);
  }, [stop]);

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

  return { supported, listening, notice, toggle, stop };
}
