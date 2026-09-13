import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { OnboardContent } from "./onboard-content";

/**
 * Server-side redirect for authenticated users who already have a baseline.
 * If the user is logged in and has completed onboarding, send them to /chat.
 */
export default async function OnboardPage() {
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (secret && token) {
    const payload = await verifyJWT(token, secret);
    if (payload) {
      const baseline = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?")
        .bind(payload.sub)
        .first<{ user_id: string }>();
      if (baseline) redirect("/chat");
    }
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <OnboardContent />
    </Suspense>
  );
}
