import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * `btn` is a hook, not a style: it carries no declaration of its own on
 * purpose, so the coarse-pointer floor lives with the rest of the touch rules
 * in globals.css and every variant — plus whatever `asChild` renders — clears
 * 44px on a fingertip without each page opting in. `btn-size-icon` does the
 * same for the square variant, which needs a width as well as a height.
 * `btn-link` marks the one variant that is running text rather than a target —
 * it is underlined inside a sentence, and the touch floor is deliberately not
 * applied to it (see the coarse-pointer block in globals.css).
 */
const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-all duration-[240ms] ease-spring hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:hover:-translate-y-0 active:translate-y-0",
  {
    variants: {
      variant: {
        default: "btn-aurora",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "btn-glass text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "btn-link text-foreground underline-offset-4 hover:underline",
        aurora: "btn-aurora",
        glass: "btn-glass text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-control px-3",
        lg: "h-11 rounded-control px-8",
        icon: "btn-size-icon h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
