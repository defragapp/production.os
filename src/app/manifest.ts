import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sovereign OS",
    short_name: "Sovereign",
    description: "Understand the patterns in your life and relationships.",
    start_url: "/chat",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    icons: [
      {
        src: "/icon.svg?v=5",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon?v=4",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}