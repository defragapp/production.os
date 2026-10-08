"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";

type Row = {
  feature: string;
  free: string | boolean;
  plus: string | boolean;
  note?: string;
};

// The full value stack in one place. Cells use booleans (✓/—) for features
// and short strings for numeric differences ("5/day" vs "150/day").
// Ordered so the reader's eye hits the differentiators before the shared
// fundamentals — Free is genuinely useful; Sovereign+ lifts the cap to the
// fair-use ceiling defined in lib/limits.ts (150/day).
const ROWS: Row[] = [
  { feature: "AI messages per day", free: "5/day", plus: "150/day" },
  { feature: "Invite people into your relationships", free: false, plus: true },
  // No reply-order row here: nothing in the engine sorts support mail by tier
  // (the operator notification carries name/email/topic/message only), so the
  // claim would be false at the moment of payment.
  { feature: "Your full Baseline — astrology, Human Design, Gene Keys", free: true, plus: true },
  { feature: "Chat history saved across devices", free: true, plus: true },
  { feature: "Semantic recall — search your past conversations", free: true, plus: true },
  { feature: "Journeys & shared reflection cards", free: true, plus: true },
  { feature: "Data export & self-service account deletion", free: true, plus: true },
];

function Cell({ value, tone }: { value: string | boolean; tone: "free" | "plus" }) {
  if (typeof value === "string") {
    return (
      <span
        className={
          tone === "plus"
            ? "text-sm font-semibold text-foreground"
            : "text-sm text-muted-foreground"
        }
      >
        {value}
      </span>
    );
  }
  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
        <Check
          aria-hidden="true"
          strokeWidth={2.25}
          className={tone === "plus" ? "h-4 w-4" : "h-4 w-4 text-foreground/70"}
        />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/60">
      <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      <span className="sr-only">Not included</span>
    </span>
  );
}

export function PricingTable() {
  // Progressive-disclosure entry for the comparison rows: reuse the landing's
  // hand-rolled `.reveal` system (240ms easeOut, opacity-only on a table-row,
  // reduced-motion safe). A single observer on <tbody> flips every row to `.in`
  // when the table scrolls into view; per-row `transitionDelay` staggers them.
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const rows = Array.from(el.querySelectorAll("tr"));
    rows.forEach((r) => r.classList.add("js-ok", "reveal-from-up"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            rows.forEach((r) => r.classList.add("in"));
            io.disconnect();
          }
        }
      },
      // A tall tbody never reaches 15% visible while entering, so the old
      // threshold kept the whole panel blank mid-scroll. A negative bottom
      // rootMargin fires the stagger as soon as the rows cross the lower
      // 85% of the viewport — early enough to read as motion, not as a void.
      { threshold: 0, rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="mt-14 overflow-hidden rounded-lg border border-foreground/15 bg-surface-1/40">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Feature comparison between the Free and Sovereign+ plans</caption>
        <thead>
          <tr className="border-b border-foreground/15 bg-foreground/[0.03]">
            <th scope="col" className="px-5 py-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Feature
            </th>
            <th scope="col" className="w-[22%] px-5 py-4 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Free
              </span>
              <span className="mt-1 block font-display text-lg text-foreground">$0</span>
            </th>
            <th scope="col" className="w-[22%] px-5 py-4 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground font-semibold">
                Sovereign+
              </span>
              <span className="mt-1 block font-display text-lg text-foreground">
                $99<span className="font-sans text-xs text-muted-foreground">/yr</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={`reveal ${i < ROWS.length - 1 ? "border-b border-foreground/[0.08]" : ""}`}
              style={{ transitionDelay: `${i * 55}ms` }}
            >
              <th scope="row" className="px-5 py-4 text-left text-sm font-normal leading-snug text-foreground/90">
                {row.feature}
              </th>
              <td className="px-5 py-4 text-center">
                <Cell value={row.free} tone="free" />
              </td>
              <td className="px-5 py-4 text-center">
                <Cell value={row.plus} tone="plus" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/15 bg-foreground/[0.03]">
            <td className="px-5 py-4 text-xs text-muted-foreground">
              Billed yearly in US dollars. Cancel any time from your Account page — no emails.
            </td>
            <td className="px-5 py-4 text-center">
              <Link
                href="/onboard?mode=signup"
                className="btn-glass inline-flex justify-center px-4 py-2 text-xs font-medium"
              >
                Start free
              </Link>
            </td>
            <td className="px-5 py-4 text-center">
              <Link
                href="/onboard?mode=signup&next=%2Fupgrade"
                className="btn-aurora inline-flex justify-center px-4 py-2 text-xs font-medium"
              >
                Get Sovereign+
              </Link>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
