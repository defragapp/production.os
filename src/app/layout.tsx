import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sovereign OS — Understand the patterns in your life",
    template: "%s · Sovereign OS",
  },
  description:
    "Sovereign is an AI platform that helps you make sense of the patterns in your life — starting with you, then looking at what happens between you and other people.",
  applicationName: "Sovereign OS",
  authors: [{ name: "Sovereign OS" }],
  keywords: [
    "AI patterns",
    "self reflection",
    "relationships",
    "baseline",
    "sovereign",
  ],
  openGraph: {
    title: "Sovereign OS — Understand the patterns in your life",
    description:
      "An AI platform for making sense of the patterns in your life and relationships.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign OS",
    description:
      "Make sense of the patterns in your life and relationships.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
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
