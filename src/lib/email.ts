/**
 * Transactional email via Resend (api.resend.com).
 * Branded from Sovereign OS (info@sovereign.os).
 * Falls back to console log if RESEND_API_KEY is not set.
 */
import type { AppEnv } from "./env";

interface SendEmailOptions { to: string; subject: string; html: string; }

export async function sendTransactionalEmail(env: AppEnv, opts: SendEmailOptions): Promise<void> {
  const fromEmail = env.FROM_EMAIL || "info@sovereign.os";
  const apiKey = env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Sovereign OS <${fromEmail}>`, to: [opts.to], subject: opts.subject, html: opts.html }),
      });
      if (!response.ok) { const err = await response.json() as { message?: string }; throw new Error(`Resend error: ${err.message || response.statusText}`); }
      return;
    } catch (err) { console.error("[email] Resend failed, falling back to log:", err); }
  }
  console.log(`[email] From: ${fromEmail} → ${opts.to} | Subject: ${opts.subject}`);
  console.log(`[email] Body: ${opts.html.slice(0, 200)}...`);
}
