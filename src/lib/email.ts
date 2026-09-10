/**
 * Minimal email helper — uses the Cloudflare Workers `send_email` binding
 * if configured, otherwise falls back to a no-op log.
 */
import type { AppEnv } from "./env";

interface SendEmailOptions { to: string; subject: string; html: string; }

export async function sendTransactionalEmail(env: AppEnv, opts: SendEmailOptions): Promise<void> {
  const fromEmail = env.FROM_EMAIL || "info@sovereign.os";
  if ("EMAIL" in env && env.EMAIL) {
    try {
      await (env as unknown as { EMAIL: { send: (msg: unknown) => Promise<void> } }).EMAIL.send({ from: fromEmail, to: opts.to, subject: opts.subject, html: opts.html });
      return;
    } catch (err) { console.error("[email] Send Email binding failed, falling back to log:", err); }
  }
  console.log(`[email] From: ${fromEmail} → ${opts.to} | Subject: ${opts.subject}`);
  console.log(`[email] Body: ${opts.html.slice(0, 200)}...`);
}
