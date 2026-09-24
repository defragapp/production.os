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
  return <div ref={containerRef} className="flex min-h-[65px] justify-center" />;
}