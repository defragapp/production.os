import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { WebAnalytics } from "@/components/web-analytics";
import { TabBar } from "@/components/tab-bar";
import { InstallPrompt } from "@/components/install-prompt";
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
    // Dark launch screens for the common iPhone/iPad viewports so an installed
    // app opens straight into the brand instead of a white flash. Add more by
    // appending { url, media } rows; `media` must match the device's logical
    // size × its -webkit-device-pixel-ratio. Served by /apple-splash.
    startupImage: APPLE_STARTUP_IMAGES,
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
    images: [{ url: "/opengraph-image?v=3", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
  icons: {
    icon: { url: "/icon.svg?v=4", type: "image/svg+xml" },
    shortcut: { url: "/icon.svg?v=4" },
    apple: { url: "/apple-icon?v=3", sizes: "180x180", type: "image/png" },
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
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <TabBar />
        <InstallPrompt />
        <WebAnalytics />
      </body>
    </html>
  );
}
