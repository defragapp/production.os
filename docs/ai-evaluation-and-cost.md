# AI Evaluation & Cost — Sovereign OS (live)

Source-level findings for the completion review. No test account/auth secrets are
required for the static analysis below; the dynamic end-to-end eval (a real chat
turn against a granted connection) still requires a second consented account and
is noted in `TODO.md` as gated on manual invite/email verification.

---

## 1. Tone & voice (source-level audit)

Reviewed: `src/lib/sovereign-prompt.ts`, `src/lib/sovereign-reasoning.ts`,
`src/lib/sovereign-safety.ts`, `src/app/api/chat/route.ts`,
`src/lib/sovereign-limiter.ts`.

**Voice rules (from `buildSystemPrompt`):**
- Do not diagnose. "You do not name pathology. You do not use clinical language."
- Never tell the user who they are — offer possibilities for examination.
- Never validate interpretations of other people's motives as fact.
- Never install identity labels. No "you are [X]" verdicts.
- No moralizing. No "you should" directives.
- Keep the four evidence states *internal* — Observed / Baseline-supported /
  Interpretive / Unknown are woven into prose, never printed as headings or labels.
- Speak in the **second person** ("you", "your Baseline"), never third person
  ("the user", "their Baseline").
- Never echo an internal Baseline quality tag. An earlier `(Jupiter — expansion)`
  parenthetical leaked verbatim into answers; the label is now folded into prose
  (`Jupiter expansion: …`) and the directive forbids printing it — pinned by a
  regression assertion in `sovereign-prompt.test.ts`.

**Pressure/under-pressure phrasing is consistently hedged:** `deriveUnderusedCapacities`
uses "may express under different conditions / may be underexpressed"; pressure
responses are formatted as "may push harder … when stressed" (never categorical).

**Safety layer (`sovereign-safety.ts`):** flags crisis indicators, detects
safety-sensitive contexts, and routes to a supported, non-directive response.
Confirmed deployed in the chat route pipeline.

**Emotive glyphs:** none found — no emoji anywhere in `src` or `public`. The brand is a
non-representational "overflowing cup" emblem with a single source of truth
(`src/components/ui/brand-mark.tsx`): a stripped-goblet silhouette (`StrippedIcon`) drives
the tab/favicon icon (`icon.svg`, on a graphite plate), the iOS home-screen icon
(`apple-icon.tsx`), and the nav/footer lockup (`logo.tsx`), while the illustrated
line mark (`Emblem`) appears on the social card (`opengraph-image.tsx`).

---

## 2. Reasoning quality (source-level)

- `extractUserDefinitions` captures the user's own definitions of key concepts and
  feeds them back when those concepts recur ("What does X mean to you?").
- `detectMeaningTargets` + `findMeaningTriggers` keep the conversation on the
  user's material, not the model's.
- Consensus-gated: AI only receives baseline + consented peer context
  (`hasConsentedPeers`, `BASELINE_SHARED_WITH`), enforced server-side in the chat route.

**Human Design / Gene Keys labels** are rendered as neutral "capacity / theme"
labels with explicit fallbacks (`"Insufficient data for … derivation"`), so the
lite model is never asked to hallucinate structure it cannot see.

---

## 3. Cost model (lite model assessment)

Current model: `@cf/meta/llama-3.1-8b-instruct-fp8` via the Sovereign AI Gateway
(`sovereign-ai-gateway`, `AI_GATEWAY_ID` in wrangler.jsonc), which routes through
Cloudflare AI Gateway. This is already the **lite** variant: fp8 8B, not a 70B+
class model.

Per-turn output is bounded by an explicit `max_tokens` of **1,024**
(`DEFAULT_MAX_TOKENS` in `sovereign-model.ts`) so an answer never truncates
mid-sentence. That is higher than the earlier implicit ~400-token ceiling, so it
raises worst-case neuron cost per turn; see `docs/scaling-plan.md` §1.1 for the
revised math (~21–38 neurons/turn, ~250–450 free completions/day across the
shared 10k-neuron pool).

**Free-tier budget guards (all server-enforced before any inference):
- Per-day chat cap: `chat-limit:<user>/<date>` in KV (default 5 msgs/day free).
- Per-minute rate limit: 20 msgs/window per user (`chat/route.ts`).
- Checkout rate limit: 10 Stripe sessions/hour/user.
- Invite cap: 5 pending invites max, 7-day TTL.

Net effect: the cost of the free tier is bounded (~5 model calls/day/user × fp8-8B),
which is why the lite model is the right default. If further cost reduction is
desired, switch the gateway default to `@cf/meta/llama-3.1-8b-instruct-lite` or
`@cf/thebloke/…-awq` — but 8B-fp8 is a reasonable floor for the tone/safety work.

---

## 4. Cloudflare free-feature recommendations (already adopted)

Checked against the current `wrangler.jsonc` + bindings; all items below are
either already live or cheap/free to finish:

1. **AI Gateway — done.** Route all prompts through the gateway for caching,
   retries, fallback, and cost analytics.
2. **KV session + rate limits — done.** No paid D1/R2 required for session state.
3. **Turnstile — done.** Bot check on signup/login.
4. **D1 (free tier) — done.** SQLite for baseline/threads/relationships.
5. **Workers free tier — done.** No custom domain TLS cost.
6. **Static assets via Workers static — done** (`.open-next`, ASSETS binding).

**Still "free but recommended" (small effort):**
- Enable Cloudflare **Caching** for the public marketing/landing payloads (Static
  Asset caching with a short TTL), so free-tier billing stays near zero.
- Keep KV `expirationTtl` on rate-limit keys (already TTL-based).
- Consider `@cloudflare/ai` default model swap above only if cost targets tighten.

---

## 5. Gaps / open items

- **Dynamic E2E AI eval** still requires a second consented test account
  (invite → email verify → accept → chat). Tracked in `TODO.md`.
- Brand mark: the "emblematic" overflowing-cup system is now shipped as a single
  source of truth (`brand-mark.tsx`) across nav, favicon, iOS icon, and the social
  card — the earlier "more emblematic mark" nicety is done.
