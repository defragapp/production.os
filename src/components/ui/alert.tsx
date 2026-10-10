import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The platform's single inline form message — the refined alert badge that
 * replaces the old bare red/grey text lines across the auth funnel and the
 * Baseline form. One component so every error and notice reads as the same
 * considered surface: a soft tinted panel, a leading icon, foreground text.
 * `error` uses the destructive hue on the icon only (never a screaming red
 * block); `notice` stays warm-neutral for confirmations.
 */
export function Alert({
  children,
  tone = "error",
  className,
}: {
  children: React.ReactNode;
  tone?: "error" | "notice";
  className?: string;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-sm leading-relaxed",
        tone === "error"
          ? "border-destructive/40 bg-destructive/[0.07] text-foreground"
          : "border-border bg-muted/40 text-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "error" ? "text-destructive" : "text-muted-foreground",
        )}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
