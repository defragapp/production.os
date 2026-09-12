/**
 * Transactional email via Resend (api.resend.com).
 * Branded from Sovereign OS (info@sovereign.os).
 * Falls back to console log if RESEND_API_KEY is not set.
 */
import type { AppEnv } from "./env";

interface SendEmailOptions { to: string; subject: string; html: string; }

/**
 * Email verification is only enforced when we can actually deliver mail.
 * Without RESEND_API_KEY the welcome/verification emails are log-only,
 * so gating would lock users out with no way to verify.
 */
export function emailVerificationEnabled(env: AppEnv): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Standard HTML email shell for transactional messages. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#18181b">${title}</h2>${bodyHtml}</div>`;
}

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
