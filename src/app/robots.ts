import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/terms", "/privacy"],
      disallow: ["/api/", "/chat", "/baseline", "/upgrade", "/account", "/onboard"],
    },
    sitemap: "https://sovereign.defrag.app/sitemap.xml",
  };
}
