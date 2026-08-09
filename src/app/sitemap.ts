import type { MetadataRoute } from "next";

import { getFlatCategories } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { pricePaths } from "@/lib/hebrew-routes";
import { SITE } from "@/lib/site";
import { slugify } from "@/lib/utils";
import { cityTargets, guideTargets } from "@/lib/valuation";

/** מספר המודעות המרבי בקובץ אחד — Google מגביל ל-50,000 כתובות. */
const MAX_LISTINGS = 20_000;

/**
 * כמה מפות להצהיר עליהן כשהמסד אינו זמין בזמן הבנייה.
 *
 * המספר מכסה את קטגוריות השורש בפועל. מפה שמזהה שלה חורג ממספר
 * הקטגוריות תצא ריקה, וזה מחיר זניח לעומת החלופה — פריסה שנופלת.
 */
const FALLBACK_SHARDS = 8;

export const revalidate = 3600;

/**
 * כל קריאה למסד כאן עטופה בנפילה רכה.
 *
 * **מפת אתר אינה שווה פריסה שנכשלת.** היא נבנית מראש בזמן הבנייה,
 * ולכן מסד שאינו זמין באותו רגע — משתנה סביבה חסר ב-Vercel, מסד
 * שישן, חלון תחזוקה — הפיל את כל הדפלוי ולא רק את ה-XML. זה בדיוק
 * מה שקרה בפרודקשן: שמונה מפות נפלו ולקחו איתן אתר שלם שנבנה כהלכה.
 *
 * עכשיו מפה חסרת נתונים יוצאת חלקית, ו-ISR ממלא אותה תוך שעה.
 */
async function safe<T>(promise: Promise<T[]>, what: string): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[sitemap] ${what} לא נשלף — המפה תצא חלקית`, error);
    return [];
  }
}

/**
 * מפת האתר מפוצלת לפי קטגוריית שורש.
 *
 * לא בגלל המגבלה של 50,000 — היא רחוקה — אלא בגלל האבחון: כש-Search
 * Console מדווח על כתובות שלא נאספו, מפה אחת ענקית אומרת "משהו לא
 * נאסף" ומפה לכל קטגוריה אומרת **איזו**. זה ההבדל בין דיווח לבין
 * ממצא.
 *
 * מודעות הדגמה אינן נכנסות: בפרודקשן הן מסוננות מכל שאילתה בשכבת
 * ה-Prisma, ולכן `findMany` כאן אינו רואה אותן מלכתחילה.
 */
export async function generateSitemaps() {
  try {
    const roots = (await getFlatCategories()).filter((c) => !c.parentId);
    // 0 הוא המפה הכללית: דפים סטטיים, קטגוריות ודפי מחירון
    return [{ id: 0 }, ...roots.map((_, i) => ({ id: i + 1 }))];
  } catch (error) {
    console.error(
      "[sitemap] המסד אינו זמין בזמן הבנייה — נוצרות מפות גיבוי במקום להפיל את הפריסה",
      error,
    );
    return Array.from({ length: FALLBACK_SHARDS }, (_, id) => ({ id }));
  }
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  /*
   * `id` מגיע כמחרוזת בפועל למרות החתימה, ולכן השוואה ל-0 נכשלה
   * בשקט והמפה הכללית יצאה ריקה. המרה מפורשת ולא `==`.
   */
  const index = Number(id);
  const base = SITE.url;
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/map`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/safety`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/business`, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${base}${pricePaths.valuation}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}${pricePaths.guideIndex}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}${pricePaths.cityIndex}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/accessibility`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const flat = await safe(getFlatCategories(), "הקטגוריות");
  const categories = flat;
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

  /**
   * דפי המחירון נכללים רק כשיש עליהם מספיק מודעות — `guideTargets`
   * ו-`cityTargets` כבר מסננים לפי אותו סף שבו הדף עצמו מסרב להציג
   * מספר. כתובת שתגיע מהסיטמאפ אל דף שאומר "אין נתונים" היא בדיוק סוג
   * הדף הדל שגורם לאתר להיראות ממולא אוטומטית.
   */
  const [guides, cities] = await Promise.all([
    safe(guideTargets(), "יעדי המחירון"),
    safe(cityTargets(), "יעדי המחירים לפי עיר"),
  ]);

  const guidePages: MetadataRoute.Sitemap = [
    ...new Set(guides.map((g) => g.manufacturer)),
  ]
    .map((make) => ({
      url: `${base}${pricePaths.guide(slugify(make))}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))
    .concat(
      guides.map((g) => ({
        url: `${base}${pricePaths.guide(slugify(g.manufacturer), slugify(g.model))}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    );

  const cityPricePages: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${base}${pricePaths.city(slugify(c.city))}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  /*
   * המפה הכללית (id=0) אינה מכילה מודעות כלל, וכל מפת קטגוריה מכילה
   * רק את המודעות שתחתיה. כך אין כתובת שמופיעה בשתי מפות.
   */
  const roots = flat.filter((c) => !c.parentId);
  const root = index === 0 ? null : roots[index - 1];
  const rootIds = root
    ? [root.id, ...flat.filter((c) => c.parentId === root.id).map((c) => c.id)]
    : [];

  const [listings, businesses] = await Promise.all([
    root
      ? safe(
          prisma.listing.findMany({
            where: { status: "ACTIVE", deletedAt: null, categoryId: { in: rootIds } },
            select: { slug: true, updatedAt: true },
            orderBy: { publishedAt: "desc" },
            take: MAX_LISTINGS,
          }),
          "המודעות",
        )
      : Promise.resolve([]),
    index === 0
      ? safe(
          prisma.user.findMany({
            where: { businessSlug: { not: null }, deletedAt: null, isBlocked: false },
            select: { businessSlug: true, updatedAt: true },
            take: 2000,
          }),
          "בתי העסק",
        )
      : Promise.resolve([]),
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

  /*
   * דפי המסגרת נמצאים **רק** במפה הכללית. אילו הופיעו גם במפות
   * הקטגוריות, אותה כתובת הייתה מוגשת מכמה מפות — וזה מבטל את כל
   * הסיבה לפצל, כי כבר אי אפשר לדעת איזו מפה אחראית למה.
   */
  if (index !== 0) return listingPages;

  return [
    ...staticPages,
    ...categoryPages,
    ...guidePages,
    ...cityPricePages,
    ...businessPages,
    ...listingPages,
  ];
}
