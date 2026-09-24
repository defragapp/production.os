/**
 * Transactional email via Resend (api.resend.com).
 * Branded from Sovereign OS (sovereign@defrag.app).
 * Falls back to console log if RESEND_API_KEY is not set.
 */
import type { AppEnv } from "./env";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional sender-exposed reply address (e.g. the support form's user). */
  replyTo?: string;
}

/**
 * Email verification is only enforced when we can actually deliver mail.
 * Without RESEND_API_KEY the welcome/verification emails are log-only,
 * so gating would lock users out with no way to verify.
 */
export function emailVerificationEnabled(env: AppEnv): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Branded Sovereign OS email shell: dark graphite surface, mono wordmark header, cream body, quiet footer. Mirrors the deployed product theme. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:32px 16px;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#16130f;border-radius:12px;border:1px solid rgba(250,245,236,0.10);border-collapse:separate;">
<tr>
<td style="background:#0d0d0d;padding:22px 28px;text-align:center;border-bottom:1px solid rgba(250,245,236,0.08);border-radius:12px 12px 0 0;">
<span style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;color:#f4efe4;font-size:14px;font-weight:600;letter-spacing:0.22em;">
SOVEREIGN<span style="color:#8a857b">.OS</span>
</span>
</td>
</tr>
<tr>
<td style="padding:30px 28px;text-align:center;">
<h2 style="color:#f4efe4;font-size:20px;font-weight:600;margin:0 0 16px;text-align:center;">${title}</h2>
<div style="text-align:center;color:#c2bcb0;">${bodyHtml}</div>
</td>
</tr>
<tr>
<td style="padding:18px 28px;border-top:1px solid rgba(250,245,236,0.08);text-align:center;border-radius:0 0 12px 12px;">
<p style="color:#8a857b;font-size:12px;margin:0;">&copy; Sovereign OS &mdash; Your personal intelligence layer.</p>
</td>
</tr>
</table>
</body>
</html>`;
}

/** Styled primary action button for email bodies: solid cream, dark label (reads as --primary). */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f4efe4;color:#141210;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;font-size:14px">${label}</a>`;
}

/** Styled link whose visible text stays on-brand instead of exposing the URL. */
export function emailLink(href: string, label: string): string {
  return `<a href="${href}" style="color:#f4efe4;font-weight:600;text-decoration:underline">${label}</a>`;
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
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your account is ready. Complete your baseline to begin.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/onboard`, "Set Your Baseline")}</div>`
      );
    },
  },

  verify: {
    subject: "Verify your email",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; token: string };
      return emailShell(
        "Verify your email",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Welcome to Sovereign OS. Confirm your email address to unlock your baseline and personal AI chat.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/api/auth/verify?token=${v.token}`, "Verify Email")}</div>` +
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">This link expires in 48 hours. If you didn't create an account, you can safely ignore this email.</p>`
      );
    },
  },

  "password-reset": {
    subject: "Reset your password",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; token: string };
      return emailShell(
        "Reset your password",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">You requested a password reset. This link is valid for 30 minutes.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/onboard?reset=${v.token}`, "Reset Password")}</div>`
      );
    },
  },

  "billing-success": {
    subject: "Payment successful",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; amount: string; date: string; next: string };
      return emailShell(
        "Payment successful",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px;text-align:center">Your payment of <strong>$${v.amount}</strong> was processed on ${v.date}.</p>` +
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Next billing date: ${v.next}</p>` +
        `<div style="text-align:center">${emailLink(`${v.origin}/account?tab=billing`, "View billing history")}</div>`
      );
    },
  },

  // Confirm a successful recurring payment. Belt-and-suspenders with Stripe's
  // own receipt emails (dashboard toggle) so the user always gets an on-brand
  // confirmation even if that toggle is off.
  "payment-received": {
    subject: "Your payment was received",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; amount?: string; date?: string; next?: string };
      const detail = v.amount
        ? `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">We received <strong>$${v.amount}</strong>${v.date ? ` on ${v.date}` : ""}.${v.next ? ` Your next billing date is ${v.next}.` : ""}</p>`
        : `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your Sovereign+ payment is confirmed and your plan remains active.</p>`;
      return emailShell(
        "Payment received",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px;text-align:center">Thanks for staying with Sovereign OS.</p>` +
        detail +
        `<div style="text-align:center">${emailLink(`${v.origin}/account?tab=billing`, "View billing history")}</div>`
      );
    },
  },

  // Dunning: a charge failed and Stripe is retrying. Nudge the user to update
  // their payment method before the subscription lapses.
  "payment-failed": {
    subject: "We couldn't process your payment",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; attempt?: number };
      return emailShell(
        "Payment issue",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your most recent Sovereign+ payment${v.attempt && v.attempt > 1 ? ` (attempt ${v.attempt})` : ""} didn't go through. We'll retry automatically, but to keep your access uninterrupted please update your payment details.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/account?tab=billing`, "Update payment method")}</div>` +
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">You can manage your subscription any time from your account billing page.</p>`
      );
    },
  },

  // Sent once we detect the subscription has ended (webhook or sync).
  "subscription-canceled": {
    subject: "Your Sovereign+ subscription has ended",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string };
      return emailShell(
        "Subscription ended",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your Sovereign+ subscription is no longer active and your account has moved back to the free plan. Your data is safe — resubscribe whenever you're ready to.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/upgrade`, "Resubscribe")}</div>`
      );
    },
  },

  "trial-ending": {
    subject: "Your trial ends soon",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; days: number };
      return emailShell(
        "Your trial ends soon",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your free trial expires in ${v.days} day${v.days === 1 ? "" : "s"}. Upgrade now to keep your data and continue using Sovereign OS.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/upgrade`, "Upgrade now")}</div>`
      );
    },
  },

  invite: {
    subject: "You've been invited to connect",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; inviterName: string; role: string; token: string };
      return emailShell(
        "Connection invitation",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 12px;text-align:center"><strong>${v.inviterName}</strong> invited you to connect on Sovereign OS as their <strong>${v.role}</strong>.</p>` +
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Accepting lets you both explore what happens between you — your charts are never shared, only consented interpretations.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/invite?token=${v.token}`, "Accept Invitation")}</div>` +
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">This link expires in 7 days and only works for this email address.</p>`
      );
    },
  },

  "invite-accepted": {
    subject: "Your connection was accepted",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; inviteeName: string; role: string };
      return emailShell(
        "Connection accepted",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center"><strong>${v.inviteeName}</strong> accepted your invitation. You're now connected as ${v.role}.</p>` +
        `<div style="text-align:center">${emailLink(`${v.origin}/settings?tab=connections`, "View your connections")}</div>`
      );
    },
  },

  "support-received": {
    subject: "We received your message",
    render: (_vars: Record<string, unknown>): string => {
      return emailShell(
        "We received your message",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 8px;text-align:center">Thanks for reaching out. Your message to Sovereign OS has been received, and someone will get back to you.</p>` +
        `<p style="color:#8a857b;font-size:13px;margin:0;text-align:center">Please don't reply with personal details, account passwords, or payment information in support messages.</p>`
      );
    },
  },

  "support-notification": {
    subject: "New support message",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { name: string; email: string; topic: string; message: string };
      const topic = v.topic || "General";
      const body = v.message.split("\n").map((line) => `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 8px">${line || "&nbsp;"}</p>`).join("");
      return emailShell(
        `Support: ${topic}`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:left">
<tr><td style="padding:2px 0"><span style="color:#8a857b;font-size:12px;">From</span><br><strong style="color:#f4efe4;font-size:14px;">${v.name || "Anonymous"} &lt;${v.email}&gt;</strong></td></tr>
<tr><td style="padding:8px 0 2px"><span style="color:#8a857b;font-size:12px;">Topic</span><br><strong style="color:#f4efe4;font-size:14px;">${topic}</strong></td></tr>
<tr><td style="padding:8px 0 2px"><span style="color:#8a857b;font-size:12px;">Message</span><br><div style="margin-top:4px">${body}</div></td></tr>
</table>`
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
        body: JSON.stringify({
          from: `Sovereign OS <${fromEmail}>`,
          to: [opts.to],
          reply_to: opts.replyTo,
          subject: opts.subject,
          html: opts.html,
        }),
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
        body: JSON.stringify({
          from: `Sovereign OS <${fromEmail}>`,
          to: [opts.to],
          reply_to: opts.replyTo,
          subject: opts.subject,
          html: opts.html,
        }),
      });
      if (!response.ok) { const err = await response.json() as { message?: string }; throw new Error(`Resend error: ${err.message || response.statusText}`); }
      return;
    } catch (err) { console.error("[email] Resend failed, falling back to log:", err); }
  }
  console.log(`[email] From: ${fromEmail} → ${opts.to} | Subject: ${opts.subject}`);
  console.log(`[email] Body: ${opts.html.slice(0, 200)}...`);
}
