/**
 * Horizontal funnel stepper (Sign in → Baseline → Plan).
 * Communicates the user's journey so every step feels intentional.
 */
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  className={`h-px w-6 ${done ? "bg-primary/50" : "bg-border"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-[240ms] ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                <span className="font-mono text-[11px]">
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