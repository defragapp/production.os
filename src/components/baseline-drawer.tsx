"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BaselineData } from "@/lib/types";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/**
 * The collapsible "Your Baseline" panel (composer-level, not per-message).
 * Simplified titles, every framework, no raw JSON. Collapsed by default so the
 * AI holds the detail and the panel only adds context on request.
 *
 * When `overlay` is true, the open panel folds upward from the toggle button as
 * a floating, scrollable popover instead of pushing the page layout down —
 * used by the landing demo so opening it never grows the page.
 */
export function BaselineDrawer({ data, overlay }: { data?: BaselineData; overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  const d = data ?? {};
  const astro = d.astrology as Record<string, unknown> | undefined;
  const hd = d.humanDesign as Record<string, unknown> | undefined;
  const num = d.numerology as Record<string, unknown> | undefined;

  const sun = str(astro?.sunSign);
  const moon = str(astro?.moonSign);
  const rising = str(astro?.risingSign);
  const planets = (astro?.planets as Record<string, Record<string, unknown>> | undefined) ?? {};

  const hdType = str(hd?.type);
  const hdStrategy = str(hd?.strategy);
  const hdAuthority = str(hd?.authority);
  const hdProfile = str(hd?.profile);
  const centers = Array.isArray(hd?.definedCenters) ? (hd.definedCenters as string[]) : [];
  const channels = Array.isArray(hd?.definedChannels)
    ? (hd.definedChannels as Array<{ gates?: number[]; name?: string }>).map((c) =>
        c.gates ? `${c.gates.join("–")} ${c.name ?? ""}`.trim() : (c.name ?? ""),
      ).filter(Boolean)
    : [];
  const geneKeys = Array.isArray((d.geneKeys as { keys?: unknown } | undefined)?.keys)
    ? ((d.geneKeys as { keys: unknown }).keys as Array<{ gate?: number; line?: number; frequency?: string; theme?: string }>)
    : [];
  const lifePath = num?.lifePath !== undefined && num?.lifePath !== null ? String(num.lifePath) : undefined;

  const chips: { label: string; value: string }[] = [];
  if (sun) chips.push({ label: "Sun", value: sun });
  if (moon) chips.push({ label: "Moon", value: moon });
  if (rising && rising !== "Unknown") chips.push({ label: "Rising", value: rising });
  if (lifePath) chips.push({ label: "Life Path", value: lifePath });

  const bodyThemes = Object.entries(planets)
    .map(([body, p]) => ({ body, sign: str(p.sign), theme: str(p.theme) }))
    .filter((p) => p.sign && p.theme);

  const content = (
    <>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{c.label}</span>
              <span className="text-xs font-medium text-foreground">{c.value}</span>
            </span>
          ))}
        </div>
      )}

      {bodyThemes.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Astrology
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {bodyThemes.map((p) => (
              <li key={p.body} className="flex items-baseline justify-between gap-3">
                <span className="capitalize">{p.body}</span>
                <span className="text-right">{p.sign} · {p.theme}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(hdType || centers.length > 0) && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Human Design
          </p>
          <p className="text-xs leading-relaxed text-foreground">
            {hdType || "—"}
            {hdProfile && hdProfile !== "0/0" ? ` · profile ${hdProfile}` : ""}
            {hdStrategy || hdAuthority ? ` (${[hdStrategy, hdAuthority].filter(Boolean).join(" · ")})` : ""}
          </p>
          {centers.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Defined centers: {centers.join(", ")}
            </p>
          )}
          {channels.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {channels.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {geneKeys.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Gene Keys
          </p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {geneKeys.slice(0, 8).map((k) => (
              <li key={`${k.gate}-${k.line}`}>
                Gate {k.gate} line {k.line} · {k.frequency} · {k.theme}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground/60">
        Your Baseline describes tendencies, not your identity. Computed from the ten natal
        bodies via the NASA/JPL Horizons API through the Sovereign derivation engine.
      </p>
    </>
  );

  return (
    <div className="relative rounded-lg border border-border/60 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Your Baseline
          </span>
          <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
            from NASA/JPL planetary data
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-[240ms] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        overlay ? (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-card p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {content}
          </div>
        ) : (
          <div className="space-y-4 border-t border-border/60 px-3 pb-3 pt-3">{content}</div>
        )
      )}
    </div>
  );
}