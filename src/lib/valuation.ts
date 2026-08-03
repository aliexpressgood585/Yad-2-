import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { MIN_SAMPLE } from "@/lib/price-meter";

/**
 * מדד המחירים — כמה שווה פריט, לפי מה שבאמת מבקשים עליו בלוח.
 *
 * ההבדל בין הקובץ הזה ל-`price-meter.ts`: שם השאלה היא "איפה המחיר של
 * *המודעה הזו* יושב", וכאן השאלה היא "כמה שווה פריט שאין לו מודעה" —
 * המשתמש מתאר מה יש לו ומקבל טווח.
 *
 * שלושה כללים שאין לעקוף, וכולם נובעים מאותו עיקרון: **הנתון היחיד
 * שמוצג הוא נתון שנמדד.**
 *
 * 1. מתחת ל-MIN_SAMPLE מודעות — לא מוצג מספר, ונאמר במפורש שאין מספיק
 *    נתונים. אין הערכה חלופית, אין "בערך", אין ממוצע ארצי.
 * 2. אין מקדמי תיקון. לא מכפילים חציון ב"מקדם קילומטראז'" ולא מפחיתים
 *    אחוז לכל יד — מקדם כזה הוא ניחוש שנראה כמו מדידה. קילומטראז' ויד
 *    הם **מסננים** על מודעות אמיתיות, לא נוסחה.
 * 3. כשמסנן מוסר כדי להגיע לגודל מדגם, זה מדווח למשתמש. ההשוואה
 *    שהוצגה חייבת להיות ההשוואה שרצה בפועל.
 */

/** תקרת שורות לשאילתת השוואה אחת. */
const MAX_ROWS = 5000;

/* -------------------------------------------------------------------------- */
/* סטטיסטיקה                                                                   */
/* -------------------------------------------------------------------------- */

export type Bucket = { from: number; to: number; count: number };

export type PriceSummary = {
  sample: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  /** עשרה תאים בגובה יחסי, לציור ההתפלגות */
  buckets: Bucket[];
};

/** מספר תאי ההיסטוגרמה. זהה ל-`priceDistributionFor` כדי ששני המסכים ייראו אותו דבר. */
const BUCKETS = 10;

/**
 * אחוזון בשיטת `percentile_cont` של Postgres — אינטרפולציה לינארית בין
 * שני האיברים הסמוכים. אותה שיטה בדיוק כמו במד המחיר, אחרת אותה קבוצת
 * מודעות הייתה נותנת חציון אחד בדף המודעה ואחר בדף השווי.
 */
export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * סיכום סטטיסטי לקבוצת מחירים. `null` = מתחת לגודל המדגם המזערי.
 *
 * פונקציה טהורה בכוונה: היא הליבה של כל מספר שמוצג למשתמש, ולכן היא
 * חייבת להיות ניתנת לבדיקה בלי בסיס נתונים (`npm run check:valuation`).
 */
export function summarizePrices(prices: number[]): PriceSummary | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (clean.length < MIN_SAMPLE) return null;

  const min = clean[0]!;
  const max = clean[clean.length - 1]!;
  const span = Math.max(1, max - min);

  const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
    from: Math.round(min + (span * i) / BUCKETS),
    to: Math.round(min + (span * (i + 1)) / BUCKETS),
    count: 0,
  }));

  for (const p of clean) {
    // המחיר הגבוה ביותר נופל בדיוק על הגבול העליון ושייך לתא האחרון
    const idx = Math.min(BUCKETS - 1, Math.floor(((p - min) / span) * BUCKETS));
    buckets[idx]!.count += 1;
  }

  return {
    sample: clean.length,
    median: Math.round(percentile(clean, 0.5)),
    p25: Math.round(percentile(clean, 0.25)),
    p75: Math.round(percentile(clean, 0.75)),
    min,
    max,
    buckets,
  };
}

/* -------------------------------------------------------------------------- */
/* סולם ההרפיה                                                                 */
/* -------------------------------------------------------------------------- */

/** קריטריון השוואה כפי שהוא מוצג למשתמש. */
export type Criterion = {
  label: string;
  value: string;
  /** ערך מספרי — יוצג ב-`.num` כדי שלא יתהפך בתוך טקסט עברי */
  numeric: boolean;
};

export type Step<T> = {
  criteria: Criterion[];
  /** קריטריונים שהמשתמש מסר ושלב זה מתעלם מהם */
  dropped: string[];
  match: (row: T) => boolean;
  /** חתימה לזיהוי שלבים כפולים אחרי הסרת קריטריונים שלא נמסרו */
  signature: string;
};

export type Valuation<T> = {
  /** `null` = לא נמצא שלב עם מספיק מודעות; אז אין מספר, רק הסבר. */
  summary: PriceSummary | null;
  /** הקריטריונים שההשוואה רצה עליהם בפועל */
  criteria: Criterion[];
  /** מה הוסר כדי להגיע לגודל המדגם */
  dropped: string[];
  /** כמה מודעות נמצאו בשלב שנבחר — גם כשזה פחות מהמינימום */
  sample: number;
  matched: T[];
};

/**
 * בוחר את השלב המחמיר ביותר שיש בו מספיק מודעות.
 *
 * אם גם השלב הרחב ביותר לא מגיע ל-MIN_SAMPLE — מוחזר `summary: null`.
 * זה לא מצב שגיאה: זו התשובה. "אין לנו מספיק נתונים על הדגם הזה" היא
 * תשובה נכונה, ומספר שהומצא משלוש מודעות אינו.
 */
export function pickStep<T extends { price: number }>(
  rows: T[],
  steps: Step<T>[],
): Valuation<T> {
  let widest: Valuation<T> | null = null;

  for (const step of steps) {
    const matched = rows.filter(step.match);
    const summary = summarizePrices(matched.map((r) => r.price));
    const result: Valuation<T> = {
      summary,
      criteria: step.criteria,
      dropped: step.dropped,
      sample: matched.length,
      matched,
    };
    if (summary) return result;
    widest = result;
  }

  return (
    widest ?? {
      summary: null,
      criteria: [],
      dropped: [],
      sample: 0,
      matched: [],
    }
  );
}

/** מסיר שלבים שהפכו זהים אחרי שקריטריונים שלא נמסרו יצאו מהחשבון. */
function dedupe<T>(steps: Step<T>[]): Step<T>[] {
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (seen.has(s.signature)) return false;
    seen.add(s.signature);
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/* רכב                                                                         */
/* -------------------------------------------------------------------------- */

export type VehicleInput = {
  manufacturer: string;
  model?: string | null;
  year?: number | null;
  hand?: number | null;
  km?: number | null;
};

export type VehicleComparable = {
  id: string;
  slug: string;
  title: string;
  price: number;
  city: string;
  publishedAt: Date | null;
  model: string | null;
  year: number | null;
  hand: number | null;
  km: number | null;
};

/** תוויות היד כפי שהן מוגדרות בשדה הדינמי. */
export const HAND_LABELS: Record<number, string> = {
  0: "חדש מהיבואן",
  1: "יד ראשונה",
  2: "יד שנייה",
  3: "יד שלישית",
  4: "יד רביעית",
  5: "יד חמישית ומעלה",
};

type VehiclePlan = {
  model: boolean;
  /** רוחב טווח השנים בכל כיוון. `null` = בלי סינון שנה. */
  year: number | null;
  hand: boolean;
  /** רוחב טווח הק"מ כשבר מהערך. `null` = בלי סינון ק"מ. */
  km: number | null;
};

/**
 * סולם ההרפיה של הרכב, מהמחמיר לרחב.
 *
 * הסדר אינו שרירותי: ק"מ יורד ראשון כי הוא המסנן שמצמצם הכי הרבה
 * ומשפיע הכי מעט על השווי בטווח קצר, ואחריו יד. שנת הייצור מתרחבת
 * בהדרגה ולא נופלת בבת אחת, כי רכב מ-2015 ורכב מ-2022 הם שני מוצרים
 * שונים. הדגם יורד אחרון — השוואה בין דגמים של אותו יצרן היא כבר
 * השוואה גסה, והיא מסומנת ככזו.
 */
const VEHICLE_PLANS: VehiclePlan[] = [
  { model: true, year: 1, hand: true, km: 0.25 },
  { model: true, year: 1, hand: true, km: 0.5 },
  { model: true, year: 2, hand: true, km: null },
  { model: true, year: 2, hand: false, km: null },
  { model: true, year: 3, hand: false, km: null },
  { model: true, year: null, hand: false, km: null },
  { model: false, year: 3, hand: false, km: null },
  { model: false, year: null, hand: false, km: null },
];

export function vehicleSteps(input: VehicleInput): Step<VehicleComparable>[] {
  const model = input.model?.trim() || null;
  const year = Number.isFinite(input.year) ? (input.year as number) : null;
  const hand = Number.isFinite(input.hand) ? (input.hand as number) : null;
  const km = Number.isFinite(input.km) && (input.km as number) > 0 ? (input.km as number) : null;

  const steps = VEHICLE_PLANS.map((plan) => {
    const useModel = plan.model && model !== null;
    const useYear = plan.year !== null && year !== null;
    const useHand = plan.hand && hand !== null;
    const useKm = plan.km !== null && km !== null;

    const criteria: Criterion[] = [];
    const dropped: string[] = [];

    if (useModel) criteria.push({ label: "דגם", value: model!, numeric: false });
    else if (model) dropped.push("דגם");

    let yearLo = 0;
    let yearHi = 0;
    if (useYear) {
      yearLo = year! - plan.year!;
      yearHi = year! + plan.year!;
      criteria.push({
        label: "שנת ייצור",
        value: plan.year === 0 ? String(year) : `${yearLo}–${yearHi}`,
        numeric: true,
      });
    } else if (year !== null) {
      dropped.push("שנת ייצור");
    }

    if (useHand) {
      criteria.push({
        label: "יד",
        value: HAND_LABELS[hand!] ?? String(hand),
        numeric: false,
      });
    } else if (hand !== null) {
      dropped.push("יד");
    }

    let kmLo = 0;
    let kmHi = 0;
    if (useKm) {
      kmLo = Math.round(km! * (1 - plan.km!));
      kmHi = Math.round(km! * (1 + plan.km!));
      criteria.push({
        label: "קילומטראז'",
        value: `${formatNumber(kmLo)}–${formatNumber(kmHi)}`,
        numeric: true,
      });
    } else if (km !== null) {
      dropped.push("קילומטראז'");
    }

    return {
      criteria,
      dropped,
      signature: [
        useModel ? model : "-",
        useYear ? `${yearLo}:${yearHi}` : "-",
        useHand ? hand : "-",
        useKm ? `${kmLo}:${kmHi}` : "-",
      ].join("|"),
      match: (row: VehicleComparable) => {
        if (useModel && row.model !== model) return false;
        if (useYear && (row.year === null || row.year < yearLo || row.year > yearHi)) return false;
        if (useHand && row.hand !== hand) return false;
        if (useKm && (row.km === null || row.km < kmLo || row.km > kmHi)) return false;
        return true;
      },
    } satisfies Step<VehicleComparable>;
  });

  return dedupe(steps);
}

/**
 * כל מודעות הרכב הפעילות של יצרן אחד, עם השדות שההשוואה צריכה.
 *
 * שאילתה אחת עם pivot על השדות הדינמיים, ולא ארבע שאילתות או join
 * לכל שדה. התקרה היא MAX_ROWS המודעות העדכניות ביותר — ביצרן גדול זו
 * דגימה של השוק העכשווי, שהיא ממילא מה שרלוונטי לשווי.
 */
export async function loadVehicleComparables(
  manufacturer: string,
): Promise<VehicleComparable[]> {
  type Row = {
    id: string;
    slug: string;
    title: string;
    price: number;
    city: string;
    publishedAt: Date | null;
    model: string | null;
    year: number | null;
    hand: string | null;
    km: number | null;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT l.id, l.slug, l.title, l.price, l.city, l."publishedAt",
           max(CASE WHEN a.key = 'model' THEN v.label END) AS model,
           max(CASE WHEN a.key = 'year'  THEN la."valueNumber" END) AS year,
           max(CASE WHEN a.key = 'hand'  THEN v.value END) AS hand,
           max(CASE WHEN a.key = 'km'    THEN la."valueNumber" END) AS km
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "Category" root ON root.id = c."parentId"
      JOIN "ListingAttribute" mla ON mla."listingId" = l.id
      JOIN "Attribute" ma ON ma.id = mla."attributeId" AND ma.key = 'manufacturer'
      JOIN "AttributeValue" mv
        ON mv.id = mla."valueId" AND (mv.label = ${manufacturer} OR mv.value = ${manufacturer})
      LEFT JOIN "ListingAttribute" la ON la."listingId" = l.id
      LEFT JOIN "Attribute" a
        ON a.id = la."attributeId" AND a.key IN ('model', 'year', 'hand', 'km')
      LEFT JOIN "AttributeValue" v ON v.id = la."valueId"
     WHERE COALESCE(root.slug, c.slug) = 'vehicles'
       AND l.status = 'ACTIVE'
       AND l."deletedAt" IS NULL
       AND l.price IS NOT NULL AND l.price > 0
     GROUP BY l.id
     ORDER BY l."publishedAt" DESC NULLS LAST
     LIMIT ${MAX_ROWS}
  `;

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price: Number(r.price),
    city: r.city,
    publishedAt: r.publishedAt,
    model: r.model,
    year: r.year === null ? null : Number(r.year),
    hand: r.hand === null ? null : Number(r.hand),
    km: r.km === null ? null : Number(r.km),
  }));
}

export async function valueVehicle(input: VehicleInput): Promise<Valuation<VehicleComparable>> {
  const rows = await loadVehicleComparables(input.manufacturer);
  return pickStep(rows, vehicleSteps(input));
}

/* -------------------------------------------------------------------------- */
/* נדל"ן                                                                       */
/* -------------------------------------------------------------------------- */

export type DealKind = "sale" | "rent";

/** קטגוריית העלה לכל סוג עסקה. דירה למכירה ודירה להשכרה אינן אותו שוק. */
export const DEAL_CATEGORY: Record<DealKind, string> = {
  sale: "apartments-sale",
  rent: "apartments-rent",
};

export const DEAL_LABEL: Record<DealKind, string> = {
  sale: "למכירה",
  rent: "להשכרה",
};

export type RealEstateInput = {
  deal: DealKind;
  city: string;
  neighborhood?: string | null;
  rooms?: number | null;
  size?: number | null;
};

export type RealEstateComparable = {
  id: string;
  slug: string;
  title: string;
  price: number;
  city: string;
  neighborhood: string | null;
  publishedAt: Date | null;
  rooms: number | null;
  size: number | null;
};

type RealEstatePlan = {
  neighborhood: boolean;
  /** סטייה מותרת במספר החדרים. `null` = בלי סינון חדרים. */
  rooms: number | null;
  /** רוחב טווח המ"ר כשבר מהערך. `null` = בלי סינון מ"ר. */
  size: number | null;
};

/**
 * סולם ההרפיה של הנדל"ן.
 *
 * מספר החדרים נשמר לפני השכונה: הוא מגדיר את המוצר, בעוד שהשכונה
 * מגדירה את המיקום — ושתי דירות 3 חדרים בשתי שכונות באותה עיר קרובות
 * זו לזו יותר מדירת 3 ודירת 5 באותה שכונה.
 *
 * **הסולם נעצר בגבול העיר.** הרחבה לאזור הייתה מציגה חציון של תל אביב
 * לצד בני ברק ולהפך. אין מספיק מודעות בעיר — זו התשובה.
 */
const REALESTATE_PLANS: RealEstatePlan[] = [
  { neighborhood: true, rooms: 0, size: 0.15 },
  { neighborhood: true, rooms: 0, size: null },
  { neighborhood: false, rooms: 0, size: 0.15 },
  { neighborhood: false, rooms: 0, size: 0.3 },
  { neighborhood: false, rooms: 0, size: null },
  { neighborhood: false, rooms: 0.5, size: null },
  { neighborhood: false, rooms: null, size: null },
];

export function realEstateSteps(input: RealEstateInput): Step<RealEstateComparable>[] {
  const hood = input.neighborhood?.trim() || null;
  const rooms = Number.isFinite(input.rooms) ? (input.rooms as number) : null;
  const size = Number.isFinite(input.size) && (input.size as number) > 0 ? (input.size as number) : null;

  const steps = REALESTATE_PLANS.map((plan) => {
    const useHood = plan.neighborhood && hood !== null;
    const useRooms = plan.rooms !== null && rooms !== null;
    const useSize = plan.size !== null && size !== null;

    const criteria: Criterion[] = [
      { label: "עיר", value: input.city, numeric: false },
    ];
    const dropped: string[] = [];

    if (useHood) criteria.push({ label: "שכונה", value: hood!, numeric: false });
    else if (hood) dropped.push("שכונה");

    let roomsLo = 0;
    let roomsHi = 0;
    if (useRooms) {
      roomsLo = rooms! - plan.rooms!;
      roomsHi = rooms! + plan.rooms!;
      criteria.push({
        label: "חדרים",
        value: plan.rooms === 0 ? formatNumber(rooms!) : `${formatNumber(roomsLo)}–${formatNumber(roomsHi)}`,
        numeric: true,
      });
    } else if (rooms !== null) {
      dropped.push("חדרים");
    }

    let sizeLo = 0;
    let sizeHi = 0;
    if (useSize) {
      sizeLo = Math.round(size! * (1 - plan.size!));
      sizeHi = Math.round(size! * (1 + plan.size!));
      criteria.push({
        label: "שטח",
        value: `${formatNumber(sizeLo)}–${formatNumber(sizeHi)} מ"ר`,
        numeric: true,
      });
    } else if (size !== null) {
      dropped.push("שטח");
    }

    return {
      criteria,
      dropped,
      signature: [
        useHood ? hood : "-",
        useRooms ? `${roomsLo}:${roomsHi}` : "-",
        useSize ? `${sizeLo}:${sizeHi}` : "-",
      ].join("|"),
      match: (row: RealEstateComparable) => {
        if (useHood && row.neighborhood !== hood) return false;
        if (useRooms && (row.rooms === null || row.rooms < roomsLo || row.rooms > roomsHi)) {
          return false;
        }
        if (useSize && (row.size === null || row.size < sizeLo || row.size > sizeHi)) return false;
        return true;
      },
    } satisfies Step<RealEstateComparable>;
  });

  return dedupe(steps);
}

/** כל מודעות הנדל"ן הפעילות בעיר אחת ובסוג עסקה אחד. */
export async function loadRealEstateComparables(
  deal: DealKind,
  city: string,
): Promise<RealEstateComparable[]> {
  type Row = {
    id: string;
    slug: string;
    title: string;
    price: number;
    city: string;
    neighborhood: string | null;
    publishedAt: Date | null;
    rooms: number | null;
    size: number | null;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT l.id, l.slug, l.title, l.price, l.city, l.neighborhood, l."publishedAt",
           max(CASE WHEN a.key = 'rooms' THEN la."valueNumber" END) AS rooms,
           max(CASE WHEN a.key = 'size'  THEN la."valueNumber" END) AS size
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
      LEFT JOIN "ListingAttribute" la ON la."listingId" = l.id
      LEFT JOIN "Attribute" a
        ON a.id = la."attributeId" AND a.key IN ('rooms', 'size')
     WHERE c.slug = ${DEAL_CATEGORY[deal]}
       AND l.city = ${city}
       AND l.status = 'ACTIVE'
       AND l."deletedAt" IS NULL
       AND l.price IS NOT NULL AND l.price > 0
     GROUP BY l.id
     ORDER BY l."publishedAt" DESC NULLS LAST
     LIMIT ${MAX_ROWS}
  `;

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price: Number(r.price),
    city: r.city,
    neighborhood: r.neighborhood,
    publishedAt: r.publishedAt,
    rooms: r.rooms === null ? null : Number(r.rooms),
    size: r.size === null ? null : Number(r.size),
  }));
}

export async function valueRealEstate(
  input: RealEstateInput,
): Promise<Valuation<RealEstateComparable>> {
  const rows = await loadRealEstateComparables(input.deal, input.city);
  return pickStep(rows, realEstateSteps(input));
}

/**
 * חציון המחיר למ"ר בקבוצת מודעות.
 *
 * מחושב מהמודעות שיש להן שטח בלבד, ולכן מוחזר יחד עם גודל המדגם שלו:
 * הוא כמעט תמיד קטן מהמדגם הראשי, ולהציג אותו כאילו נמדד על כל הקבוצה
 * היה מטעה. `null` מתחת ל-MIN_SAMPLE.
 */
export function medianPricePerSqm(
  rows: RealEstateComparable[],
): { value: number; sample: number } | null {
  const values = rows
    .filter((r) => r.size !== null && r.size > 0)
    .map((r) => r.price / r.size!)
    .sort((a, b) => a - b);
  if (values.length < MIN_SAMPLE) return null;
  return { value: Math.round(percentile(values, 0.5)), sample: values.length };
}

/* -------------------------------------------------------------------------- */
/* מגמה חודשית                                                                 */
/* -------------------------------------------------------------------------- */

export type TrendPoint = {
  /** תחילת החודש בפורמט YYYY-MM */
  month: string;
  label: string;
  median: number;
  sample: number;
};

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

type TrendRow = { month: Date; median: number | null; sample: bigint | number };

/**
 * מסנן את נקודות המגמה לפי אותו כלל מדגם מזערי.
 *
 * חודש עם שלוש מודעות אינו "ירידה במחירים" אלא רעש, וקו שמחבר נקודה
 * כזו לקודמת מייצר מגמה שלא קיימת. חודשים דלילים פשוט נעדרים מהגרף.
 */
export function toTrendPoints(rows: TrendRow[]): TrendPoint[] {
  return rows
    .filter((r) => Number(r.sample) >= MIN_SAMPLE && r.median !== null)
    .map((r) => {
      const d = new Date(r.month);
      return {
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        median: Math.round(Number(r.median)),
        sample: Number(r.sample),
      };
    });
}

/** מתחת לזה אין מה לצייר — שתי נקודות הן קו, נקודה אחת אינה מגמה. */
export const MIN_TREND_POINTS = 3;

/**
 * חציון חודשי ב-12 החודשים האחרונים.
 *
 * "מודעה שהייתה בשוק בחודש X" ולא "מודעה שפורסמה בחודש X": מודעה
 * שפורסמה במאי ועדיין פעילה ביולי היא חלק ממחירי יולי בדיוק כמו מודעה
 * חדשה. ספירה לפי תאריך פרסום בלבד הייתה מודדת את קצב הפרסום, לא
 * את המחירים.
 */
async function monthlyMedians(where: Prisma.Sql): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRaw<TrendRow[]>`
    WITH months AS (
      SELECT generate_series(
               date_trunc('month', now()) - interval '11 months',
               date_trunc('month', now()),
               interval '1 month'
             ) AS m
    )
    SELECT months.m AS month,
           count(l.id) AS sample,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price) AS median
      FROM months
      LEFT JOIN "Listing" l
        ON l."publishedAt" < months.m + interval '1 month'
       AND (l."expiresAt" IS NULL OR l."expiresAt" >= months.m)
       AND l."deletedAt" IS NULL
       AND l.status IN ('ACTIVE', 'SOLD', 'EXPIRED')
       AND l.price IS NOT NULL AND l.price > 0
       AND l.id IN (${where})
     GROUP BY months.m
     ORDER BY months.m
  `;
  return toTrendPoints(rows);
}

/** מגמת המחירים של דגם רכב. */
export function vehicleTrend(manufacturer: string, model: string | null): Promise<TrendPoint[]> {
  const modelFilter = model
    ? Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM "ListingAttribute" la2
            JOIN "Attribute" a2 ON a2.id = la2."attributeId" AND a2.key = 'model'
            JOIN "AttributeValue" v2 ON v2.id = la2."valueId"
           WHERE la2."listingId" = inner_l.id AND v2.label = ${model}
        )`
    : Prisma.empty;

  return monthlyMedians(Prisma.sql`
    SELECT inner_l.id
      FROM "Listing" inner_l
      JOIN "Category" c ON c.id = inner_l."categoryId"
      LEFT JOIN "Category" root ON root.id = c."parentId"
      JOIN "ListingAttribute" mla ON mla."listingId" = inner_l.id
      JOIN "Attribute" ma ON ma.id = mla."attributeId" AND ma.key = 'manufacturer'
      JOIN "AttributeValue" mv
        ON mv.id = mla."valueId" AND (mv.label = ${manufacturer} OR mv.value = ${manufacturer})
     WHERE COALESCE(root.slug, c.slug) = 'vehicles'
       ${modelFilter}
  `);
}

/** מגמת המחירים של דירות בעיר, לפי סוג עסקה. */
export function realEstateTrend(deal: DealKind, city: string): Promise<TrendPoint[]> {
  return monthlyMedians(Prisma.sql`
    SELECT inner_l.id
      FROM "Listing" inner_l
      JOIN "Category" c ON c.id = inner_l."categoryId"
     WHERE c.slug = ${DEAL_CATEGORY[deal]}
       AND inner_l.city = ${city}
  `);
}

/* -------------------------------------------------------------------------- */
/* אפשרויות הטופס — נבנות מהנתונים ולא מרשימה קשיחה                            */
/* -------------------------------------------------------------------------- */

export type MakeOption = { manufacturer: string; models: { model: string; count: number }[]; count: number };

/**
 * יצרנים ודגמים שיש עליהם מודעות פעילות.
 *
 * הרשימה נבנית מהמודעות ולא מקטלוג: אין טעם להציע למשתמש דגם שאין עליו
 * ולו מודעה אחת, כי התשובה היחידה שהוא יקבל היא "אין מספיק נתונים".
 */
export async function vehicleMakeOptions(): Promise<MakeOption[]> {
  const rows = await prisma.$queryRaw<
    { manufacturer: string; model: string | null; count: bigint }[]
  >`
    SELECT t.manufacturer, t.model, count(*) AS count
      FROM (
        SELECT l.id,
               max(CASE WHEN a.key = 'manufacturer' THEN v.label END) AS manufacturer,
               max(CASE WHEN a.key = 'model' THEN v.label END) AS model
          FROM "Listing" l
          JOIN "Category" c ON c.id = l."categoryId"
          LEFT JOIN "Category" root ON root.id = c."parentId"
          JOIN "ListingAttribute" la ON la."listingId" = l.id
          JOIN "Attribute" a
            ON a.id = la."attributeId" AND a.key IN ('manufacturer', 'model')
          JOIN "AttributeValue" v ON v.id = la."valueId"
         WHERE COALESCE(root.slug, c.slug) = 'vehicles'
           AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
           AND l.price IS NOT NULL AND l.price > 0
         GROUP BY l.id
      ) t
     WHERE t.manufacturer IS NOT NULL
     GROUP BY t.manufacturer, t.model
  `;

  const byMake = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const count = Number(r.count);
    totals.set(r.manufacturer, (totals.get(r.manufacturer) ?? 0) + count);
    if (!r.model) continue;
    const models = byMake.get(r.manufacturer) ?? new Map<string, number>();
    models.set(r.model, (models.get(r.model) ?? 0) + count);
    byMake.set(r.manufacturer, models);
  }

  return [...totals.entries()]
    .map(([manufacturer, count]) => ({
      manufacturer,
      count,
      models: [...(byMake.get(manufacturer) ?? new Map()).entries()]
        .map(([model, c]) => ({ model, count: c as number }))
        .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model, "he")),
    }))
    .sort((a, b) => b.count - a.count || a.manufacturer.localeCompare(b.manufacturer, "he"));
}

/**
 * פילוח מדגם לפי ערך מספרי — שנת ייצור ברכב, מספר חדרים בדירה.
 *
 * קבוצה שלא עברה את גודל המדגם המזערי נעלמת מהטבלה במקום להופיע עם
 * מספר חלש. שורה בטבלה נראית סמכותית בדיוק כמו כותרת, ולכן היא כפופה
 * לאותו כלל.
 */
export function breakdownBy<T extends { price: number }>(
  rows: T[],
  keyOf: (row: T) => number | null,
): { key: number; summary: PriceSummary }[] {
  const groups = new Map<number, number[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null || !Number.isFinite(key)) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(row.price);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, prices]) => ({ key, summary: summarizePrices(prices) }))
    .filter((g): g is { key: number; summary: PriceSummary } => g.summary !== null)
    .sort((a, b) => a.key - b.key);
}

/**
 * עוטף `generateStaticParams` כך שתקלת בסיס נתונים בזמן בנייה לא תפיל
 * את הפריסה כולה: בלי רשימה מוקדמת הדפים פשוט ייבנו לפי דרישה, וזה
 * בדיוק מה ש-ISR עושה ממילא בכתובת שלא הוכנה מראש.
 */
export async function safeParams<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.error("[valuation] generateStaticParams נכשל, הדפים ייבנו לפי דרישה", error);
    return [];
  }
}

export type GuideTarget = { manufacturer: string; model: string; count: number };

/**
 * צירופי יצרן-דגם שיש עליהם מספיק מודעות לדף מחירון.
 *
 * דף נחיתה נבנה רק כשיש לו מה להראות. עמוד "מחירון X" שכל תוכנו הוא
 * "אין מספיק נתונים" הוא עמוד דל תוכן — הוא לא עוזר למשתמש ולא לאתר.
 */
export async function guideTargets(): Promise<GuideTarget[]> {
  const rows = await prisma.$queryRaw<
    { manufacturer: string; model: string; count: bigint }[]
  >`
    SELECT t.manufacturer, t.model, count(*) AS count
      FROM (
        SELECT l.id,
               max(CASE WHEN a.key = 'manufacturer' THEN v.label END) AS manufacturer,
               max(CASE WHEN a.key = 'model' THEN v.label END) AS model
          FROM "Listing" l
          JOIN "Category" c ON c.id = l."categoryId"
          LEFT JOIN "Category" root ON root.id = c."parentId"
          JOIN "ListingAttribute" la ON la."listingId" = l.id
          JOIN "Attribute" a
            ON a.id = la."attributeId" AND a.key IN ('manufacturer', 'model')
          JOIN "AttributeValue" v ON v.id = la."valueId"
         WHERE COALESCE(root.slug, c.slug) = 'vehicles'
           AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
           AND l.price IS NOT NULL AND l.price > 0
         GROUP BY l.id
      ) t
     WHERE t.manufacturer IS NOT NULL AND t.model IS NOT NULL
     GROUP BY t.manufacturer, t.model
    HAVING count(*) >= ${MIN_SAMPLE}
     ORDER BY count(*) DESC
  `;

  return rows.map((r) => ({
    manufacturer: r.manufacturer,
    model: r.model,
    count: Number(r.count),
  }));
}

/** ערים שיש בהן מספיק מודעות לדף מחירי עיר, לפחות בסוג עסקה אחד. */
export async function cityTargets(): Promise<CityOption[]> {
  const all = await realEstateCityOptions();
  return all.filter((c) => c.sale >= MIN_SAMPLE || c.rent >= MIN_SAMPLE);
}

export type CityOption = { city: string; sale: number; rent: number };

/** ערים שיש בהן מודעות נדל"ן פעילות, עם ספירה לכל סוג עסקה. */
export async function realEstateCityOptions(): Promise<CityOption[]> {
  const rows = await prisma.$queryRaw<{ city: string; slug: string; count: bigint }[]>`
    SELECT l.city, c.slug, count(*) AS count
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
     WHERE c.slug IN (${DEAL_CATEGORY.sale}, ${DEAL_CATEGORY.rent})
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
       AND l.price IS NOT NULL AND l.price > 0
     GROUP BY l.city, c.slug
  `;

  const byCity = new Map<string, CityOption>();
  for (const r of rows) {
    const entry = byCity.get(r.city) ?? { city: r.city, sale: 0, rent: 0 };
    if (r.slug === DEAL_CATEGORY.sale) entry.sale = Number(r.count);
    else entry.rent = Number(r.count);
    byCity.set(r.city, entry);
  }

  return [...byCity.values()].sort(
    (a, b) => b.sale + b.rent - (a.sale + a.rent) || a.city.localeCompare(b.city, "he"),
  );
}

/**
 * מפת שכונות לכל עיר, לשני סוגי העסקה.
 *
 * נשלחת לטופס כמקשה אחת ולא נטענת לכל בחירת עיר: היא מוגבלת לערים שיש
 * בהן לפחות MIN_SAMPLE מודעות — בעיר דלילה יותר שלב השכונה לעולם לא
 * יגיע לגודל מדגם, ולהציע שם שכונה היה מבטיח דיוק שאין לו כיסוי.
 */
export async function neighborhoodMap(): Promise<Record<DealKind, Record<string, string[]>>> {
  const rows = await prisma.$queryRaw<
    { slug: string; city: string; neighborhood: string }[]
  >`
    WITH dense AS (
      SELECT c.slug, l.city
        FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId"
       WHERE c.slug IN (${DEAL_CATEGORY.sale}, ${DEAL_CATEGORY.rent})
         AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
         AND l.price IS NOT NULL AND l.price > 0
       GROUP BY c.slug, l.city
      HAVING count(*) >= ${MIN_SAMPLE}
    )
    SELECT c.slug, l.city, l.neighborhood
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
      JOIN dense ON dense.slug = c.slug AND dense.city = l.city
     WHERE l.neighborhood IS NOT NULL
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
     GROUP BY c.slug, l.city, l.neighborhood
     ORDER BY l.neighborhood
  `;

  const out: Record<DealKind, Record<string, string[]>> = { sale: {}, rent: {} };
  for (const r of rows) {
    const deal: DealKind = r.slug === DEAL_CATEGORY.sale ? "sale" : "rent";
    (out[deal][r.city] ??= []).push(r.neighborhood);
  }
  return out;
}

/** שכונות שיש בהן מודעות בעיר נתונה. */
export async function neighborhoodOptions(deal: DealKind, city: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ neighborhood: string; count: bigint }[]>`
    SELECT l.neighborhood, count(*) AS count
      FROM "Listing" l
      JOIN "Category" c ON c.id = l."categoryId"
     WHERE c.slug = ${DEAL_CATEGORY[deal]}
       AND l.city = ${city}
       AND l.neighborhood IS NOT NULL
       AND l.status = 'ACTIVE' AND l."deletedAt" IS NULL
     GROUP BY l.neighborhood
     ORDER BY count DESC, l.neighborhood
  `;
  return rows.map((r) => r.neighborhood);
}
