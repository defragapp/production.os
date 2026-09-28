/**
 * Horizontal funnel stepper (Account → Baseline).
 * Communicates the user's journey so every step feels intentional.
 */
export function Stepper({
  steps,
  current,
  completed,
}: {
  steps: string[];
  current: number;
  /**
   * How many steps are genuinely finished. Defaults to `current` (the common
   * linear funnel). Override it when the user is viewing a later step without
   * having completed an earlier one, so checkmarks never lie.
   */
  completed?: number;
}) {
  const completedCount = completed ?? current;
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs">
        {steps.map((label, i) => {
          const done = i < completedCount;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && (
                <span
                  className={`h-px w-4 sm:w-6 transition-colors duration-[200ms] ${done ? "bg-primary/50" : "bg-border"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs transition-all duration-[200ms] ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : done
                    ? "border border-border/80 bg-surface-2 text-foreground"
                    : "border border-border/50 bg-surface-1/50 text-muted-foreground"
                }`}
              >
                <span className={`font-mono text-[11px] ${done ? "text-primary font-bold" : ""}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={active ? "font-medium" : ""}>{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}