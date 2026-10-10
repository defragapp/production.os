import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * The birth-data reassurance. The most sensitive ask in the product (date,
 * time, and place of birth) deserves the reason in one box directly above the
 * form — not a page a stranger has to scroll past.
 *
 * Originally shown only to people bounced back from /chat (?from=chat); it now
 * also sits on the signup Baseline step, because that is where a first-time
 * user actually decides whether to trust the ask. One component, one box, no
 * second copy system.
 */
export function WhyWeAskFirst() {
  return (
    <div className="mb-6 rounded-panel border border-border/60 bg-surface-2 px-4 py-4">
      <Eyebrow as="p" scale="sm">
        Why we ask first
      </Eyebrow>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        Chat opens the moment your Baseline exists. It is the plain-language picture your
        conversations are read against — where you tend to start, what keeps coming back, which
        threads are yours to carry. Without it, every answer starts from nothing and has to guess.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Your birth time and place are used for one thing only: computing that starting point from
        NASA/JPL planetary positions. Nothing is shared without a yes, and you can update these
        details here any time. It takes about a minute.
      </p>
    </div>
  );
}
