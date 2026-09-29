"use client";

import { useEffect } from "react";

/**
 * Registers the privacy-first offline shell (/sw.js) once per session.
 *
 * The Service Worker itself never caches /api/* or authenticated HTML — this
 * component only decides *when* to hand it the chance to exist:
 *  - production builds only (`NODE_ENV` is inlined at build time, so local
 *    `next dev` iteration never fights a cached worker);
 *  - never on the /offline page itself, so a broken shell can't prevent its
 *    own re-registration;
 *  - registration failure is invisible by design — the app works exactly as
 *    before without the worker.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.pathname === "/offline") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // No console noise: an unsupported or blocked registration simply
        // means no offline fallback for this browser — everything else works.
      });
    };

    // Idle-time registration keeps the first paint of the PWA untouched.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(register, 3000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
