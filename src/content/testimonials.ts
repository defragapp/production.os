/**
 * Testimonials — social proof slot for the landing page.
 *
 * CONTRACT: this file is the ONLY source of quotes. The <Testimonials />
 * component renders nothing when the array is empty, which is the current
 * production state. We will NOT ship fabricated quotes, "anonymous beta
 * user" placeholders, or stock-photo personas — an investor deck that
 * screenshots this section will screenshot an absent section, and that is
 * more credible than inventing social proof.
 *
 * To add a real quote:
 *   1. Get explicit written permission from the person, ideally in-thread
 *      from their Sovereign account (that's the strongest form — we can
 *      verify they're a real user without exposing the content of their
 *      private messages).
 *   2. Confirm they're comfortable with their name / role / handle appearing
 *      on a public marketing surface.
 *   3. Add an entry below. Keep quotes in their own words — light edits for
 *      length only, never to change meaning or add claims they didn't make.
 *
 * The `source` field is a link back to wherever they said it (their own
 * blog / a public post) — leave undefined for private permission and the
 * card will render without a link.
 */
export type Testimonial = {
  quote: string;
  name: string;
  role?: string;
  source?: string;
};

export const TESTIMONIALS: Testimonial[] = [];
