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

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is this therapy or medical advice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Sovereign OS is a tool for self-reflection and pattern awareness. It does not diagnose, treat, or replace professional mental health, medical, or financial advice. If you are struggling, please reach out to a qualified professional.",
      },
    },
    {
      "@type": "Question",
      name: "What do you do with my birth data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your date, time, and place of birth are used for one thing only: computing your baseline from NASA/JPL planetary data. It is never sold or shared, and you can delete your entire account — data included — in one click from your Account page.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between Free and Sovereign+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Free includes your full baseline and 5 AI messages per day. Sovereign+ removes the daily cap, keeps your complete conversation history, and adds advanced pattern analysis — monthly at $9, or annually at $79 (save 27%).",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Subscriptions are managed through Stripe — cancel in two clicks from your Account page, and your access continues through the end of the paid period.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingClient />
    </>
  );
}
