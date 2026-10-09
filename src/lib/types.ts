/**
 * Shared types for Sovereign OS.
 */

export type SubscriptionTier = "free" | "sovereign+";

/** Where a person's conversation memory lives. 'server' persists threads and
 *  journeys in D1 (multi-device continuity, the default); 'local' runs
 *  zero-retention inference — nothing new is written server-side and the
 *  client keeps the journey in an encrypted on-device vault. */
export type MemoryMode = "server" | "local";

export interface User {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_tier: SubscriptionTier;
  email_verified?: number;
  display_name?: string | null;
  /** Optional: pre-migration D1 snapshots lack the column, and the defensive
   *  user lookups fall back to selects without it. */
  memory_mode?: MemoryMode;
  /** Clickwrap receipt (migration 0004): the Terms version affirmed and when.
   *  Optional for the same pre-migration reason as memory_mode. */
  terms_version?: string | null;
  terms_accepted_at?: string | null;
  /** Owner-minted gift pass expiry (SQLite UTC); null = never held a pass. */
  gift_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface Invite {
  id: string;
  owner_user_id: string;
  email: string;
  role: string;
  /** Owner's label for who the invitation is for ("Mom", "Alex"). Optional
   *  because several queries select an explicit column subset without it. */
  invitee_name?: string | null;
  token_hash: string;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

/** A connection row as seen by one authenticated user. */
export interface RelationshipView {
  id: string;
  relationId: string;
  personId: string;
  personName: string;
  personEmailMasked: string;
  myLabel: string;
  peerLabel: string | null;
  peerHasBaseline: boolean;
  peerSharesBaseline: boolean;
  shareBaseline: boolean;
  peerSharesHistory: boolean;
  shareHistory: boolean;
  createdAt: string;
}

export interface Baseline {
  user_id: string;
  tob: string | null;   // time of birth
  pob: string | null;   // place of birth
  dob: string | null;   // date of birth
  nasa_jpl_json_data: string | null;  // JSON string of Human Design, Gene Keys, Astrology
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /**
   * Client-session marker: this assistant answer wove in the person's own
   * earlier words (the SSE `{ recall: true }` frame). Transient by design — it
   * is never sent to the server (performTurn strips to role/content) and never
   * persisted in `threads.message_history`, only used to render the quiet
   * "from your history" label and to feed the future Living Orb 'clarity' cue.
   */
  recalled?: boolean;
  /**
   * Client-session marker: this assistant bubble is a system notice (a usage
   * cap, an email/session gate) rather than a real answer. Transient by design
   * — like `recalled` it is never sent to the server (performTurn strips to
   * role/content) and never persisted. It exists so the renderer can hide the
   * Share affordance on anything that is not a genuine answer.
   */
  notice?: boolean;
}

export interface Thread {
  id: string;
  user_id: string;
  message_history: string;  // JSON string of ChatMessage[]
  /** The journey this conversation produced, when one exists. Nullable and
   *  nulled by the database when the journey row is deleted. */
  journey_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Parsed baseline data structure. */
export interface BaselineData {
  humanDesign?: Record<string, unknown>;
  geneKeys?: Record<string, unknown>;
  astrology?: Record<string, unknown>;
  [key: string]: unknown;
}
