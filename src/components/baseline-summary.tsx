import type { BaselineData } from "@/lib/types";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/**
 * Human-readable baseline summary for the chat UI.
 * Replaces the raw JSON dump with a legible highlight card while keeping
 * the full reference data one tap away.
 */
export function BaselineSummary({ data }: { data: BaselineData }) {
  const astro = data.astrology as Record<string, unknown> | undefined;
  const hd = data.humanDesign as Record<string, unknown> | undefined;
  const num = data.numerology as Record<string, unknown> | undefined;

  const sun = str(astro?.sunSign);
  const moon = str(astro?.moonSign);
  const rising = str(astro?.risingSign);
  const hdType = str(hd?.type);
  const lifePath = num?.lifePath;

  const chips: { label: string; value: string }[] = [];
  if (sun) chips.push({ label: "Sun", value: sun });
  if (moon) chips.push({ label: "Moon", value: moon });
  if (rising && rising !== "Unknown") chips.push({ label: "Rising", value: rising });
  if (lifePath !== undefined && lifePath !== null) chips.push({ label: "Life Path", value: String(lifePath) });
  if (hdType) chips.push({ label: "Design", value: hdType });

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 text-left">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Your Baseline
      </p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs"
            >
              <span className="text-muted-foreground">{c.label}</span>
              <span className="font-medium text-foreground">{c.value}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Baseline loaded.</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer select-none text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          View reference data
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-background/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}