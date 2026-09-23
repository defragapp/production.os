/**
 * Connection primitives shared by the invites / relationships / settings APIs.
 * Birth data is never part of any of these shapes — connections are
 * name + role + consent flags only.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "./auth";
import { getEnv } from "./env";
import type { RelationshipView, User } from "./types";

export const MAX_PENDING_INVITES = 5;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Suggested relationship labels offered in the invite/settings UI. */
export const ROLE_SUGGESTIONS = [
  "friend", "partner", "spouse", "mom", "dad", "sister", "brother", "sibling",
  "child", "parent", "cousin", "best friend", "colleague", "boss", "teammate",
  "in-law", "neighbor", "other",
] as const;

/** Confirm the authenticated user for a request, sharing the threads pattern. */
export async function getAuthPayload(request: NextRequest) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) return { env, error: NextResponse.json({ error: "JWT_SECRET is not configured" }, { status: 500 }) } as const;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const payload = await verifyJWT(token, secret);
  if (!payload) return { env, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  return { env, error: undefined, payload } as const;
}

export async function loadUser(env: { DB: D1Database }, userId: string): Promise<User | null> {
  try {
    return await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, email_verified, display_name FROM users WHERE id = ?").bind(userId).first<User>();
  } catch {
    return await env.DB.prepare("SELECT id, email, stripe_customer_id, subscription_tier, email_verified FROM users WHERE id = ?").bind(userId).first<User>();
  }
}

export function isPlusTier(user: User | null): boolean {
  return user?.subscription_tier === "sovereign+";
}

export function normalizedLabel(label: string | undefined, fallback = "friend"): string {
  const cleaned = (label ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return cleaned || fallback;
}

/** a***@*****.example — enough to recognize an account, never enough to be sensitive. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const dLocal = (domain ?? "").split(".");
  const first = dLocal[0]?.[0] ?? "";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(3, Math.max(1, local.length - 1)))}@${first}${"*".repeat(Math.max(1, (dLocal[0]?.length ?? 1) - 1))}.${dLocal.slice(1).join(".")}`;
}

/** Public-facing name for an account: display name, else the local part of the email. */
export function personName(user: Pick<User, "display_name" | "email">): string {
  if (user.display_name) return user.display_name;
  const local = (user.email ?? "").split("@")[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "Connected person";
}

/** Normalize a connection pair so (user_a, user_b) is deterministic. */
export function orderedPair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

export interface RelationshipRow {
  id: string;
  user_a: string;
  user_b: string;
  a_label: string;
  b_label: string;
  a_share_baseline: number;
  b_share_baseline: number;
  created_at: string;
}

async function hasBaseline(env: { DB: D1Database }, userId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?").bind(userId).first<{ user_id: string }>();
  return Boolean(row);
}

/** All connections from the perspective of `me` — name + role + consent only. */
export async function relationshipViews(
  env: { DB: D1Database },
  me: User,
): Promise<RelationshipView[]> {
  const rows = await env.DB.prepare(
    "SELECT id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline, created_at FROM relationships WHERE user_a = ? OR user_b = ? ORDER BY created_at DESC",
  ).bind(me.id, me.id).all<RelationshipRow>();

  const views: RelationshipView[] = [];
  for (const row of rows.results ?? []) {
    const iAmA = row.user_a === me.id;
    const peerId = iAmA ? row.user_b : row.user_a;
    const [peer, peerBaseline] = await Promise.all([
      loadUser(env, peerId),
      hasBaseline(env, peerId),
    ]);
    if (!peer) continue;
    views.push({
      id: row.id,
      relationId: row.id,
      personId: peerId,
      personName: personName(peer),
      personEmailMasked: maskEmail(peer.email),
      myLabel: iAmA ? row.a_label : row.b_label,
      peerLabel: iAmA ? row.b_label : row.a_label,
      peerHasBaseline: peerBaseline,
      peerSharesBaseline: iAmA ? Number(row.b_share_baseline) === 1 : Number(row.a_share_baseline) === 1,
      shareBaseline: iAmA ? Number(row.a_share_baseline) === 1 : Number(row.b_share_baseline) === 1,
      createdAt: row.created_at,
    });
  }
  return views;
}