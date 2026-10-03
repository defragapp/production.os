import type { MetadataRoute } from "next";

/**
 * Crawling policy — the machine-readable half of Terms section 5.
 *
 * Public marketing and legal pages are open to search engines and AI assistants
 * (and `/llms.txt` + `/llms-full.txt` invite them deliberately). Everything that
 * requires a session, everything under `/api/`, and the onboarding funnel are not
 * offered to crawlers. Terms section 5 says the same thing in prose; if one
 * changes, change both.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/self", "/people", "/systems", "/faq", "/terms", "/privacy", "/support", "/llms.txt", "/llms-full.txt"],
      disallow: [
        "/api/",
        "/chat",
        "/baseline",
        "/upgrade",
        "/account",
        "/onboard",
        // Utility / transactional surfaces: never meant to be found via search.
        "/offline",
        "/redeem",
        "/reset",
        // Shared Intent Sigils are link-only artifacts, not search content.
        "/s/",
      ],
    },
    sitemap: "https://sovereign.defrag.app/sitemap.xml",
  };
}
