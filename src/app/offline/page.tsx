import type { Metadata } from "next";
import { OfflineRetry } from "@/components/offline-retry";

export const metadata: Metadata = {
  title: "Offline",
  description: "Sovereign is unreachable right now — your data is safe and waiting.",
  robots: { index: false, follow: false },
};

/**
 * The offline shell. Precached by /sw.js and served back only when a
 * navigation fails with no connection — an installed PWA in an elevator or
 * subway shows this instead of a raw browser error. It carries no user data,
 * makes no API calls, and its inline style block keeps it on-brand even if
 * the stylesheet happens to be absent from the browser cache.
 */
export default function OfflinePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "html,body{background:#0d0d0d;color:#e7e5e4;margin:0}" }} />
      <main
        id="main"
        className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-14 text-center font-sans text-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/emblem-core.png"
          alt=""
          aria-hidden="true"
          width={96}
          height={96}
          className="mb-8 opacity-90"
        />
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
          No connection
        </p>
        <h1 className="max-w-md font-display text-3xl font-normal leading-[1.15] tracking-tight text-foreground">
          Your <span className="italic">Baseline</span> is safe. We just can&apos;t reach it right now.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Sovereign keeps everything on its own servers — this page is the only thing stored on
          your device, and nothing was lost. Once you have a signal again, pick up exactly where
          you left off.
        </p>
        <OfflineRetry />
      </main>
    </>
  );
}
