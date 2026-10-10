"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError?: () => void;
}

export function TurnstileWidget({ siteKey, onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onToken, onError });
  callbacksRef.current = { onToken, onError };

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        // The whole app is dark-first (color-scheme: dark). Turnstile defaults
        // to a light/white box that reads as a jarring blank card on the
        // signup/login/support forms, so pin it to the dark theme to match.
        theme: "dark",
        callback: (token: string) => callbacksRef.current.onToken(token),
        "expired-callback": () => callbacksRef.current.onToken(null),
        "error-callback": () => {
          callbacksRef.current.onToken(null);
          callbacksRef.current.onError?.();
        },
      });
    };

    const inject = () => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => callbacksRef.current.onError?.();
      document.head.appendChild(script);
    };

    if (window.turnstile) render();
    else inject();

    // Safety net: some content blockers drop the script without firing
    // onerror. If the API never becomes available, surface the fallback so the
    // form isn't left with an empty, non-blocking widget.
    const failTimer = setTimeout(() => {
      if (!cancelled && !window.turnstile) callbacksRef.current.onError?.();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(failTimer);
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;
  // Sized to the standard Turnstile footprint (300×65) on the graphite surface
  // token, so the container reads as an intentional dark slot from first paint.
  // Without it the wrapper is an unstyled box and the iframe's brief pre-theme
  // default flash lands on raw page background instead of dark graphite.
  // FIXED-height slot was measured and rejected: turnstile.render() injects
  // `<div><div></div><input type=hidden></div>` whose host settles at 71px
  // before the challenge iframe sizes itself, so a min-height let the slot grow
  // 65px → 71px and push the form (the residual /onboard signup shift). Pinning
  // the box with h-[65px] + overflow-hidden would hide that 6px of dead space —
  // and also clip a genuine interactive challenge whenever Turnstile needs more
  // room than the compact default. Blocking a signup to buy 0.0019 CLS is the
  // wrong trade, so the slot stays growable and the reservation moves to the
  // parent, sized to the measured 75px footprint (see onboard-content.tsx). A
  // later expansion happens on click, which the Layout Instability API already
  // exempts as recent-input.
  return (
    <div
      ref={containerRef}
      className="mx-auto flex min-h-[65px] w-[300px] max-w-full items-center justify-center overflow-hidden rounded-chip bg-surface-1"
    />
  );
}