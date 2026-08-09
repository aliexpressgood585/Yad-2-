/**
 * בדיקת עשן על כל מסלול באתר — `npm run smoke [url]`.
 *
 * עוברת על כל דף, אחד-אחד, ובודקת **קוד סטטוס בפועל**. לא הנחה ולא
 * דגימה: מסלול אחד ששובר 500 בפרודקשן הוא מסלול שאף אחד לא בדק,
 * ובלוח מודעות זה בדרך כלל דווקא הדף שאליו מגיעים מגוגל.
 *
 * הפרמטרים הדינמיים נשלפים מהמסד לפני הריצה, כך שהבדיקה עוברת על
 * מודעה אמיתית, קטגוריה אמיתית ודגם רכב אמיתי — ולא על מזהה מומצא
 * שמחזיר 404 תקין ומסתיר את התקלה.
 *
 * בנוסף לסטטוס נבדק גם **תוכן**: דף שמחזיר 200 עם גוף ריק הוא דף
 * שבור בדיוק כמו 500, והוא גרוע יותר כי אף ניטור לא יתפוס אותו.
 */
import { prisma } from "../src/lib/db";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/+$/, "");

type Route = {
  path: string;
  /** סטטוסים שנחשבים תקינים. ברירת מחדל: 200 בלבד. */
  ok?: number[];
  /** מחרוזת שחייבת להופיע בגוף — ההגנה מפני "200 ריק". */
  must?: string;
  /** כמה תוכן לפחות, בבתים, אחרי הסרת תגיות. */
  minText?: number;
};

/** דפים מאחורי התחברות — 307 אל דף הכניסה הוא התנהגות נכונה. */
const AUTHED = [307, 302, 200];

async function routes(): Promise<Route[]> {
  const [category, sub, listing, business, seller] = await Promise.all([
    prisma.category.findFirst({ where: { parentId: null }, select: { slug: true } }),
    prisma.category.findFirst({ where: { parentId: { not: null } }, select: { slug: true, parent: { select: { slug: true } } } }),
    prisma.listing.findFirst({ where: { status: "ACTIVE", deletedAt: null }, select: { slug: true } }),
    prisma.user.findFirst({ where: { businessSlug: { not: null } }, select: { businessSlug: true } }),
    prisma.user.findFirst({ where: { deletedAt: null }, select: { id: true } }),
  ]);

  const list: Route[] = [
    { path: "/", must: "כדאי", minText: 400 },
    { path: "/search", minText: 200 },
    { path: "/map", minText: 100 },
    { path: "/compare", minText: 100 },
    { path: "/valuation", minText: 300 },
    { path: "/price-guide", minText: 300 },
    { path: "/city-prices", minText: 300 },
    { path: "/business", minText: 300 },
    { path: "/about", minText: 300 },
    { path: "/help", minText: 400 },
    { path: "/safety", minText: 400 },
    { path: "/terms", minText: 600 },
    { path: "/privacy", minText: 600 },
    { path: "/cookies", minText: 400 },
    { path: "/accessibility", minText: 500 },
    { path: "/offline", minText: 60 },
    { path: "/auth/login", minText: 150 },
    { path: "/auth/register", minText: 150 },
    { path: "/publish", ok: AUTHED },
    { path: "/my", ok: AUTHED },
    { path: "/my/favorites", ok: AUTHED },
    { path: "/my/messages", ok: AUTHED },
    { path: "/my/searches", ok: AUTHED },
    { path: "/my/profile", ok: AUTHED },
    { path: "/my/business", ok: AUTHED },
    { path: "/my/notifications", ok: AUTHED },
    { path: "/admin", ok: AUTHED },
    { path: "/admin/listings", ok: AUTHED },
    { path: "/admin/moderation", ok: AUTHED },
    { path: "/admin/metrics", ok: AUTHED },
    { path: "/admin/users", ok: AUTHED },
    { path: "/admin/logs", ok: AUTHED },
    { path: "/api/health", must: "status" },
    { path: "/robots.txt", must: "Sitemap" },
    { path: "/sitemap/0.xml", must: "<loc>" },
    { path: "/manifest.webmanifest", must: "icons" },
    // 404 אמיתי הוא התנהגות תקינה ולא כישלון
    { path: "/no-such-page-xyz", ok: [404] },
  ];

  if (category) list.push({ path: `/${category.slug}`, minText: 300 });
  if (sub?.parent) list.push({ path: `/${sub.parent.slug}/${sub.slug}`, minText: 200 });
  if (listing) list.push({ path: `/item/${listing.slug}`, minText: 500 });
  if (business?.businessSlug) list.push({ path: `/business/${business.businessSlug}`, minText: 200 });
  if (seller) list.push({ path: `/u/${seller.id}`, minText: 200 });

  /* דפי המחירון — אלה שנצפו ריקים, ולכן הם נבדקים על תוכן ולא על סטטוס */
  const make = await prisma.$queryRaw<{ make: string }[]>`
    SELECT split_part(l."cohortKey", '|', 1) AS make
      FROM "Listing" l JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "Category" p ON p.id = c."parentId"
     WHERE p.slug = 'vehicles' AND l."cohortKey" IS NOT NULL
     GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`;
  if (make[0]) {
    const slug = encodeURIComponent(make[0].make);
    list.push({ path: `/price-guide/${slug}`, minText: 200 });
  }

  return list;
}

function textLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

async function main() {
  const list = await routes();
  console.log(`\nבדיקת עשן — ${list.length} מסלולים מול ${BASE}\n`);

  let failed = 0;
  const empty: string[] = [];

  for (const route of list) {
    const allowed = route.ok ?? [200];
    let status = 0;
    let body = "";

    try {
      const res = await fetch(`${BASE}${route.path}`, { redirect: "manual" });
      status = res.status;
      body = await res.text();
    } catch (error) {
      console.log(`✗ ${route.path.padEnd(38)} אין תקשורת — ${String(error).slice(0, 60)}`);
      failed++;
      continue;
    }

    if (!allowed.includes(status)) {
      console.log(`✗ ${route.path.padEnd(38)} HTTP ${status}`);
      failed++;
      continue;
    }

    /* 200 ריק הוא כישלון. הוא גרוע מ-500 כי אף ניטור לא יתפוס אותו. */
    if (status === 200 && route.must && !body.includes(route.must)) {
      console.log(`✗ ${route.path.padEnd(38)} 200 אבל חסר "${route.must}"`);
      failed++;
      continue;
    }
    if (status === 200 && route.minText) {
      const len = textLength(body);
      if (len < route.minText) {
        console.log(`✗ ${route.path.padEnd(38)} 200 עם ${len} תווי תוכן (מינימום ${route.minText})`);
        empty.push(route.path);
        failed++;
        continue;
      }
    }

    console.log(`✓ ${route.path.padEnd(38)} ${status}`);
  }

  console.log();
  if (empty.length) console.log(`דפים ריקים: ${empty.join(", ")}\n`);
  if (failed) {
    console.log(`${failed} מסלולים נכשלו.\n`);
    process.exit(1);
  }
  console.log("כל המסלולים תקינים.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
