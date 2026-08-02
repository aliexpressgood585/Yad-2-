import { Prisma, prisma } from "@/lib/db";
import { getAttributesForCategory, getCategoryPath } from "@/lib/categories";
import { comparableBandFor } from "@/lib/price-meter";
import { buildSearchText, contentFingerprint } from "@/lib/listing-text";
import { detectFraud, persistFraudFlags } from "@/lib/fraud";
import { getCity } from "@/lib/cities";
import { fuzzLocation, sanitizeText, slugify } from "@/lib/utils";
import { LISTING_TTL_DAYS } from "@/lib/site";
import type { ListingInput } from "@/lib/validators";

/** יוצר slug ייחודי למודעה. */
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "מודעה";
  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const candidate = `${base}-${suffix}`;
    const exists = await prisma.listing.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

type AttributeRow = {
  attributeId: string;
  valueId?: string | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
};

/**
 * ממיר את ערכי השדות הדינמיים מהטופס לשורות ListingAttribute,
 * תוך אימות מול הגדרות הקטגוריה (שדות לא מוכרים נזרקים).
 */
export async function buildAttributeRows(
  categoryId: string,
  values: ListingInput["attributes"],
): Promise<{ rows: AttributeRow[]; labels: string[]; missing: string[] }> {
  const attributes = await getAttributesForCategory(categoryId);
  const byKey = new Map(attributes.map((a) => [a.key, a]));

  const rows: AttributeRow[] = [];
  const labels: string[] = [];
  const provided = new Set<string>();

  for (const [key, raw] of Object.entries(values ?? {})) {
    const attr = byKey.get(key);
    if (!attr) continue;

    const list = Array.isArray(raw) ? raw : [raw];
    for (const value of list) {
      if (value === undefined || value === null || value === "") continue;

      if (attr.type === "SELECT" || attr.type === "MULTISELECT") {
        const option = attr.values.find((v) => v.value === String(value));
        if (!option) continue;
        rows.push({
          attributeId: attr.id,
          valueId: option.id,
          valueText: option.value,
        });
        labels.push(option.label);
      } else if (attr.type === "NUMBER") {
        const num = Number(value);
        if (!Number.isFinite(num)) continue;
        rows.push({ attributeId: attr.id, valueNumber: num });
        labels.push(`${attr.label} ${num}`);
      } else if (attr.type === "BOOLEAN") {
        if (value !== true && value !== "true") continue;
        rows.push({ attributeId: attr.id, valueBool: true });
        labels.push(attr.label);
      } else {
        const text = sanitizeText(String(value)).slice(0, 200);
        if (!text) continue;
        rows.push({ attributeId: attr.id, valueText: text });
        labels.push(text);
      }
      provided.add(key);
    }
  }

  const missing = attributes
    .filter((a) => a.isRequired && !provided.has(a.key))
    .map((a) => a.label);

  return { rows, labels, missing };
}

/** מחשב את כל השדות הנגזרים של מודעה לפני שמירה. */
export async function deriveListingFields(
  input: ListingInput,
  attributeLabels: string[],
  slug: string,
  attributeValues: Record<string, unknown> = {},
) {
  const path = await getCategoryPath(input.categoryId);
  const city = getCity(input.city);

  const lat = input.lat ?? city?.lat ?? null;
  const lng = input.lng ?? city?.lng ?? null;
  // מיקום ציבורי מוסט בכ-500 מ' כדי לא לחשוף כתובת מדויקת
  const display = lat !== null && lng !== null ? fuzzLocation(lat, lng, slug, 500) : null;

  return {
    lat,
    lng,
    displayLat: display?.lat ?? null,
    displayLng: display?.lng ?? null,
    searchText: buildSearchText({
      title: input.title,
      description: input.description,
      city: input.city,
      neighborhood: input.neighborhood || null,
      categoryNames: path.map((p) => p.name),
      attributeLabels,
    }),
    contentHash: contentFingerprint({
      title: input.title,
      description: input.description,
      price: input.price,
      categoryId: input.categoryId,
    }),
    comparableBand: comparableBandFor(path[0]?.slug, attributeValues),
  };
}

/** תאריך תפוגה למודעה חדשה או מחודשת. */
export function expiryDate(from = new Date()): Date {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 86_400_000);
}

/** מריץ בדיקות הונאה על מודעה ומעדכן דגלים. נקרא אחרי פרסום או עריכה. */
export async function runFraudChecks(listingId: string): Promise<number> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      categoryId: true,
      userId: true,
      contentHash: true,
      images: { select: { phash: true } },
    },
  });
  if (!listing) return 0;

  const flags = await detectFraud({
    listingId: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    categoryId: listing.categoryId,
    userId: listing.userId,
    contentHash: listing.contentHash,
    imagePhashes: listing.images
      .map((i) => i.phash)
      .filter((p): p is string => Boolean(p)),
  });

  return persistFraudFlags(listing.id, flags);
}

/**
 * מאתר מודעות שנראות כפילות של מה שהמשתמש עומד לפרסם.
 * מבוסס על טביעת אצבע תוכן ועל דמיון טקסטואלי בתוך אותה קטגוריה.
 */
export async function findPossibleDuplicates(input: {
  userId: string;
  categoryId: string;
  title: string;
  description: string;
  price: number | null;
  excludeId?: string;
}) {
  const hash = contentFingerprint({
    title: input.title,
    description: input.description,
    price: input.price,
    categoryId: input.categoryId,
  });

  const exact = await prisma.listing.findMany({
    where: {
      userId: input.userId,
      contentHash: hash,
      deletedAt: null,
      status: { in: ["ACTIVE", "DRAFT", "PENDING"] },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true, slug: true, title: true, status: true, createdAt: true },
    take: 3,
  });

  if (exact.length) return exact;

  // דמיון גבוה בכותרת בתוך אותה קטגוריה — לרוב פרסום חוזר של אותו פריט
  return prisma.$queryRaw<
    { id: string; slug: string; title: string; status: string; createdAt: Date }[]
  >`
    SELECT id, slug, title, status::text, "createdAt"
    FROM "Listing"
    WHERE "userId" = ${input.userId}
      AND "categoryId" = ${input.categoryId}
      AND "deletedAt" IS NULL
      AND "status" IN ('ACTIVE', 'DRAFT', 'PENDING')
      ${input.excludeId ? Prisma.sql`AND id <> ${input.excludeId}` : Prisma.empty}
      AND similarity("title", ${input.title}) > 0.55
    ORDER BY similarity("title", ${input.title}) DESC
    LIMIT 3
  `;
}

/**
 * הצעת מחיר לפי מודעות דומות: מחזיר טווח בין האחוזון ה-25 ל-75
 * ואת החציון, מאותה קטגוריה ובטווח זמן סביר.
 */
export async function suggestPrice(
  categoryId: string,
  attributeValues: Record<string, unknown> = {},
): Promise<{ p25: number; median: number; p75: number; sample: number } | null> {
  void attributeValues;

  const rows = await prisma.$queryRaw<
    { p25: number | null; median: number | null; p75: number | null; n: bigint }[]
  >`
    SELECT
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "price")::int AS p25,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "price")::int AS median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "price")::int AS p75,
      COUNT(*)::bigint AS n
    FROM "Listing"
    WHERE "categoryId" = ${categoryId}
      AND "deletedAt" IS NULL
      AND "price" IS NOT NULL AND "price" > 0
      AND "createdAt" > now() - interval '180 days'
  `;

  const row = rows[0];
  const sample = Number(row?.n ?? 0);
  // מתחת ל-5 מודעות ההמלצה לא אמינה מספיק כדי להציג אותה
  if (!row || sample < 5 || row.median === null) return null;

  return {
    p25: row.p25 ?? row.median,
    median: row.median,
    p75: row.p75 ?? row.median,
    sample,
  };
}
