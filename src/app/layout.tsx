import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { WebAnalytics } from "@/components/web-analytics";
import { TabBar } from "@/components/tab-bar";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  // Italic axis loaded deliberately: an italicized accent word in the display
  // serif is the editorial craft signal premium dark sites lean on.
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// device px = logical pt × pixel ratio; the URL w/h mirror that so the PNG is
// 1:1 with the backing store (Safari won't scale a startup image to fit).
type Startup = { url: string; media: string };
function splash(w: number, h: number, dpr: number, orientation: "portrait" | "landscape"): Startup {
  return {
    url: `/apple-splash?w=${w * dpr}&h=${h * dpr}`,
    media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
  };
}
const APPLE_STARTUP_IMAGES: Startup[] = [
  // iPhone 15/16 Pro & Pro Max, 13 Pro/Pro Max share the 3x tall classes.
  splash(393, 852, 3, "portrait"),
  splash(430, 932, 3, "portrait"),
  splash(390, 844, 3, "portrait"),
  splash(393, 852, 2, "portrait"),
  // iPad (10th gen) / Air / Pro 11" & 12.9"-13".
  splash(820, 1180, 2, "portrait"),
  splash(1024, 1366, 2, "portrait"),
];

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereign.defrag.app"),
  title: {
    default: "Sovereign OS — Understand who you are, and why your relationships work",
    template: "%s · Sovereign OS",
  },
  description:
    "Sovereign is a private space to understand yourself and the people around you. It builds a personal Baseline from your birth data and helps you make sense of what keeps happening — then leaves the deciding to you.",
  applicationName: "Sovereign OS",
  manifest: "/manifest.webmanifest",
  authors: [{ name: "Sovereign OS" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sovereign OS",
    // Dark launch screens for the common iPhone/iPad viewports so an installed
    // app opens straight into the brand instead of a white flash. Add more by
    // appending { url, media } rows; `media` must match the device's logical
    // size × its -webkit-device-pixel-ratio. Served by /apple-splash.
    startupImage: APPLE_STARTUP_IMAGES,
  },
  keywords: [
    "self understanding",
    "self reflection",
    "relationships",
    "baseline",
    "sovereign",
  ],
  openGraph: {
    title: "Sovereign OS — Understand who you are, and why your relationships work",
    description:
      "A private space to understand yourself and the people around you — grounded in your Baseline.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image?v=6", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
  icons: {
    // SVG first — Safari 16+, Chrome, Edge render it crisply at any DPR; the
    // PNG stays as the fallback path for older browsers and the iOS "shortcut"
    // tile. Both point to the same Ace-of-Cups mark; see public/brand/icon.svg
    // header for why the favicon is a hand-reduced silhouette instead of a
    // downscaled engraving.
    icon: [
      { url: "/brand/icon.svg", type: "image/svg+xml" },
      { url: "/brand/icon.png?v=2", type: "image/png", sizes: "64x64" },
    ],
    shortcut: [
      { url: "/brand/icon.svg", type: "image/svg+xml" },
      { url: "/brand/icon.png?v=2" },
    ],
    apple: { url: "/brand/apple-icon.png?v=2", sizes: "180x180", type: "image/png" },
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign OS",
    description:
      "Understand who you are, and why your relationships work the way they do.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  other: {
    // Prevent iOS Safari from auto-detecting numeric sequences as phone numbers
    // and inserting blue tel: links. Critical for the Baseline form (dates,
    // coordinates) and the dark premium aesthetic.
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // NOTE: no maximumScale/user-scalable cap — pinching to zoom must stay
  // available (WCAG 1.4.4 Resize Text). The old maximumScale: 1 blocked it.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* WCAG 2.4.1 Bypass Blocks: one focusable escape hatch past the
            header/nav straight into the page's <main id="main">. Off-canvas
            until keyboard-focused, then it drops in as a cream pill. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <TabBar />
        <InstallPrompt />
        <ServiceWorkerRegistration />
        <WebAnalytics />
      </body>
    </html>
  );
}
