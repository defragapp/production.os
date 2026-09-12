/**
 * Transactional email via Resend (api.resend.com).
 * Branded from Sovereign OS (sovereign@defrag.app).
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

/** Branded Sovereign OS email shell: dark wordmark header, body, quiet footer. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
    <div style="background:#0d0d0d;padding:20px 28px">
      <span style="color:#fafafa;font-size:15px;font-weight:600;letter-spacing:0.22em">SOVEREIGN<span style="color:#a1a1aa">.OS</span></span>
    </div>
    <div style="padding:28px">
      <h2 style="color:#18181b;font-size:20px;margin:0 0 12px">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e4e4e7">
      <p style="color:#a1a1aa;font-size:12px;margin:0">© Sovereign OS — Your personal intelligence layer.</p>
    </div>
  </div>
</div>`;
}

/** Styled primary action button for email bodies. */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;font-size:14px">${label}</a>`;
}

/** Styled link whose visible text stays on-brand instead of exposing the URL. */
export function emailLink(href: string, label: string): string {
  return `<a href="${href}" style="color:#18181b;font-weight:600">${label}</a>`;
}

export async function sendTransactionalEmail(env: AppEnv, opts: SendEmailOptions): Promise<void> {
  const fromEmail = env.FROM_EMAIL || "sovereign@defrag.app";
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
