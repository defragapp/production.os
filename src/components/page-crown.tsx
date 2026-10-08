import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * The platform's opening ritual: the gold crown hairline, a category eyebrow,
 * a serif title, and one grounding deck line. Extracted from the landing's
 * section crown so every public surface — homepage sections, the three lenses,
 * Philosophy, FAQ, Support — opens the same deliberate way instead of a bare
 * heading. The gold hairline + accent eyebrow are the brand's signature thread;
 * seeing them on only the homepage was the tell that pages weren't intentional.
 *
 * `align="center"` for hero-style openings, `align="left"` for reading pages.
 * `as="h1"` on a page's top crown, `as="h2"` for a section within a page.
 */
export function PageCrown({
  eyebrow,
  title,
  deck,
  align = "center",
  as: Tag = "h1",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  deck?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={cn(centered ? "text-center" : "text-left", className)}>
      {eyebrow && (
        <>
          <span className={cn("crown-gold mb-4", centered && "mx-auto")} aria-hidden="true" />
          <Eyebrow accent className="mb-3">
            {eyebrow}
          </Eyebrow>
        </>
      )}
      <Tag
        className={cn(
          "font-display font-normal tracking-tight text-foreground",
          Tag === "h1"
            ? "text-[2rem] leading-[1.12] md:text-[2.75rem] md:leading-[1.06]"
            : "text-[1.75rem] md:text-4xl",
        )}
      >
        {title}
      </Tag>
      {deck && (
        <p
          className={cn(
            "mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base",
            centered && "mx-auto",
          )}
        >
          {deck}
        </p>
      )}
    </div>
  );
}
