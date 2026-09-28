import { cn } from "@/lib/utils";

/**
 * The platform's single micro-label (the "eyebrow" above a title, the caption
 * inside a panel). Two steps only — `md` crowns a page or section title,
 * `sm` labels something inside a surface — and nothing else in the app should
 * hand-roll the mono-uppercase-tracking treatment again.
 */
export function Eyebrow({
  children,
  className,
  scale = "md",
  as: Comp = "p",
}: {
  children: React.ReactNode;
  className?: string;
  /** md: 11px / 0.22em — section and page crowns. sm: 10px / 0.16em — in-panel labels. */
  scale?: "md" | "sm";
  as?: "p" | "span" | "h3";
}) {
  return (
    <Comp
      className={cn(
        "font-mono uppercase text-muted-foreground/80",
        scale === "md" ? "text-[11px] tracking-[0.22em]" : "text-[10px] tracking-[0.16em]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
