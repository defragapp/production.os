import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

/**
 * Branded loading state shared across routes.
 * Replaces bare "Loading..." text with the sovereign ring + a slow pulse.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingScreen({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <Logo showWordmark={false} href="#" />
      <Spinner className="h-5 w-5" />
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}