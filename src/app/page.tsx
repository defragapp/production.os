import type { Metadata } from "next";
import { LandingClient } from "@/components/landing-client";

// The homepage inherits its <title> and description from the root layout, but
// it still ships an explicit canonical and its own openGraph card (reusing the
// root brand copy) so the site has a defined canonical URL and shared links
// unfurl correctly rather than falling back to whatever default the crawler picks.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sovereign OS — Understand who you are, and why your relationships work",
    description:
      "A private space to understand yourself and the people around you — grounded in your Baseline.",
    url: "/",
    type: "website",
    images: [{ url: "/opengraph-image?v=6", width: 1200, height: 630, alt: "Sovereign OS" }],
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://sovereign.defrag.app/#organization",
  name: "Sovereign OS",
  url: "https://sovereign.defrag.app",
  logo: "https://sovereign.defrag.app/brand/apple-icon.png",
  description:
    "A private AI platform for understanding yourself, your people, and the systems you live within.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://sovereign.defrag.app/support",
    email: "sovereign@defrag.app",
    availableLanguage: ["en"],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://sovereign.defrag.app/#website",
  name: "Sovereign OS",
  url: "https://sovereign.defrag.app",
  publisher: { "@id": "https://sovereign.defrag.app/#organization" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sovereign OS",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  url: "https://sovereign.defrag.app",
  description:
    "Sovereign OS is a private space to understand yourself and the people around you. It builds a personal Baseline from your birth data and helps you make sense of what keeps happening — then leaves the deciding to you.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Sovereign+ Monthly", price: "20", priceCurrency: "USD" },
    { "@type": "Offer", name: "Sovereign+ Annual", price: "99", priceCurrency: "USD" },
  ],
  publisher: { "@id": "https://sovereign.defrag.app/#organization" },
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
        text: "No. Sovereign OS is a tool for self-reflection and understanding. It does not diagnose, treat, or replace professional mental health, medical, or financial advice. If you are struggling, please reach out to a qualified professional.",
      },
    },
    {
      "@type": "Question",
      name: "What do you do with my birth data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your date, time, and place of birth are used for one thing only: computing your Baseline from NASA/JPL planetary data. It is never sold or shared, and you can delete your entire account — data included — yourself from the Account page.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between Free and Sovereign+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Free includes your full Baseline and 5 AI messages per day. Sovereign+ lifts that to 150 a day — room for any real conversation, with a fair-use ceiling that keeps scripted loops out — and lets you invite people into your relationships: $99/year, or $20/month. You can cancel anytime.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Subscriptions are managed through Stripe — open your billing portal from the Account page and cancel there. Your access continues through the end of the paid period.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
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
