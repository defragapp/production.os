/**
 * Encrypted device-only memory (Batch 3, P3).
 *
 * The whole point of `memory_mode = 'local'` is that nothing about a person's
 * inner life lands on our servers: /api/chat runs zero-retention inference and
 * this module is where the journey lives instead — an IndexedDB store keyed by
 * AES-GCM 256 under a NON-EXTRACTABLE CryptoKey. The key material can never be
 * read back, exported, or accidentally uploaded: WebCrypto refuses to hand it
 * over, and it is never written anywhere but the origin's IndexedDB.
 *
 * Envelopes are versioned (`{ v: 'v1', iv, data }`) so a future key rotation
 * or algorithm change can migrate old rows instead of stranding them.
 *
 * Client-only by construction: `indexedDB` and `crypto.subtle` are feature-
 * detected and every entry point returns null/false rather than throwing when
 * either is missing, so this file is safe to import from SSR and unit-testable
 * in Node (the pure envelope helpers and `patchLocalJourney` need no storage).
 */
import type { JourneyStepDef } from "./sovereign-journey";
import type { MemoryMode } from "./types";

export const LOCAL_DB_NAME = "sovereign-memory";
export const LOCAL_DB_VERSION = 1;
/** Object stores: `keys` holds the CryptoKey, `records` the sealed envelopes. */
export const LOCAL_KEYS_STORE = "keys";
export const LOCAL_RECORDS_STORE = "records";
/** Single key for the one key we hold: the AES-GCM journey encryption key. */
const JOURNEY_KEY_ID = "journey-aesgcm";

// The mode union lives in types.ts (single source next to `User`); re-exported
// so consumers of the vault can import the whole local-memory surface from here.
export type { MemoryMode };
export type LocalJourneyStatus = "active" | "paused" | "complete" | "hidden";
/** `journey` is the live arc. `journey-history` is what an arc leaves behind
 *  when it closes, plus the device's own copy of the lifecycle timeline — the
 *  local answer to `journeys.status = 'complete'` and `journey_events`. */
export type LocalRecordKind = "journey" | "journey-history";

/** One closed arc, reduced to what a person actually wants from a look-back:
 *  the subject, when it ended, how far it got. */
export interface LocalArcSummary {
  goal: string | null;
  completedAt: string;
  stepsReached: number;
  totalSteps: number;
}
/** A lifecycle line, mirroring a `journey_events` row: derived milestones and
 *  the moments the person decided (started, completed, rewound). */
export interface LocalJourneyEventLog {
  milestone: string;
  source: "derived" | "user-confirmed";
  at: string;
}
export interface LocalJourneyHistory {
  arcs: LocalArcSummary[];
  events: LocalJourneyEventLog[];
}

/** Bounds on the local archive. Ten closed arcs and fifty timeline lines are
 *  more than anyone reads, and they keep one sealed envelope small enough to
 *  decrypt on every page load — a device-only memory should not grow into a
 *  database nobody can open. */
export const MAX_LOCAL_ARCS = 10;
export const MAX_LOCAL_EVENTS = 50;

/** Pure, newest-first, bounded: the only way history is ever written locally,
 *  so completing an arc can never overwrite the ones before it. */
export function appendLocalHistory(
  history: LocalJourneyHistory | null,
  input: { arc?: LocalArcSummary; events?: LocalJourneyEventLog[] },
): LocalJourneyHistory {
  const previousArcs = history?.arcs ?? [];
  const previousEvents = history?.events ?? [];
  return {
    arcs: input.arc ? [input.arc, ...previousArcs].slice(0, MAX_LOCAL_ARCS) : previousArcs,
    events: input.events?.length ? [...input.events, ...previousEvents].slice(0, MAX_LOCAL_EVENTS) : previousEvents,
  };
}

/** A journey as the client derives it, stored beside the user scope so a
 *  shared device can't blend two accounts' records. */
export interface LocalJourneyRecord<S = unknown> {
  version: number;
  userScope: string;
  updatedAt: string;
  status: LocalJourneyStatus;
  state: S;
}

interface EnvV1 {
  v: "v1";
  /** AES-GCM initialization vector, base64url. */
  iv: string;
  /** Ciphertext of the JSON-serialized record, base64url. */
  data: string;
}

interface StoredEnvelope {
  id: LocalRecordKind;
  env: EnvV1;
}

function hasCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}
function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** True when this browser can actually run the encrypted store. A missing
 *  IndexedDB (private mode, old WebView) must degrade to server mode, not
 *  silently drop a person's history. */
export async function isLocalMemoryAvailable(): Promise<boolean> {
  return hasCrypto() && hasIndexedDb();
}

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // One-shot creation. `keys` is an out-of-line key store (the CryptoKey
      // itself is the value); `records` is self-describing via keyPath.
      if (!db.objectStoreNames.contains(LOCAL_KEYS_STORE)) db.createObjectStore(LOCAL_KEYS_STORE);
      if (!db.objectStoreNames.contains(LOCAL_RECORDS_STORE)) db.createObjectStore(LOCAL_RECORDS_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open failed"));
  });
}

/**
 * Get (or mint) the journey encryption key. `extractable: false` is the
 * load-bearing privacy guarantee: no code path — ours or an injected one — can
 * serialize this key off the device.
 */
async function getOrCreateKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const req = db.transaction(LOCAL_KEYS_STORE, "readonly").objectStore(LOCAL_KEYS_STORE).get(JOURNEY_KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error ?? new Error("key read failed"));
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(LOCAL_KEYS_STORE, "readwrite").objectStore(LOCAL_KEYS_STORE).put(key, JOURNEY_KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("key store failed"));
  });
  return key;
}

function storeEnvelope(db: IDBDatabase, kind: LocalRecordKind): Promise<StoredEnvelope | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(LOCAL_RECORDS_STORE, "readonly").objectStore(LOCAL_RECORDS_STORE).get(kind);
    req.onsuccess = () => resolve(req.result as StoredEnvelope | undefined);
    req.onerror = () => reject(req.error ?? new Error("record read failed"));
  });
}

function sealEnvelope(key: CryptoKey, plaintext: string): Promise<EnvV1> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)).then((ct) => ({
    v: "v1" as const,
    iv: toBase64Url(iv.buffer as ArrayBuffer),
    data: toBase64Url(ct),
  }));
}

function openEnvelope(key: CryptoKey, env: EnvV1): Promise<string> {
  return crypto.subtle
    .decrypt({ name: "AES-GCM", iv: fromBase64Url(env.iv) }, key, fromBase64Url(env.data).buffer as ArrayBuffer)
    .then((pt) => new TextDecoder().decode(pt));
}

/**
 * Read and decrypt the journey record for `userScope`, or null when there is
 * none. A corrupted, foreign-versioned, or other-account envelope reads as null
 * rather than throwing — losing the local journey must never break the chat
 * page, and reading someone else's record on a shared device is refused here
 * as a second lock behind the scope written into the plaintext.
 */
export async function readRecord<S>(kind: LocalRecordKind, userScope: string): Promise<LocalJourneyRecord<S> | null> {
  if (!hasCrypto() || !hasIndexedDb()) return null;
  try {
    const db = await openLocalDb();
    try {
      const stored = await storeEnvelope(db, kind);
      if (!stored || stored.env?.v !== "v1") return null;
      const key = await getOrCreateKey(db);
      const json = await openEnvelope(key, stored.env);
      const rec = JSON.parse(json) as LocalJourneyRecord<S>;
      return rec.userScope === userScope ? rec : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Encrypt and persist the journey record for `userScope`. Returns false when
 *  the browser can't provide the encrypted store. */
export async function writeRecord<S>(kind: LocalRecordKind, rec: LocalJourneyRecord<S>): Promise<boolean> {
  if (!hasCrypto() || !hasIndexedDb()) return false;
  try {
    const db = await openLocalDb();
    try {
      const key = await getOrCreateKey(db);
      const env = await sealEnvelope(key, JSON.stringify(rec));
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction(LOCAL_RECORDS_STORE, "readwrite").objectStore(LOCAL_RECORDS_STORE).put({ id: kind, env } satisfies StoredEnvelope);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error("record write failed"));
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/** Wipe everything this module stored (used by the mode switch and account
 *  deletion follow-ups). Deleting the database destroys the non-extractable
 *  key with it, which is exactly why old envelopes can never be read again. */
export async function clearLocalMemory(): Promise<void> {
  if (!hasIndexedDb()) return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(LOCAL_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("delete failed"));
    // A second tab holding the connection blocks deletion; treat "blocked" as
    // best-effort success rather than hanging the mode switch forever.
    req.onblocked = () => resolve();
  });
}

/** Clamp progress into 0..1 with two decimals, matching the server engine. */
function clampProgress(p: number): number {
  return Math.min(1, Math.max(0, Math.round(p * 100) / 100));
}

/**
 * Pure, testable reducer for the local journey: rename, pause/resume/complete/
 * hide, and the "I'm not there yet" step override — which rewinds progress to
 * the chosen step exactly the way `PATCH /api/journeys/[id]` does server-side,
 * so both memory modes behave identically.
 */
export function patchLocalJourney<
  S extends { current_step: string; unlocked_milestones: string[]; visual_progress: number; suggested_goal: string | null; steps: Array<{ id: string; label: string; status: "done" | "current" | "locked" }> },
>(
  rec: LocalJourneyRecord<S>,
  patch: { goal?: string | null; status?: LocalJourneyStatus; overrideStep?: string },
  catalog: JourneyStepDef[],
  stepToMilestone: Record<string, string>,
  milestoneWeights: Record<string, number>,
): LocalJourneyRecord<S> {
  const next: LocalJourneyRecord<S> = { ...rec, state: { ...rec.state } };
  if (patch.status) next.status = patch.status;
  if (patch.goal !== undefined) next.state = { ...next.state, suggested_goal: patch.goal?.trim() || null };
  if (patch.overrideStep) {
    const targetIdx = catalog.findIndex((s) => s.id === patch.overrideStep);
    if (targetIdx !== -1) {
      const target = catalog[targetIdx];
      const later = new Set(catalog.slice(targetIdx + 1).map((s) => stepToMilestone[s.id]).filter(Boolean));
      const kept = next.state.unlocked_milestones.filter((m) => !later.has(m));
      const steps = catalog.map((s, i) => ({
        ...s,
        status: (i < targetIdx ? "done" : i === targetIdx ? "current" : "locked") as "done" | "current" | "locked",
      }));
      const progress = clampProgress(kept.reduce((t, m) => t + (milestoneWeights[m] ?? 0), 0));
      next.state = { ...next.state, current_step: target.id, unlocked_milestones: kept, visual_progress: progress, steps };
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
