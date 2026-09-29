/** Free-tier daily AI chat message limit per user. */
export const FREE_TIER_DAILY_LIMIT = 5;

/**
 * Sovereign+ daily fair-use ceiling. Generous enough that no honest session
 * can reach it — and a hard stop so a scripted loop, or a gift pass shared
 * around, can never burn thousands of Workers AI calls in one UTC day.
 * The owner account is exempt (see /api/chat): the person operating the
 * platform should never be gated out of their own product.
 */
export const SOVEREIGN_PLUS_DAILY_LIMIT = 150;