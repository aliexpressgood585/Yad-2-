import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // אזורים אישיים, ניהול ודפי תוצאות אינם מיועדים לאינדוקס
        disallow: [
          "/api/",
          "/my/",
          "/admin/",
          "/publish",
          "/auth/",
          "/compare",
          "/offline",
          "/search",
        ],
      },
      {
        // סורקי AI מסחריים — חסימה כברירת מחדל
        userAgent: ["GPTBot", "CCBot", "Bytespider"],
        disallow: "/",
      },
    ],
    /*
     * מפת האתר מפוצלת לפי קטגוריית שורש (`sitemap/0.xml` ואילך).
     * `sitemap/0.xml` הוא האינדקס הכללי; גוגל עוקב משם לשאר.
     */
    sitemap: `${SITE.url}/sitemap/0.xml`,
    host: SITE.url,
  };
}
