/**
 * Shared types for Sovereign OS.
 */

export type SubscriptionTier = "free" | "sovereign+";

export interface User {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface Baseline {
  user_id: string;
  tob: string | null;
  pob: string | null;
  dob: string | null;
  nasa_jpl_json_data: string | null;
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
  message_history: string;
  created_at: string;
  updated_at: string;
}

export interface BaselineData {
  humanDesign?: Record<string, unknown>;
  geneKeys?: Record<string, unknown>;
  astrology?: Record<string, unknown>;
  [key: string]: unknown;
}
