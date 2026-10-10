"use client";

import { useEffect, useState } from "react";
import { Share, X, Download } from "lucide-react";

/** beforeinstallprompt isn't in the TS DOM lib; declare the bits we use. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sovereign-install-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as Mac; include it so "Add to Home Screen" is offered.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * "Install the app" affordance for the PWA.
 *
 * - Android / desktop Chromium: capture `beforeinstallprompt` and surface a
 *   button that calls the native `prompt()`.
 * - iOS Safari: there is no install event, so show a manual "Share → Add to
 *   Home Screen" hint.
 *
 * Only shown when the app is NOT already running standalone and the user
 * hasn't dismissed it (persisted in localStorage). Renders on the post-sign-in
 * surfaces where "add to Home Screen" actually pays off.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    // Already installed? Nothing to prompt.
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // iOS keeps its own signal for "launched from the Home Screen", and older
    // Safari versions never match the display-mode query — without this the
    // hint can nag from inside the installed app itself.
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return;
    // Don't nag inside the sign-in flow itself.
    if (window.location.pathname.startsWith("/onboard")) return;

    if (isIos()) {
      setShowIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const doInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-4 pointer-events-none">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-panel border border-border/70 bg-surface-1/95 p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border/80 bg-surface-2 text-foreground">
          <Download className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {showIosHint ? "Add Sovereign to your Home Screen" : "Install Sovereign OS"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {showIosHint ? (
              <>
                Tap <Share className="inline h-3 w-3 align-text-bottom" aria-hidden="true" /> Share,
                then <span className="font-medium text-foreground">Add to Home Screen</span>.
              </>
            ) : (
              "Fast full-screen access — runs as a standalone app."
            )}
          </p>
        </div>
        {!showIosHint && installEvent && (
          <button
            type="button"
            onClick={doInstall}
            className="btn-aurora shrink-0 rounded-chip px-3.5 py-1.5 text-xs font-semibold"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="shrink-0 rounded-chip p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-hover"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
