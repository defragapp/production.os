import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sovereign OS",
  description: "Synthesize your emotional expression based on your baseline data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
