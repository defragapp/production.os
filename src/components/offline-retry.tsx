"use client";

import { useEffect, useState } from "react";

/**
 * The one action on the offline shell: retry the connection. Deliberately a
 * full reload rather than a fetch ping — reloading the failed navigation is
 * what actually gets the user back into the app. The secondary line appears
 * only once the browser reports the network is back, so a person standing
 * still in a subway never wonders whether it's their turn yet.
 *
 * Touch target ≥ 44×44px (WCAG 2.5.8 / Apple HIG).
 */
export function OfflineRetry() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Recovery is automatic once a signal returns: this shell only ever appears
  // when a navigation failed with no connection, so `navigator.onLine === true`
  // means the block has probably cleared. Walk the person onward — into /chat when
  // a session is live, otherwise the public / — rather than leaving them to tap.
  // The manual button below stays as the fallback for a device that reports
  // online too early or a session probe that fails.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    let cancelled = false;
    const moveOnward = async () => {
      if (!navigator.onLine) return;
      // A browser reports "online" the moment an interface is up — even in front of
      // a captive portal or while DNS is still dead. Navigating on that false
      // positive bounces straight back here through the service worker: an endless
      // loop. So only move when a probe actually answers (HTTP 200), and only once
      // per session, so one failed auto-walk can never spin.
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { user?: unknown };
        if (cancelled) return;
        try {
          if (sessionStorage.getItem("sovereign:offline-walked")) return;
          sessionStorage.setItem("sovereign:offline-walked", "1");
        } catch {}
        window.location.replace(data && data.user ? "/chat" : "/");
      } catch {
        // The network isn't really back yet. Stay on the honest shell.
      }
    };
    moveOnward();
    window.addEventListener("online", moveOnward);
    return () => {
      cancelled = true;
      window.removeEventListener("online", moveOnward);
    };
  }, []);

  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-focal min-h-[48px] min-w-[200px] rounded-chip px-8 py-3 text-sm font-semibold"
      >
        Retry connection
      </button>
      {online && (
        <p className="text-xs text-muted-foreground" role="status">
          Signal is back — tap retry.
        </p>
      )}
    </div>
  );
}
