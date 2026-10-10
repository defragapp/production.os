import type { Metadata } from "next";

/**
 * /invite is a private, token-carrying side trip — search engines and unfurl
 * bots have no business indexing it, but link previews (iMessage, WhatsApp,
 * Slack) sell the loop, so the segment ships its own OG card. Metadata lives
 * in the layout because the page itself is a client component.
 */
export const metadata: Metadata = {
  // The root layout's title template ("%s · Sovereign OS") appends the brand
  // suffix, so this carries only the page name — a literal "… — Sovereign OS"
  // here would render the suffix twice.
  title: "You're invited",
  description:
    "Someone invited you to connect on Sovereign OS — a private AI platform for understanding yourself, your people, and the systems you live within.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're invited to connect",
    description:
      "Accept your invitation and see what happens between you — with AI built for understanding, not verdicts.",
  },
  twitter: { card: "summary_large_image" },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
