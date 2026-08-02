import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcfbf9",
    theme_color: SITE.themeColor,
    lang: "he",
    dir: "rtl",
    categories: ["shopping", "business", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "פרסום מודעה", url: "/publish", description: "פרסום מודעה חדשה" },
      { name: "המועדפים שלי", url: "/my/favorites", description: "המודעות ששמרתי" },
      { name: "הודעות", url: "/my/messages", description: "השיחות שלי" },
    ],
  };
}
