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

/**
 * Email templates registry (Option A — in-code, editable via git).
 * Each template renders full HTML using shared emailShell/emailButton primitives.
 */
const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Welcome to Sovereign OS",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string };
      return emailShell(
        "Welcome to Sovereign OS",
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your account is ready. Complete your baseline to begin.</p>` +
        emailButton(`${v.origin}/onboard`, "Set Your Baseline")
      );
    },
  },

  verify: {
    subject: "Verify your email",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; token: string };
      return emailShell(
        "Verify your email",
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Welcome to Sovereign OS. Confirm your email address to unlock your baseline and personal AI chat.</p>` +
        emailButton(`${v.origin}/api/auth/verify?token=${v.token}`, "Verify Email") +
        `<p style="color:#a1a1aa;font-size:13px;margin:16px 0 0">This link expires in 48 hours. If you didn't create an account, you can safely ignore this email.</p>`
      );
    },
  },

  "password-reset": {
    subject: "Reset your password",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; token: string };
      return emailShell(
        "Reset your password",
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">You requested a password reset. This link is valid for 15 minutes.</p>` +
        emailButton(`${v.origin}/reset?token=${v.token}`, "Reset Password")
      );
    },
  },

  "billing-success": {
    subject: "Payment successful",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; amount: string; date: string; next: string };
      return emailShell(
        "Payment successful",
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your payment of <strong>$${v.amount}</strong> was processed on ${v.date}.</p>` +
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Next billing date: ${v.next}</p>` +
        emailLink(`${v.origin}/account?tab=billing`, "View billing history")
      );
    },
  },

  "trial-ending": {
    subject: "Your trial ends soon",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; days: number };
      return emailShell(
        "Your trial ends soon",
        `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your free trial expires in ${v.days} day${v.days === 1 ? "" : "s"}. Upgrade now to keep your data and continue using Sovereign OS.</p>` +
        emailButton(`${v.origin}/upgrade`, "Upgrade now")
      );
    },
  },
} as const;

type TemplateName = keyof typeof EMAIL_TEMPLATES;
type TemplateVars<T extends TemplateName> = Parameters<typeof EMAIL_TEMPLATES[T]["render"]>[0];

/**
 * Send a templated email through Resend.
 * Falls into console.log if no API key configured (log-only mode).
 */
export async function sendTemplate<T extends TemplateName>(
  env: AppEnv,
  template: T,
  to: string,
  vars: TemplateVars<T>
): Promise<void> {
  const tmpl = EMAIL_TEMPLATES[template];
  if (!tmpl) throw new Error(`Unknown email template: ${template}`);

  const html = tmpl.render(vars as Record<string, unknown>);
  const opts: SendEmailOptions = { to, subject: tmpl.subject, html };

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
