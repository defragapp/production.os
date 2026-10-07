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
  /** Plain-text alternative, generated from the rendered HTML on every send. */
  text: string;
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

/** HTML-escape a runtime string before it goes into a template body. */
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Branded Sovereign OS email shell: dark graphite surface, mono wordmark header, cream body, quiet footer. Mirrors the deployed product theme (warm graphite + cream glass).
 *
 * Client-robustness rules baked in here, because every template shares this shell:
 * - `bgcolor` attributes alongside CSS: Outlook for Windows ignores `background` on
 *   <body>/<table>, which would drop cream text onto white.
 * - `color-scheme` + `supported-color-schemes`: without a declared scheme, Gmail and
 *   Outlook dark mode re-invent the palette and can invert text into illegibility.
 * - a hidden preheader: otherwise the inbox preview line shows the footer instead.
 */
export function emailShell(title: string, bodyHtml: string, preheader?: string): string {
  const preview = esc(preheader ?? title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  /* Keep clients that honour prefers-color-scheme from repainting our surfaces. */
  :root { color-scheme: dark light; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #0c0b09 !important; }
    .sovereign-card { background-color: #141110 !important; }
  }
  @media (max-width: 480px) {
    .sovereign-card { width: 100% !important; }
    .sovereign-pad { padding: 24px 18px !important; }
  }
</style>
</head>
<body style="margin:0;padding:32px 16px;background:#0c0b09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" bgcolor="#0c0b09">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;">${preview}&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>
<table role="presentation" class="sovereign-card" width="100%" cellpadding="0" cellspacing="0" align="center" bgcolor="#141110" style="max-width:480px;margin:0 auto;background:#141110;border-radius:12px;border:1px solid rgba(250,245,236,0.08);border-collapse:separate;">
<tr>
<td style="background:#0c0b09;padding:22px 28px;text-align:center;border-bottom:1px solid rgba(250,245,236,0.08);border-radius:12px 12px 0 0;">
<span style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;color:#f4efe4;font-size:14px;font-weight:600;letter-spacing:0.22em;">
SOVEREIGN<span style="color:#8a857b">.OS</span>
</span>
</td>
</tr>
<tr>
<td class="sovereign-pad" style="padding:30px 28px;text-align:center;">
<h2 style="color:#f4efe4;font-size:20px;font-weight:600;margin:0 0 16px;text-align:center;line-height:1.3;">${title}</h2>
<div style="text-align:center;color:#c2bcb0;">${bodyHtml}</div>
</td>
</tr>
<tr>
<td style="padding:18px 28px;border-top:1px solid rgba(250,245,236,0.08);text-align:center;border-radius:0 0 12px 12px;">
<p style="color:#8a857b;font-size:12px;margin:0;line-height:1.5;">&copy; Sovereign OS &mdash; Your personal intelligence layer.</p>
<p style="color:#8a857b;font-size:12px;margin:6px 0 0;line-height:1.5;"><a href="https://sovereign.defrag.app/support" style="color:#a8a297;text-decoration:underline;">Get help</a> &middot; <a href="https://sovereign.defrag.app/privacy" style="color:#a8a297;text-decoration:underline;">Privacy</a></p>
</td>
</tr>
</table>
</body>
</html>`;
}

/** Named entities this codebase actually emits (see `esc`, the footer, the receipt table). */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "\u2014", ndash: "\u2013", middot: "\u00b7", bull: "\u2022", copy: "\u00a9",
  reg: "\u00ae", trade: "\u2122", hellip: "\u2026", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201c", rdquo: "\u201d", zwnj: "\u200c", zwj: "\u200d",
};

/** Decode entities left by `esc` and the shell's punctuation, numeric first. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Rendered HTML -> the plain-text part every send carries.
 * Readers that refuse HTML (some corporate Outlook and terminal clients) show only
 * this, and inbox previews use it as a fallback, so it must leak no markup and no
 * raw entities. Link destinations are kept because the recipient cannot click them.
 *
 * Security note: the HTML arrives already escaped by `esc`, so decoding brings back
 * the characters a submitter typed (the support form is public). A decoded
 * `<script>…</script>` is inert in a text/plain part, but reproducing live tag
 * syntax in any mail part is what gate F-D forbids — so tag-shaped runs are
 * rewritten to `[tag]` brackets, which stay readable (`Name [someone@x.com]`) and
 * can never be mistaken for markup by a client that sniffs the text part as HTML.
 */
export function toPlainText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "") // MSO conditional comments (and their inner <style>)
    .replace(/<div style="display:none;[^"]*"[\s\S]*?<\/div>/gi, "") // hidden preheader
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
    const text = label.replace(/<[^>]+>/g, "").trim();
    return text && text !== href ? `${text} ${href}` : text || href;
  });
  s = s
    .replace(/<\/?(p|div|h[1-6]|tr|li|table|tbody)[^>]*>/gi, "\n")
    .replace(/<br\s*\/>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  // Decode first, then defuse: only user-supplied text can still look like a tag here.
  s = s.replace(/<(\/?[A-Za-z][^<>\n]{0,120}?)>/g, "[$1]");
  s = s.replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, "");
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Styled primary action button for email bodies: solid cream, dark label (reads as --primary). */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f4efe4;color:#141210;padding:13px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;font-size:14px;line-height:1.1;mso-padding-alt:0;mso-line-height-rule:exactly;"><span style="mso-fit-shape-to-text:true;">${label}</span></a>`;
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
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your account is ready. Complete your Baseline to begin.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/onboard`, "Set Your Baseline")}</div>`,
        "Your account is ready — set your Baseline to begin."
      );
    },
  },

  verify: {
    subject: "Verify your email",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; token: string };
      return emailShell(
        "Verify your email",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Welcome to Sovereign OS. Confirm your email address to unlock your Baseline and personal AI chat.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/api/auth/verify?token=${v.token}`, "Verify Email")}</div>` +
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">This link expires in 48 hours. If you didn't create an account, you can safely ignore this email.</p>`,
        "One click to confirm your address and unlock your Baseline."
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
        `<div style="text-align:center">${emailButton(`${v.origin}/onboard?reset=${v.token}`, "Reset Password")}</div>`,
        "Use the link inside to choose a new password."
      );
    },
  },

  // Confirm a successful recurring payment. Belt-and-suspenders with Stripe's
  // own receipt emails (dashboard toggle) so the user always gets an on-brand
  // confirmation even if that toggle is off.
  "payment-received": {
    subject: "Your payment was received",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; amount?: string; date?: string; next?: string; interval?: string };
      // A structured summary reads as a receipt; prose alone made the amount, the
      // plan and the renewal date hard to scan.
      const rows: Array<{ k: string; val: string }> = [{ k: "Plan", val: "Sovereign+" }];
      if (v.interval === "annual") rows.push({ k: "Billing", val: "Annual" });
      else if (v.interval === "monthly") rows.push({ k: "Billing", val: "Monthly" });
      if (v.amount) rows.push({ k: "Amount", val: `$${v.amount}` });
      if (v.date) rows.push({ k: "Paid", val: v.date });
      if (v.next) rows.push({ k: "Next billing", val: v.next });
      const summary =
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" style="margin:0 0 18px;border:1px solid rgba(250,245,236,0.10);border-radius:10px;border-collapse:separate;">` +
        rows.map((r) =>
          `<tr>` +
          `<td style="padding:11px 14px;text-align:left;color:#8a857b;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid rgba(250,245,236,0.06);">${r.k}</td>` +
          `<td style="padding:11px 14px;text-align:right;color:#f4efe4;font-size:14px;font-weight:600;border-bottom:1px solid rgba(250,245,236,0.06);">${esc(r.val)}</td>` +
          `</tr>`).join("") +
        `</table>`;
      const lead = v.amount
        ? `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Thanks for staying with Sovereign OS.</p>`
        : `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Your Sovereign+ payment is confirmed and your plan remains active.</p>`;
      return emailShell(
        "Payment received",
        lead +
        summary +
        `<div style="text-align:center">${emailLink(`${v.origin}/account?tab=billing`, "View billing history")}</div>`,
        "Your Sovereign+ payment is confirmed."
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
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">You can manage your subscription any time from your account billing page.</p>`,
        "Update your payment details to keep Sovereign+ active."
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
        `<div style="text-align:center">${emailButton(`${v.origin}/upgrade`, "Resubscribe")}</div>`,
        "Your data is intact — resubscribe whenever you're ready."
      );
    },
  },

  invite: {
    subject: "You've been invited to connect",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { origin: string; inviterName: string; role: string; token: string; name?: string };
      // User-controlled strings (display name, role, invitee label) get HTML
      // escaping — they arrive from the account owner's input, not a template.
      const name = esc(v.name);
      const inviter = esc(v.inviterName);
      const role = esc(v.role);
      return emailShell(
        "Connection invitation",
        (name ? `<p style="color:#f4efe4;line-height:1.6;margin:0 0 12px;text-align:center">Hi ${name},</p>` : "") +
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 12px;text-align:center"><strong>${inviter}</strong> invited you to connect on Sovereign OS as their <strong>${role}</strong>.</p>` +
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 16px;text-align:center">Accepting lets you both explore what happens between you. Your birth data is never shared — you each keep your own Baseline, and only what you choose to reveal crosses over.</p>` +
        `<div style="text-align:center">${emailButton(`${v.origin}/invite?token=${v.token}`, "Accept Invitation")}</div>` +
        `<p style="color:#8a857b;font-size:13px;margin:16px 0 0;text-align:center">This link expires in 7 days and only works for this email address.</p>`,
        "Someone invited you to explore a relationship together."
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
        `<div style="text-align:center">${emailLink(`${v.origin}/settings?tab=connections`, "View your connections")}</div>`,
        "Your connection is now live."
      );
    },
  },

  "support-received": {
    subject: "We received your message",
    render: (_vars: Record<string, unknown>): string => {
      return emailShell(
        "We received your message",
        `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 8px;text-align:center">Thanks for reaching out. Your message to Sovereign OS has been received, and someone will get back to you.</p>` +
        `<p style="color:#8a857b;font-size:13px;margin:0;text-align:center">Please don't reply with personal details, account passwords, or payment information in support messages.</p>`,
        "We have your message and will reply soon."
      );
    },
  },

  "support-notification": {
    subject: "New support message",
    render: (vars: Record<string, unknown>): string => {
      const v = vars as { name: string; email: string; topic: string; message: string };
      // User-controlled strings from the public /support form get HTML
      // escaping — they render into the operator's inbox, so an unescaped
      // value would let a submitter inject markup/links into owner mail.
      const topic = esc(v.topic || "General");
      const body = esc(v.message).split("\n").map((line) => `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 8px">${line || "&nbsp;"}</p>`).join("");
      return emailShell(
        `Support: ${topic}`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:left">
<tr><td style="padding:2px 0"><span style="color:#8a857b;font-size:12px;">From</span><br><strong style="color:#f4efe4;font-size:14px;">${esc(v.name) || "Anonymous"} &lt;${esc(v.email)}&gt;</strong></td></tr>
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
 * Returns the delivery outcome: true on a successful Resend send or in
 * log-only mode (nothing gated on it), false when a configured send failed —
 * so callers that must not fake success (verification resend) can branch.
 */
export async function sendTemplate<T extends TemplateName>(
  env: AppEnv,
  template: T,
  to: string,
  vars: TemplateVars<T>,
  /** Optional Reply-To. The support-notification sets this to the submitting
   *  person's address so the operator can answer straight from their inbox
   *  while `from` stays the platform's own `sovereign@defrag.app`. */
  replyTo?: string,
): Promise<boolean> {
  const tmpl = EMAIL_TEMPLATES[template];
  if (!tmpl) throw new Error(`Unknown email template: ${template}`);

  const html = tmpl.render(vars as Record<string, unknown>);
  const opts: SendEmailOptions = { to, subject: tmpl.subject, html, text: toPlainText(html), replyTo };

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
          text: opts.text,
        }),
      });
      if (!response.ok) { const err = await response.json() as { message?: string }; throw new Error(`Resend error: ${err.message || response.statusText}`); }
      return true;
    } catch (err) { console.error("[email] Resend failed, falling back to log:", err); return false; }
  }
  console.log(`[email] From: ${fromEmail} → ${opts.to} | Subject: ${opts.subject}`);
  console.log(`[email] Body: ${opts.html.slice(0, 200)}...`);
  return true;
}

/** Kept so a future non-templated send (e.g. an operator blast) can reuse the payload shape. */
export type { SendEmailOptions };
