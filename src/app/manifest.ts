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
        src: "/brand/icon.png?v=2",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/apple-icon.png?v=2",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}