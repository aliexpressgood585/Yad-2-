import type { MetadataRoute } from "next";

import { getFlatCategories } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";

/** מספר המודעות המרבי במפת האתר — Google מגביל ל-50,000 כתובות לקובץ. */
const MAX_LISTINGS = 20_000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/map`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/safety`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/business`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/accessibility`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categories = await getFlatCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    const path = parent ? `/${parent.slug}/${c.slug}` : `/${c.slug}`;
    return {
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: parent ? 0.7 : 0.9,
    };
  });

  const [listings, businesses] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: MAX_LISTINGS,
    }),
    prisma.user.findMany({
      where: { businessSlug: { not: null }, deletedAt: null, isBlocked: false },
      select: { businessSlug: true, updatedAt: true },
      take: 2000,
    }),
  ]);

  const listingPages: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${base}/item/${l.slug}`,
    lastModified: l.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const businessPages: MetadataRoute.Sitemap = businesses.map((b) => ({
    url: `${base}/business/${b.businessSlug}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...categoryPages, ...businessPages, ...listingPages];
}
