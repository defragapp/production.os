import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { OnboardContent } from "./onboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Create your free Sovereign OS account or sign in — a private space to understand yourself and your relationships.",
};

/**
 * Server-side redirect for authenticated users who already have a baseline.
 * If the user is logged in and has completed onboarding, send them to /chat.
 */
export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  // The query string is readable on the server here (the page is force-dynamic),
  // so the Suspense fallback can reserve the right mode. Without this, a person
  // arriving at ?mode=login saw "Create your account" flash before the real
  // form resolved. Mirrors onboard-content.tsx's own `isLogin` heading/text.
  const { mode } = await searchParams;
  const isLogin = mode === "login";

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
    <Suspense
      fallback={
        // The query string and session are unreadable during SSR, so the real
        // form can't paint server-side — but a bare "Loading…" used to swap for
        // a whole card, moving the first paint. This reserves the finished
        // signup shape (title, deck, field skeleton) so the arrival is a fade.
        <main
          id="main"
          className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden p-6"
        >
          <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
          <div className="w-full max-w-md">
            <div className="mb-5 mt-2 text-center">
              <h1 className="font-display text-3xl font-normal tracking-tight">
                {isLogin ? "Sign in" : "Create your account"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {isLogin
                  ? "Welcome back. Sign in to continue where you left off."
                  : "Start free. You can build your Baseline right after."}
              </p>
            </div>
            <FormSkeleton fields={2} label="Loading your account form…" />
          </div>
        </main>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}
