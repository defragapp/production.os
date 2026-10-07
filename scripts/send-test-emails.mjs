// Sends every transactional template to one inbox so a human can judge how it
// actually lands in a real mail client.
//
// There is deliberately NO copy of the email design in this file. It calls the
// real `sendTemplate` from src/lib/email.ts, which is the only thing that can
// tell you what a customer will see — a mirrored shell here once drifted to
// different brand colours and shipped a "trial ends soon" email for a product
// that has no free trial, which is exactly how a stale preview script misleads
// a release pass.
//
//   node scripts/send-test-emails.mjs                     # send to defragapp@gmail.com
//   node scripts/send-test-emails.mjs someone@x.com       # send elsewhere
//   node scripts/send-test-emails.mjs --dry               # render + log, send nothing
//
// Needs RESEND_API_KEY in .dev.vars (otherwise the Worker logs instead of sending).
import { readFileSync } from "node:fs";
import { sendTemplate } from "../src/lib/email.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const to = args.find((a) => a.includes("@")) || "defragapp@gmail.com";

const vars = (extra = {}) => ({ origin: "https://sovereign.defrag.app", ...extra });
// One entry per template in src/lib/email.ts. `sendTemplate` throws on an unknown
// name, so a template added or removed there fails loudly here rather than silently
// previewing the old set.
const SAMPLES = [
  ["welcome", vars()],
  ["verify", vars({ token: "SAMPLE-VERIFY-TOKEN" })],
  ["password-reset", vars({ token: "SAMPLE-RESET-TOKEN" })],
  ["payment-received", vars({ amount: "20.00", date: "October 6, 2026", next: "November 6, 2026", interval: "monthly" })],
  ["payment-failed", vars({ attempt: 2 })],
  ["subscription-canceled", vars()],
  ["invite", vars({ inviterName: "Jordan", role: "partner", name: "Riley", token: "SAMPLE-INVITE-TOKEN" })],
  ["invite-accepted", vars({ inviteeName: "Riley", role: "partner" })],
  ["support-received", vars()],
  ["support-notification", vars({ name: "Test Person", email: "test@example.com", topic: "Billing", message: "This is a preview of the operator-facing support email.\nSecond line stays on its own line." })],
];

const apiKey = (readFileSync(".dev.vars", "utf8").match(/^RESEND_API_KEY=(.*)$/m)?.[1] ?? "").trim();
if (!dry && !apiKey) { console.error("No RESEND_API_KEY in .dev.vars — use --dry to render without sending."); process.exit(1); }

const env = dry ? /** @type {*} */ ({}) : /** @type {*} */ ({ RESEND_API_KEY: apiKey, FROM_EMAIL: "sovereign@defrag.app" });

let sent = 0;
for (const [name, sample] of SAMPLES) {
  try {
    const ok = await sendTemplate(env, name, to, sample);
    if (ok) { sent++; console.log(`${dry ? "DRY  " : "SENT "} ${name}`); }
    else console.log(`FAIL ${name}`);
  } catch (err) {
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
  }
  if (!dry) await new Promise((r) => setTimeout(r, 1300)); // Resend allows 1 req/s
}
console.log(`\n${sent}/${SAMPLES.length} ${dry ? "rendered" : `delivered to ${to}`}.`);
