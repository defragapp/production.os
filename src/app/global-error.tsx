"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself, which the
 * route-level error.tsx cannot catch. Because it replaces <html>/<body>, it
 * must render its own document shell and cannot rely on globals.css or fonts —
 * so it is styled inline to guarantee the user sees an intentional dark screen
 * rather than a blank page or a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sovereign] global error:", error);
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
          color: "#f4efe4",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <p
            style={{
              margin: "0 0 1rem",
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#a9a396",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: "0 0 1rem", fontSize: "2.25rem", fontWeight: 400, letterSpacing: "-0.01em" }}>
            This one&apos;s on us.
          </h1>
          <p style={{ margin: "0 0 2rem", fontSize: "1.125rem", lineHeight: 1.6, color: "#a9a396" }}>
            Something didn&apos;t line up on our end. Reloading usually clears it — and if it keeps
            happening, write to sovereign@defrag.app and we&apos;ll dig in.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: "0.375rem",
              padding: "0.75rem 2rem",
              fontSize: "1rem",
              fontWeight: 500,
              background: "#f4efe4",
              color: "#0d0d0d",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
