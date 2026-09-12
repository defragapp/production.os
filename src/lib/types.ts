/**
 * Shared types for Sovereign OS.
 */

export type SubscriptionTier = "free" | "sovereign+";

export interface User {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_tier: SubscriptionTier;
  email_verified?: number;
  created_at: string;
  updated_at: string;
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
}

export interface Thread {
  id: string;
  user_id: string;
  message_history: string;  // JSON string of ChatMessage[]
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
