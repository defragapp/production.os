import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { WebAnalytics } from "@/components/web-analytics";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereign.defrag.app"),
  title: {
    default: "Sovereign OS — Understand the patterns in your life",
    template: "%s · Sovereign OS",
  },
  description:
    "Sovereign is a private AI platform for understanding yourself, your people, and the systems you live within — starting with your baseline.",
  applicationName: "Sovereign OS",
  manifest: "/manifest.webmanifest",
  authors: [{ name: "Sovereign OS" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sovereign OS",
  },
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
      "A private AI platform for understanding yourself, your people, and the systems you live within.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image?v=2", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
  icons: {
    icon: { url: "/icon.svg?v=2", type: "image/svg+xml" },
    shortcut: { url: "/icon.svg?v=2" },
    apple: { url: "/apple-icon?v=2", sizes: "180x180", type: "image/png" },
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign OS",
    description:
      "Understand yourself, your people, and the systems you live within.",
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
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <WebAnalytics />
      </body>
    </html>
  );
}
