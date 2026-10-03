import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/content/blog";

const BASE = "https://sovereign.defrag.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.published + "T00:00:00Z"),
    changeFrequency: "yearly",
    priority: 0.6,
  }));
  return [
    { url: BASE + "/", changeFrequency: "weekly", priority: 1 },
    { url: BASE + "/about", changeFrequency: "monthly", priority: 0.7 },
    { url: BASE + "/self", changeFrequency: "monthly", priority: 0.7 },
    { url: BASE + "/people", changeFrequency: "monthly", priority: 0.7 },
    { url: BASE + "/systems", changeFrequency: "monthly", priority: 0.7 },
    { url: BASE + "/blog", changeFrequency: "weekly", priority: 0.7 },
    { url: BASE + "/support", changeFrequency: "monthly", priority: 0.4 },
    { url: BASE + "/faq", changeFrequency: "monthly", priority: 0.5 },
    { url: BASE + "/terms", changeFrequency: "yearly", priority: 0.3 },
    { url: BASE + "/privacy", changeFrequency: "yearly", priority: 0.3 },
    ...blogEntries,
  ];
}
