import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import type { User } from "@/lib/types";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

/**
 * Server-side auth gate for the chat UI.
 *
 * The chat page is never rendered for unauthenticated visitors — even if the
 * edge middleware is bypassed, a missing/expired JWT, unknown user, missing
 * baseline, or missing subscription tier results in a redirect before any
 * chat HTML is sent to the client.
 *
 * Gating order:
 * 1. Valid JWT + known user (authentication)
 * 2. Baseline exists (onboarding complete)
 * 3. Subscription tier chosen (free or sovereign+)
 */
export default async function ChatPage() {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) redirect("/onboard?mode=login");

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/onboard?mode=login");

  const payload = await verifyJWT(token, secret);
  if (!payload) redirect("/onboard?mode=login");

  const user = await env.DB.prepare("SELECT id, subscription_tier FROM users WHERE id = ?")
    .bind(payload.sub)
    .first<User & { subscription_tier: string | null }>();
  if (!user) redirect("/onboard?mode=login");

  // Gate: must have completed baseline (onboarding)
  const baseline = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?")
    .bind(payload.sub)
    .first<{ user_id: string }>();
  if (!baseline) redirect("/onboard");

  // Gate: must have chosen a subscription tier (free or sovereign+)
  if (!user.subscription_tier) redirect("/upgrade?from=baseline");

  return <ChatClient />;
}