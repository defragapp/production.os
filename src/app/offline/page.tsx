import type { Metadata } from "next";
import { OfflineRetry } from "@/components/offline-retry";
import { Eyebrow } from "@/components/ui/eyebrow";

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
        <Eyebrow className="mb-3">No connection</Eyebrow>
        <h1 className="max-w-md font-display text-3xl font-normal leading-[1.15] tracking-tight text-foreground">
          Your <span className="italic">Baseline</span> is safe. We just can&apos;t reach it right now.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Nothing was lost. Your conversation lives on this device or on our servers, depending on
          how you set Sovereign up — and it is waiting either way. Once you have a signal again,
          pick up right where you left off.
        </p>
        <OfflineRetry />
      </main>
    </>
  );
}
