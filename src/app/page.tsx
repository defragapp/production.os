import { LandingClient } from "@/components/landing-client";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sovereign OS",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  url: "https://sovereign.defrag.app",
  description:
    "Your personal intelligence layer. Sovereign OS computes a personal baseline from NASA/JPL planetary data and uses AI to surface the patterns shaping how you think, feel, and relate.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Sovereign+ Monthly", price: "9", priceCurrency: "USD" },
    { "@type": "Offer", name: "Sovereign+ Annual", price: "79", priceCurrency: "USD" },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingClient />
    </>
  );
}
