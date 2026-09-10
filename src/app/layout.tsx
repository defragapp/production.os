import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sovereign OS — Pattern Interruption",
  description:
    "Sovereign OS reads your baseline — astrology, human design, gene keys, and numerology — to synthesize your emotional expression and interrupt recurring patterns.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
