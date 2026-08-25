import { Prisma, demoDataAllowed, prisma } from "@/lib/db";
import { priceMetersFor } from "@/lib/price-meter";
import { expandSynonyms, normalizeHebrew, tokenizeQuery } from "@/lib/listing-text";

/** מילים קצרות שאין טעם לחפש לבדן — הן מופיעות כמעט בכל מודעה. */
const NOISE = new Set(["של", "עם", "ללא", "או", "גם", "יש", "לא", "על", "אל"]);

/**
 * בונה שתי שאילתות tsquery מאותו חיפוש:
 * - `all` דורשת את כל המילים (התאמה מדויקת, מקבלת ניקוד גבוה)
 * - `any` מסתפקת במילה אחת, מרחיבה במילים נרדפות ומאפשרת התאמת
 *   תחילית (`:*`) — כך ששאילתה מרובת מילים לא תחזיר אפס תוצאות
 *   רק כי מילה אחת חסרה, וחיפוש "טויוט" ימצא גם "טויוטה".
 */
function buildTsQueries(q: string): { all: string; any: string } | null {
  const terms = tokenizeQuery(q).filter((t) => !NOISE.has(t));
  if (!terms.length) return null;

  const prefix = (t: string) => (t.length >= 3 ? `${t}:*` : t);

  // מספרים קצרים ("3" בתוך "דירה 3 חדרים") רועשים מדי כמילת OR עצמאית,
  // אך נשארים בדרישת ה-AND שמדרגת התאמות מדויקות.
  const anyTerms = expandSynonyms(
    terms.filter((t) => !(/^\d{1,3}$/.test(t))),
  );

  return {
    all: terms.map(prefix).join(" & "),
    any: (anyTerms.length ? anyTerms : terms).map(prefix).join(" | "),
  };
}

export type SortMode =
  | "relevance"
  | "date"
  | "price_asc"
  | "price_desc"
  | "distance"
  | "views";

/** פילטר על שדה דינמי אחד, לאחר שהמפתח תורגם למזהי Attribute. */
export type AttributeFilter =
  | { attributeIds: string[]; kind: "values"; values: string[] }
  | { attributeIds: string[]; kind: "range"; min?: number; max?: number }
  | { attributeIds: string[]; kind: "bool"; value: boolean };

export type SearchQuery = {
  q?: string;
  categoryIds?: string[];
  cities?: string[];
  priceMin?: number;
  priceMax?: number;
  /** מיקום המשתמש — נדרש למיון וסינון לפי מרחק */
  lat?: number;
  lng?: number;
  radiusKm?: number;
  attributes?: AttributeFilter[];
  sellerId?: string;
  promotedOnly?: boolean;
  withImages?: boolean;
  excludeIds?: string[];
  sort?: SortMode;
  page?: number;
  perPage?: number;
};

export type SearchResult = {
  ids: string[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  /** מרחק בק"מ לכל מודעה — קיים רק כשנמסר מיקום */
  distances?: Map<string, number>;
};

const EARTH_KM = 6371;

/** ביטוי SQL למרחק Haversine בין המשתמש למודעה. */
function distanceSql(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`(
    ${EARTH_KM} * 2 * asin(sqrt(
      power(sin(radians(l."displayLat" - ${lat}) / 2), 2) +
      cos(radians(${lat})) * cos(radians(l."displayLat")) *
      power(sin(radians(l."displayLng" - ${lng}) / 2), 2)
    ))
  )`;
}

/** בונה את תנאי ה-WHERE המשותפים לשאילתת התוצאות ולשאילתת הספירה. */
function buildWhere(query: SearchQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`l."status" = 'ACTIVE'`,
    Prisma.sql`l."deletedAt" IS NULL`,
  ];

  /*
   * סינון שורות הדגמה. כל השאילתות בקובץ — תוצאות, ספירה, פאסטות
   * וטווח מחירים — נשענות על התנאי הזה, ולכן זו נקודה אחת ולא שש.
   */
  if (!demoDataAllowed()) conditions.push(Prisma.sql`l."isDemo" = false`);

  const q = query.q ? normalizeHebrew(query.q) : "";
  const ts = q.length >= 2 ? buildTsQueries(q) : null;
  if (ts) {
    // התאמת מילים (FTS, לפחות מילה אחת) או התאמה מקורבת (trigram)
    // שסופגת שגיאות כתיב בעברית
    conditions.push(Prisma.sql`(
      to_tsvector('simple', l."searchText") @@ to_tsquery('simple', ${ts.any})
      OR ${q} <% l."searchText"
    )`);
  }

  if (query.categoryIds?.length) {
    conditions.push(Prisma.sql`l."categoryId" IN (${Prisma.join(query.categoryIds)})`);
  }
  if (query.cities?.length) {
    conditions.push(Prisma.sql`l."city" IN (${Prisma.join(query.cities)})`);
  }
  if (query.priceMin !== undefined) {
    conditions.push(Prisma.sql`l."price" >= ${query.priceMin}`);
  }
  if (query.priceMax !== undefined) {
    conditions.push(Prisma.sql`l."price" <= ${query.priceMax}`);
  }
  if (query.sellerId) {
    conditions.push(Prisma.sql`l."userId" = ${query.sellerId}`);
  }
  if (query.promotedOnly) {
    conditions.push(Prisma.sql`l."isPromoted" = true AND l."promotedUntil" > now()`);
  }
  if (query.withImages) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "ListingImage" i WHERE i."listingId" = l.id)`,
    );
  }
  if (query.excludeIds?.length) {
    conditions.push(Prisma.sql`l.id NOT IN (${Prisma.join(query.excludeIds)})`);
  }

  if (
    query.lat !== undefined &&
    query.lng !== undefined &&
    query.radiusKm !== undefined
  ) {
    conditions.push(Prisma.sql`l."displayLat" IS NOT NULL`);
    conditions.push(
      Prisma.sql`${distanceSql(query.lat, query.lng)} <= ${query.radiusKm}`,
    );
  }

  for (const filter of query.attributes ?? []) {
    if (!filter.attributeIds.length) continue;
    const attrIn = Prisma.sql`la."attributeId" IN (${Prisma.join(filter.attributeIds)})`;

    if (filter.kind === "values") {
      if (!filter.values.length) continue;
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ListingAttribute" la
        WHERE la."listingId" = l.id AND ${attrIn}
          AND la."valueText" IN (${Prisma.join(filter.values)})
      )`);
    } else if (filter.kind === "range") {
      const bounds: Prisma.Sql[] = [];
      if (filter.min !== undefined) bounds.push(Prisma.sql`la."valueNumber" >= ${filter.min}`);
      if (filter.max !== undefined) bounds.push(Prisma.sql`la."valueNumber" <= ${filter.max}`);
      if (!bounds.length) continue;
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ListingAttribute" la
        WHERE la."listingId" = l.id AND ${attrIn}
          AND ${Prisma.join(bounds, " AND ")}
      )`);
    } else {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ListingAttribute" la
        WHERE la."listingId" = l.id AND ${attrIn}
          AND la."valueBool" = ${filter.value}
      )`);
    }
  }

  return Prisma.join(conditions, " AND ");
}

/** ORDER BY לפי מצב המיון שנבחר. */
function buildOrder(query: SearchQuery, hasQuery: boolean): Prisma.Sql {
  const sort = query.sort ?? (hasQuery ? "relevance" : "date");
  /*
   * הקידום **אינו** מוביל את המיון יותר.
   *
   * `promoted DESC` כשלב ראשון פירושו שכל המקודמות עולות לפני כל
   * השאר, ובלוח עם עשרות מהן העמוד הראשון כולו בתשלום — דף הבית הציג
   * 13 ברצף תחת הכותרת "נוספו עכשיו", כלומר גם שיקר וגם הציף.
   *
   * במיון לפי תאריך "החדש ביותר" חייב להיות החדש ביותר. הקידום נשאר
   * שובר שוויון בלבד, והחשיפה שנקנתה מסופקת דרך הרצועה הייעודית
   * בדף הבית ודרך המכסה ב-`capPromoted` (2 מכל 10).
   */
  const promoted = Prisma.sql`(l."isPromoted" AND l."promotedUntil" > now()) DESC`;
  const recency = Prisma.sql`COALESCE(l."bumpedAt", l."publishedAt", l."createdAt") DESC`;

  switch (sort) {
    case "price_asc":
      return Prisma.sql`ORDER BY l."price" ASC NULLS LAST, ${recency}`;
    case "price_desc":
      return Prisma.sql`ORDER BY l."price" DESC NULLS LAST, ${recency}`;
    case "views":
      return Prisma.sql`ORDER BY l."viewCount" DESC, ${promoted}, ${recency}`;
    case "distance":
      return query.lat !== undefined && query.lng !== undefined
        ? Prisma.sql`ORDER BY distance ASC NULLS LAST, ${recency}`
        : Prisma.sql`ORDER BY ${recency}, ${promoted}`;
    case "relevance":
      // בחיפוש לפי רלוונטיות הקידום הוא בונוס ולא עקיפה: מודעה מקודמת
      // שאינה רלוונטית לא תעלה מעל תוצאה מתאימה באמת.
      return hasQuery
        ? Prisma.sql`ORDER BY rank DESC, ${recency}`
        : Prisma.sql`ORDER BY ${recency}, ${promoted}`;
    default:
      return Prisma.sql`ORDER BY ${recency}, ${promoted}`;
  }
}

/**
 * מריצה את שאילתת החיפוש ומחזירה מזהי מודעות בסדר הנכון.
 * ההידרציה עצמה נעשית ב-`fetchListingCards` כדי לשמור על שאילתה אחת קלה.
 */
export async function searchListings(query: SearchQuery): Promise<SearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 24));
  const offset = (page - 1) * perPage;

  const q = query.q ? normalizeHebrew(query.q) : "";
  const ts = q.length >= 2 ? buildTsQueries(q) : null;
  const hasQuery = ts !== null;
  const where = buildWhere(query);

  // התאמה לכל המילים שוקלת פי 4 מהתאמה חלקית, ודמיון trigram מוסיף
  // ניקוד קטן כדי לדרג נכון גם התאמות עם שגיאות כתיב.
  // דירוג: התאמה לכל המילים שוקלת הכי הרבה, אחריה התאמה בכותרת,
  // ואז התאמה חלקית ודמיון trigram שסופג שגיאות כתיב.
  const rankSelect = ts
    ? Prisma.sql`, (
        ts_rank(to_tsvector('simple', l."searchText"), to_tsquery('simple', ${ts.all})) * 8
        + (CASE WHEN to_tsvector('simple', l."title") @@ to_tsquery('simple', ${ts.all})
                THEN 1.0 ELSE 0 END)
        + (CASE WHEN to_tsvector('simple', l."title") @@ to_tsquery('simple', ${ts.any})
                THEN 0.4 ELSE 0 END)
        + ts_rank(to_tsvector('simple', l."searchText"), to_tsquery('simple', ${ts.any}))
        + word_similarity(${q}, l."searchText") * 0.5
        + (CASE WHEN l."isPromoted" AND l."promotedUntil" > now() THEN 0.15 ELSE 0 END)
      ) AS rank`
    : Prisma.empty;

  const hasGeo = query.lat !== undefined && query.lng !== undefined;
  const distSelect = hasGeo
    ? Prisma.sql`, ${distanceSql(query.lat!, query.lng!)} AS distance`
    : Prisma.empty;

  const orderBy = buildOrder(query, hasQuery);

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; distance: number | null }[]>(Prisma.sql`
      SELECT l.id${rankSelect}${distSelect}
      FROM "Listing" l
      WHERE ${where}
      ${orderBy}
      LIMIT ${perPage} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "Listing" l WHERE ${where}
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const ids = rows.map((r) => r.id);

  return {
    ids,
    total,
    page,
    perPage,
    hasMore: offset + ids.length < total,
    distances: hasGeo
      ? new Map(rows.map((r) => [r.id, Number(r.distance ?? 0)]))
      : undefined,
  };
}

/** ספירת תוצאות לכל תת-קטגוריה — משמשת למספרים שליד הפילטרים. */
export async function countByCategory(
  query: SearchQuery,
): Promise<Map<string, number>> {
  const scoped: SearchQuery = { ...query, categoryIds: query.categoryIds };
  const where = buildWhere(scoped);
  const rows = await prisma.$queryRaw<{ categoryId: string; count: bigint }[]>(
    Prisma.sql`
      SELECT l."categoryId" AS "categoryId", COUNT(*)::bigint AS count
      FROM "Listing" l WHERE ${where}
      GROUP BY l."categoryId"
    `,
  );
  return new Map(rows.map((r) => [r.categoryId, Number(r.count)]));
}

/**
 * ספירת תוצאות לכל ערך של שדה דינמי — "מעלית (31)" לפני שלוחצים.
 *
 * שתי החלטות שקובעות אם המספר אומר את האמת:
 *
 * 1. **פילטר לא סופר את עצמו.** אם המשתמש כבר בחר "טויוטה", ספירה
 *    שמכבדת את הבחירה הייתה מציגה 0 לכל יצרן אחר — כלומר בדיוק המידע
 *    שמונע ממנו להחליף בחירה. לכן לכל שדה שיש בו בחירה רצה שאילתה
 *    נפרדת בלי הפילטר שלו עצמו. שדות בלי בחירה חולקים שאילתה אחת.
 * 2. **ספירה על התוצאות הנוכחיות ולא על הקטגוריה.** המספר עונה על
 *    "כמה יתווספו אם אלחץ", וזה תלוי בכל שאר הפילטרים.
 *
 * המפתח במפה הוא `attributeId`, והערך הוא מפה מערך לספירה. שדות
 * בוליאניים נספרים תחת המפתח `"true"`.
 */
export type AttributeFacets = Map<string, Map<string, number>>;

export async function countByAttributeValues(
  query: SearchQuery,
  attributeIds: string[],
): Promise<AttributeFacets> {
  const facets: AttributeFacets = new Map();
  if (!attributeIds.length) return facets;

  const filters = query.attributes ?? [];
  const selected = new Set(
    filters
      .filter((f) => (f.kind === "values" ? f.values.length > 0 : true))
      .flatMap((f) => f.attributeIds),
  );

  /** מריצה ספירה אחת עבור קבוצת שדות, תחת where נתון. */
  const run = async (ids: string[], where: Prisma.Sql) => {
    if (!ids.length) return;
    const rows = await prisma.$queryRaw<
      { attributeId: string; value: string | null; bool: boolean | null; count: bigint }[]
    >(Prisma.sql`
      SELECT la."attributeId" AS "attributeId",
             la."valueText" AS value,
             la."valueBool" AS bool,
             COUNT(DISTINCT l.id)::bigint AS count
        FROM "Listing" l
        JOIN "ListingAttribute" la ON la."listingId" = l.id
       WHERE ${where}
         AND la."attributeId" IN (${Prisma.join(ids)})
         AND (la."valueText" IS NOT NULL OR la."valueBool" = true)
       GROUP BY 1, 2, 3
    `);

    for (const row of rows) {
      const key = row.value ?? (row.bool ? "true" : null);
      if (!key) continue;
      const byValue = facets.get(row.attributeId) ?? new Map<string, number>();
      byValue.set(key, Number(row.count));
      facets.set(row.attributeId, byValue);
    }
  };

  const unselected = attributeIds.filter((id) => !selected.has(id));
  await run(unselected, buildWhere(query));

  // שדה שנבחר בו ערך — ספירה בלי הפילטר של אותו שדה
  for (const id of attributeIds.filter((a) => selected.has(a))) {
    const without = {
      ...query,
      attributes: filters.filter((f) => !f.attributeIds.includes(id)),
    };
    await run([id], buildWhere(without));
  }

  return facets;
}

/** ספירת תוצאות לכל עיר — למיון רשימת הערים בפילטר לפי כמות. */
export async function countByCity(
  query: SearchQuery,
  limit = 30,
): Promise<{ city: string; count: number }[]> {
  const where = buildWhere({ ...query, cities: undefined });
  const rows = await prisma.$queryRaw<{ city: string; count: bigint }[]>(Prisma.sql`
    SELECT l."city" AS city, COUNT(*)::bigint AS count
    FROM "Listing" l WHERE ${where}
    GROUP BY l."city" ORDER BY count DESC LIMIT ${limit}
  `);
  return rows.map((r) => ({ city: r.city, count: Number(r.count) }));
}

/** טווח המחירים בתוצאות — לקביעת גבולות מחוון המחיר. */
export async function priceBounds(
  query: SearchQuery,
): Promise<{ min: number; max: number; median: number } | null> {
  const where = buildWhere({ ...query, priceMin: undefined, priceMax: undefined });
  const rows = await prisma.$queryRaw<
    { min: number | null; max: number | null; median: number | null }[]
  >(Prisma.sql`
    SELECT
      MIN(l."price")::int AS min,
      MAX(l."price")::int AS max,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l."price")::int AS median
    FROM "Listing" l
    WHERE ${where} AND l."price" IS NOT NULL AND l."price" > 0
  `);
  const row = rows[0];
  if (!row || row.min === null || row.max === null) return null;
  return { min: row.min, max: row.max, median: row.median ?? row.min };
}

/* -------------------------------------------------------------------------- */
/* הידרציה                                                                     */
/* -------------------------------------------------------------------------- */

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  price: true,
  currency: true,
  city: true,
  neighborhood: true,
  isPromoted: true,
  promotedUntil: true,
  publishedAt: true,
  bumpedAt: true,
  createdAt: true,
  viewCount: true,
  favoriteCount: true,
  status: true,
  displayLat: true,
  displayLng: true,
  categoryId: true,
  userId: true,
  category: {
    select: {
      id: true,
      slug: true,
      name: true,
      priceLabel: true,
      icon: true,
      // שורש הקטגוריה — ממנו נגזר סוג המחיר (שכר / שווי עסק / מחיר)
      parent: { select: { slug: true } },
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      role: true,
      businessName: true,
      businessSlug: true,
      ratingAvg: true,
      ratingCount: true,
      verifiedAt: true,
    },
  },
  images: {
    orderBy: { order: "asc" as const },
    take: 3,
    select: { url: true, thumbUrl: true, blurhash: true, width: true, height: true },
  },
  attributes: {
    where: { attribute: { isHighlight: true } },
    select: {
      valueText: true,
      valueNumber: true,
      valueBool: true,
      attribute: { select: { key: true, label: true, unit: true, type: true, order: true } },
      value: { select: { label: true } },
    },
  },
} satisfies Prisma.ListingSelect;

export type ListingCard = Prisma.ListingGetPayload<{ select: typeof CARD_SELECT }> & {
  distanceKm?: number;
};

/** טוען מודעות לפי מזהים, ומחזיר אותן בסדר שנמסר. */
export async function fetchListingCards(
  ids: string[],
  distances?: Map<string, number>,
): Promise<ListingCard[]> {
  if (!ids.length) return [];
  const rows = await prisma.listing.findMany({
    where: { id: { in: ids } },
    select: CARD_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      const d = distances?.get(id);
      return d === undefined ? row : { ...row, distanceKm: d };
    })
    .filter((r): r is ListingCard => r !== null);
}

/** חיפוש + הידרציה בקריאה אחת, כולל מדי המחיר לכל הכרטיסים. */
/**
 * מכסת המודעות המקודמות: לכל היותר 2 בכל חלון של 10 תוצאות.
 *
 * המיון ב-SQL מרים מקודמות לראש, וברשימה עם הרבה מהן זה ייצר עמוד
 * שלם של מודעות בתשלום — דף הבית הציג 13 ברצף. משתמש שרואה את זה
 * לומד שהתוצאות הראשונות אינן התוצאות הטובות, וזה בדיוק המקום שבו
 * לוח מפסיד את האמון שלו.
 *
 * המקודמות שנדחקות אינן נעלמות — הן זזות אחורה בתוך אותו עמוד.
 */
const PROMOTED_WINDOW = 10;
export const PROMOTED_PER_WINDOW = 2;

export function capPromoted<T>(items: T[], isPromoted: (item: T) => boolean): T[] {
  const promoted = items.filter(isPromoted);
  const organic = items.filter((i) => !isPromoted(i));
  if (promoted.length <= PROMOTED_PER_WINDOW) return items;

  const out: T[] = [];
  let p = 0;
  let o = 0;

  /*
   * חלון אחרי חלון: עד 2 מקודמות ואז אורגניות עד סוף החלון.
   *
   * כשהאורגניות נגמרות והמקודמות לא — העודף נשפך לזנב העמוד. אין דרך
   * לקיים מכסה של 2 מכל 10 ברשימה שרובה מקודמת, וזנב מקודם בסוף עמוד
   * עדיף על ראש עמוד מקודם: מי שהגיע לשם כבר ראה את התוצאות האמיתיות.
   */
  while (o < organic.length) {
    for (let k = 0; k < PROMOTED_PER_WINDOW && p < promoted.length; k++) out.push(promoted[p++]);
    for (
      let k = PROMOTED_PER_WINDOW;
      k < PROMOTED_WINDOW && o < organic.length;
      k++
    ) {
      out.push(organic[o++]);
    }
  }
  while (p < promoted.length) out.push(promoted[p++]);

  return out;
}

export async function searchListingCards(query: SearchQuery) {
  const result = await searchListings(query);
  // שאילתה אחת למד המחיר של כל העמוד, לא אחת לכרטיס
  const [items, meters] = await Promise.all([
    fetchListingCards(result.ids, result.distances),
    priceMetersFor(result.ids),
  ]);

  /*
   * הרשימה שביקשה מקודמות בלבד היא הרצועה הייעודית שלהן, ושם המכסה
   * לא חלה — היא מסומנת ככזו למשתמש.
   */
  const now = Date.now();
  const capped = query.promotedOnly
    ? items
    : capPromoted(
        items,
        (l) => Boolean(l.isPromoted && l.promotedUntil && l.promotedUntil.getTime() > now),
      );

  return { ...result, items: capped, meters };
}

// פורמט ערכי השדות הדינמיים נמצא ב-@/lib/format.
