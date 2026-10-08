"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavMenuItem = { href: string; label: string };

/**
 * A disclosure menu for the header's secondary links. Same aria-haspopup /
 * aria-expanded convention as the chat and settings menus, but navigation
 * (a list of links, not a role="menu" of commands), so it stays a plain
 * disclosure: closes on Escape, an outside click, or any route change. The
 * trigger carries the `nav-link` hook so the coarse-pointer floor in
 * globals.css raises it to the 44px tap target on touch; the rows carry
 * `tap-line` likewise. Kept to `lg` by the parent — below that the drawer
 * carries the same links as visible rows.
 */
export function NavMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: NavMenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const panelId = `nav-menu-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Reveal, never swap: close on navigation so the menu never stays open over
  // the page it just routed to.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // A child that matches the current route lights the trigger, so the active
  // section stays legible when the menu is closed.
  const childActive = items.some((item) => pathname === item.href);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "nav-link inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-[200ms]",
          childActive || open
            ? "bg-white/[0.06] text-foreground"
            : "text-foreground/65 hover:bg-white/[0.06] hover:text-foreground",
        )}
      >
        {label}
        <ChevronDown
          className={cn("ml-1 h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-50 mt-2 w-max min-w-[11rem] rounded-xl border border-border/60 bg-surface-1/95 p-1.5 shadow-2xl backdrop-blur-2xl"
        >
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-line w-full justify-start rounded-lg px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
