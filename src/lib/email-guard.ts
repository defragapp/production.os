/**
 * Per-recipient cap on account-request emails (F-F).
 *
 * The resend cooldown is keyed on the *session user* and the invite cap on the
 * *inviting owner*, so neither bounds how many emails one address can receive:
 * an attacker signing up many accounts (or firing invites) with the victim's
 * email turns Turnstile into a speed bump and the victim's inbox into the
 * target. Password reset already learned this lesson and caps per recipient
 * (`reset-rl:${email}`, 5/hour in the reset route) — this applies the same
 * established shape to the verify/resend/welcome/invite paths behind ONE
 * shared counter, because the attack is "emails to one address", not
 * "emails of one template".
 *
 * Known, accepted limit: KV has no compare-and-swap, so a large burst of
 * concurrent requests can all read the same count and overshoot the cap —
 * identical to the reset limiter and already ledgered as the F-H
 * non-atomic-limiter item. This is an abuse brake, not a budget.
 *
 * Degradation policy matches `claimAnswer`: if KV cannot be consulted the
 * send proceeds. A KV hiccup must not dead-end real signups.
 */
import type { AppEnv } from "./env";

/** Emails one recipient may start receiving per window, across templates. */
export const RECIPIENT_CAP = 6;
/** Window in seconds; KV restarts it on each accepted send (rolling-ish). */
const RECIPIENT_WINDOW_TTL = 3600;

function recipientKey(email: string): string {
  return `recipient-mail-rl:${email.trim().toLowerCase()}`;
}

/**
 * True when this recipient may receive another account-request email right
 * now. Consumes one slot when it returns true. Fails open on KV errors.
 */
export async function recipientMailAllowed(env: AppEnv, email: string): Promise<boolean> {
  const key = recipientKey(email);
  try {
    const count = parseInt((await env.SESSION_KV.get(key)) || "0", 10);
    if (count >= RECIPIENT_CAP) return false;
    await env.SESSION_KV.put(key, String(count + 1), { expirationTtl: RECIPIENT_WINDOW_TTL });
    return true;
  } catch (err) {
    console.error("[email-guard] recipient check failed — letting the send through:", err);
    return true;
  }
}
