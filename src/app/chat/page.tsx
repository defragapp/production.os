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
 * edge middleware is bypassed, a missing/expired JWT or unknown user results
 * in a redirect to /onboard before any chat HTML is sent to the client.
 */
export default async function ChatPage() {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) redirect("/onboard?mode=login");

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/onboard?mode=login");

  const payload = await verifyJWT(token, secret);
  if (!payload) redirect("/onboard?mode=login");

  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
    .bind(payload.sub)
    .first<User>();
  if (!user) redirect("/onboard?mode=login");

  return <ChatClient />;
}