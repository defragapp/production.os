import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

/**
 * Public Stripe configuration for the client. Returns the publishable key when
 * configured; the client falls back to hosted Checkout when it is missing.
 * Publishable keys are browser-safe by design, but the value lives in the
 * Worker's secret store (never wrangler.jsonc [vars]) and is shape-checked
 * here so a mis-set secret can't leak some other credential to the page.
 */
export async function GET() {
  const env = await getEnv();
  const pk = env.STRIPE_PUBLISHABLE_KEY || null;
  return NextResponse.json({ publishableKey: pk && pk.startsWith("pk_") ? pk : null });
}
