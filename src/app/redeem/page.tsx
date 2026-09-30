import type { Metadata } from "next";
import { RedeemCard } from "./redeem-card";

export const dynamic = "force-dynamic";

/**
 * A gifted-pass link is shared through iMessage and email, where the preview
 * card is the whole pitch. These tags are what the recipient sees before they
 * tap, so they read as an invitation, not a checkout page.
 */
export const metadata: Metadata = {
  title: "You've been invited to 30 days of Sovereign+",
  description: "Redeem your private 30-day Sovereign+ pass.",
  // A redemption link is meant for one person, not for search engines — the
  // OpenGraph tags below still render the preview card for iMessage/email.
  robots: { index: false, follow: false },
  openGraph: {
    title: "You've been invited to 30 days of Sovereign+",
    description: "Redeem your private 30-day Sovereign+ pass.",
    type: "website",
    url: "https://sovereign.defrag.app/redeem",
  },
  twitter: {
    card: "summary",
    title: "You've been invited to 30 days of Sovereign+",
    description: "Redeem your private 30-day Sovereign+ pass.",
  },
};

export default function RedeemPage() {
  return <RedeemCard />;
}
