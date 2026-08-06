/**
 * חוקי סבירות על תוכן הזריעה.
 *
 * הבדיקות כאן אינן על הקוד אלא על מה שהוא ייצר, כי שם התקלות התגלו:
 * "פנטהאוז 3 חדרים 63 מ\"ר", "מרתף 2.5 חדרים להשכרה", "קיוסק פעיל
 * למכירה ₪2,130,000". כל אחת מהן נראתה תקינה בקוד ובלתי אפשרית במציאות.
 */
import { prisma } from "../../src/lib/db";

let failed = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
}

type Row = Record<string, unknown>;

async function attrRows(keys: string[]) {
  return prisma.$queryRawUnsafe<Row[]>(
    `SELECT l.id, l.title, l.price, c.slug AS cat,
            max(CASE WHEN a.key = 'propertyType' THEN COALESCE(av.value, la."valueText") END) AS "propertyType",
            max(CASE WHEN a.key = 'businessField' THEN COALESCE(av.value, la."valueText") END) AS "businessField",
            max(CASE WHEN a.key = 'rooms' THEN la."valueNumber" END) AS rooms,
            max(CASE WHEN a.key = 'size'  THEN la."valueNumber" END) AS size,
            max(CASE WHEN a.key = 'year'  THEN la."valueNumber" END) AS year,
            max(CASE WHEN a.key = 'km'    THEN la."valueNumber" END) AS km
       FROM "Listing" l
       JOIN "Category" c ON c.id = l."categoryId"
       LEFT JOIN "ListingAttribute" la ON la."listingId" = l.id
       LEFT JOIN "Attribute" a ON a.id = la."attributeId" AND a.key = ANY($1)
       LEFT JOIN "AttributeValue" av ON av.id = la."valueId"
      WHERE l."deletedAt" IS NULL
      GROUP BY l.id, l.title, l.price, c.slug`,
    keys,
  );
}

/** מ"ר מינימלי לסוג נכס — הרצפה שמתחתיה המודעה אינה אפשרית. */
const MIN_SIZE: Record<string, number> = {
  "פנטהאוז": 90,
  "בית פרטי": 100,
  "וילה": 120,
  "דו משפחתי": 95,
  "קוטג'": 95,
  "דופלקס": 80,
  "דירת גן": 55,
  "משק חקלאי": 130,
};

/** מחיר מרבי סביר לעסק, לפי ענף. */
const MAX_BUSINESS_PRICE: Record<string, number> = {
  "קיוסק": 800_000,
  "מספרה וטיפוח": 900_000,
  "חדר כושר": 2_200_000,
  "אונליין ואיקומרס": 2_600_000,
  "קמעונאות": 2_400_000,
  "מוסך": 3_000_000,
  "מכולת / סופר": 4_000_000,
  "מסעדנות ובתי קפה": 4_500_000,
};

async function main() {
  const rows = await attrRows(["propertyType", "businessField", "rooms", "size", "year", "km"]);
  console.log(`\nסבירות הזריעה — ${rows.length} מודעות\n`);

  // --- נדל"ן: שטח תואם לסוג הנכס ---
  const tooSmall = rows.filter((r) => {
    const t = r.propertyType as string | null;
    const size = r.size as number | null;
    return t && size !== null && MIN_SIZE[t] !== undefined && size < MIN_SIZE[t]!;
  });
  check(
    tooSmall.length === 0,
    "אין נכס קטן מדי לסוג שלו",
    tooSmall.length ? `${tooSmall.length}, למשל: ${String(tooSmall[0]!.title)}` : "",
  );

  const badRatio = rows.filter((r) => {
    const rooms = r.rooms as number | null;
    const size = r.size as number | null;
    if (!rooms || !size) return false;
    const perRoom = size / rooms;
    return perRoom < 15 || perRoom > 80;
  });
  check(badRatio.length === 0, 'מ"ר לחדר בטווח סביר', badRatio.length ? String(badRatio[0]!.title) : "");

  check(
    !rows.some((r) => r.propertyType === "מרתף"),
    'אין "מרתף" כסוג נכס',
  );

  // --- רכב: ק"מ לשנה סביר לגיל ---
  const now = new Date().getFullYear();
  const badKm = rows.filter((r) => {
    const year = r.year as number | null;
    const km = r.km as number | null;
    if (!year || km === null) return false;
    const age = Math.max(1, now - year);
    const perYear = km / age;
    return perYear > 45_000 || (age > 3 && perYear < 1500);
  });
  check(badKm.length === 0, 'ק"מ לשנה סביר לגיל הרכב', badKm.length ? String(badKm[0]!.title) : "");

  // --- עסקים: מחיר בסדר גודל של הענף ---
  const badBiz = rows.filter((r) => {
    const field = r.businessField as string | null;
    const price = r.price as number | null;
    return field !== null && price !== null && price > (MAX_BUSINESS_PRICE[field] ?? 5_000_000);
  });
  check(
    badBiz.length === 0,
    "מחיר העסק בסדר הגודל של הענף",
    badBiz.length ? `${String(badBiz[0]!.title)} — ${String(badBiz[0]!.price)}` : "",
  );

  // --- תמונות ---
  const imgs = await prisma.$queryRaw<{ url: string; n: bigint; cats: bigint }[]>`
    SELECT i.url, count(*) AS n, count(DISTINCT c.slug) AS cats
      FROM "ListingImage" i
      JOIN "Listing" l ON l.id = i."listingId"
      JOIN "Category" c ON c.id = l."categoryId"
     GROUP BY i.url ORDER BY n DESC
  `;
  const uniqueByRoot = await prisma.$queryRaw<{ root: string; n: bigint }[]>`
    SELECT COALESCE(p.slug, c.slug) AS root, count(DISTINCT i.url) AS n
      FROM "ListingImage" i
      JOIN "Listing" l ON l.id = i."listingId"
      JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "Category" p ON p.id = c."parentId"
     GROUP BY 1 ORDER BY 2
  `;
  const thin = uniqueByRoot.filter((r) => Number(r.n) < 12);
  check(
    thin.length === 0,
    "לפחות 12 תמונות ייחודיות לכל קטגוריה ראשית",
    thin.length ? thin.map((t) => `${t.root}=${t.n}`).join(" ") : `מינימום ${uniqueByRoot[0]?.n}`,
  );
  console.log(`  ${imgs.length} תמונות ייחודיות, השכיחה ביותר ב-${imgs[0]?.n} מודעות`);

  // --- זיהוי הונאה לא מסמן את כל הזריעה ---
  const withPhash = await prisma.listingImage.count({ where: { phash: { not: null } } });
  check(
    withPhash === 0,
    "תמונות הדמו בלי phash — מנגנון הכפילויות לא מסמן את כל הלוח",
    `${withPhash} עם phash`,
  );

  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
