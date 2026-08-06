import type { NextConfig } from "next";

import { hebrewRedirects } from "./src/lib/hebrew-routes";

/** מקורות תמונה מותרים (תמונות דמו + ספקי אחסון). */
const remoteHosts = [
  "picsum.photos",
  "fastly.picsum.photos",
  "images.unsplash.com",
  "res.cloudinary.com",
  "utfs.io",
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
];

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 * בפיתוח נדרש 'unsafe-eval' עבור React Refresh.
 * MapLibre משתמש ב-Web Workers מ-blob: וב-tiles חיצוניים.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} blob:`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' blob: data: https://${remoteHosts.join(" https://")} https://*.basemaps.cartocdn.com https://tile.openstreetmap.org`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' https://*.basemaps.cartocdn.com https://demotiles.maplibre.org https://tile.openstreetmap.org https://api.maptiler.com ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    remotePatterns: remoteHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 128, 200, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
    /*
     * `viewTransition` אינו מופעל כאן במכוון: הוא מפעיל את רכיב
     * `<ViewTransition>` של React, שאינו קיים ב-React 19.0 היציבה, ולכן
     * הוא לא היה עושה כלום. מעברי התצוגה ממומשים ישירות מול ה-API
     * הנייטיבי — ראה `src/components/view-transition-link.tsx`.
     */
  },

  serverExternalPackages: ["sharp", "web-push"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  /**
   * כל הכתובות הציבוריות לטיניות. הכתובות הישנות בעברית מפנות
   * אליהן ב-301 — ראה `src/lib/hebrew-routes.ts`.
   */
  async redirects() {
    return [
      ...hebrewRedirects(),
      { source: "/login", destination: "/auth/login", permanent: true },
      { source: "/register", destination: "/auth/register", permanent: true },
    ];
  },
};

export default nextConfig;
