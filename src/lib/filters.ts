import type { ResolvedAttribute } from "@/lib/categories";
import { parseQuery } from "@/lib/search/parse-query";
import type { AttributeFilter, SearchQuery, SortMode } from "@/lib/listings";

/**
 * מצב הפילטרים כפי שהוא מיוצג ב-URL.
 * שדות דינמיים מקודדים בתחיליות:
 *   `a_<key>`      — ערכי בחירה, מופרדים בפסיק
 *   `a_<key>_min`  — גבול תחתון למספר
 *   `a_<key>_max`  — גבול עליון למספר
 *   `a_<key>` = "1" — שדה בוליאני
 */
export type FilterState = {
  q?: string;
  /**
   * מפתחות שהמשתמש ביטל את החילוץ האוטומטי שלהם.
   * המילים חוזרות לחיפוש החופשי במקום להפוך לפילטר.
   */
  keep?: string[];
  cities: string[];
  priceMin?: number;
  priceMax?: number;
  radiusKm?: number;
  lat?: number;
  lng?: number;
  sort: SortMode;
  page: number;
  withImages: boolean;
  promotedOnly: boolean;
  /** ערכי השדות הדינמיים לפי מפתח */
  attrs: Record<string, string[]>;
  attrRanges: Record<string, { min?: number; max?: number }>;
  attrBools: Record<string, boolean>;
};

export const ATTR_PREFIX = "a_";

const SORTS: SortMode[] = [
  "relevance",
  "date",
  "price_asc",
  "price_desc",
  "distance",
  "views",
];

export const SORT_LABELS: Record<SortMode, string> = {
  relevance: "הכי רלוונטי",
  date: "העדכני ביותר",
  price_asc: "מחיר: מהנמוך לגבוה",
  price_desc: "מחיר: מהגבוה לנמוך",
  distance: "הכי קרוב אליי",
  views: "הכי נצפה",
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function list(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => x.split(",")).filter(Boolean);
  return v ? v.split(",").filter(Boolean) : [];
}

/** קורא את מצב הפילטרים מפרמטרי ה-URL. */
export function parseFilters(params: RawParams): FilterState {
  const attrs: FilterState["attrs"] = {};
  const attrRanges: FilterState["attrRanges"] = {};
  const attrBools: FilterState["attrBools"] = {};

  for (const [rawKey, rawValue] of Object.entries(params)) {
    if (!rawKey.startsWith(ATTR_PREFIX)) continue;
    const body = rawKey.slice(ATTR_PREFIX.length);
    const value = first(rawValue);
    if (!value) continue;

    if (body.endsWith("_min") || body.endsWith("_max")) {
      const key = body.slice(0, -4);
      const bound = body.endsWith("_min") ? "min" : "max";
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      attrRanges[key] = { ...attrRanges[key], [bound]: n };
      continue;
    }

    if (value === "1" || value === "0") {
      attrBools[body] = value === "1";
      continue;
    }
    attrs[body] = list(rawValue);
  }

  const sortRaw = first(params.sort) as SortMode | undefined;

  return {
    q: first(params.q)?.trim() || undefined,
    // מפתחות שהמשתמש ביטל את החילוץ שלהם — נשארים כטקסט חופשי
    keep: (first(params.keep) ?? "").split(",").filter(Boolean),
    cities: list(params.city ?? params.cities),
    priceMin: num(params.priceMin),
    priceMax: num(params.priceMax),
    radiusKm: num(params.radius),
    lat: num(params.lat),
    lng: num(params.lng),
    sort: sortRaw && SORTS.includes(sortRaw) ? sortRaw : first(params.q) ? "relevance" : "date",
    page: Math.max(1, num(params.page) ?? 1),
    withImages: first(params.withImages) === "1",
    promotedOnly: first(params.promoted) === "1",
    attrs,
    attrRanges,
    attrBools,
  };
}

/** ממיר את מצב הפילטרים חזרה לפרמטרי URL (ללא ערכי ברירת מחדל). */
export function serializeFilters(state: Partial<FilterState>): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (state.cities?.length) sp.set("city", state.cities.join(","));
  if (state.priceMin !== undefined) sp.set("priceMin", String(state.priceMin));
  if (state.priceMax !== undefined) sp.set("priceMax", String(state.priceMax));
  if (state.radiusKm !== undefined) sp.set("radius", String(state.radiusKm));
  if (state.lat !== undefined) sp.set("lat", state.lat.toFixed(4));
  if (state.lng !== undefined) sp.set("lng", state.lng.toFixed(4));
  if (state.sort && state.sort !== "date") sp.set("sort", state.sort);
  if (state.page && state.page > 1) sp.set("page", String(state.page));
  if (state.withImages) sp.set("withImages", "1");
  if (state.promotedOnly) sp.set("promoted", "1");

  for (const [key, values] of Object.entries(state.attrs ?? {})) {
    if (values.length) sp.set(`${ATTR_PREFIX}${key}`, values.join(","));
  }
  for (const [key, range] of Object.entries(state.attrRanges ?? {})) {
    if (range.min !== undefined) sp.set(`${ATTR_PREFIX}${key}_min`, String(range.min));
    if (range.max !== undefined) sp.set(`${ATTR_PREFIX}${key}_max`, String(range.max));
  }
  for (const [key, value] of Object.entries(state.attrBools ?? {})) {
    if (value) sp.set(`${ATTR_PREFIX}${key}`, "1");
  }
  return sp;
}

/**
 * ממיר את מצב הפילטרים לשאילתת חיפוש, תוך תרגום מפתחות שדות
 * למזהי Attribute אמיתיים לפי הקטגוריה הנוכחית.
 */
export function toSearchQuery(
  state: FilterState,
  attributes: ResolvedAttribute[],
  extra: Partial<SearchQuery> = {},
): SearchQuery {
  const byKey = new Map<string, string[]>();
  for (const a of attributes) {
    byKey.set(a.key, [...(byKey.get(a.key) ?? []), a.id]);
  }

  const filters: AttributeFilter[] = [];

  for (const [key, values] of Object.entries(state.attrs)) {
    const ids = byKey.get(key);
    if (ids?.length && values.length) {
      filters.push({ attributeIds: ids, kind: "values", values });
    }
  }
  for (const [key, range] of Object.entries(state.attrRanges)) {
    const ids = byKey.get(key);
    if (ids?.length && (range.min !== undefined || range.max !== undefined)) {
      filters.push({ attributeIds: ids, kind: "range", ...range });
    }
  }
  for (const [key, value] of Object.entries(state.attrBools)) {
    const ids = byKey.get(key);
    if (ids?.length && value) {
      filters.push({ attributeIds: ids, kind: "bool", value: true });
    }
  }

  /*
   * הבנת שאילתה: חילוץ פילטרים מהטקסט החופשי.
   *
   * `"דירת 3 חד' בת״א עד 6000"` הופך לפילטרים אמיתיים במקום להיזרק
   * כולו ל-FTS, שם "עד" ו"6000" רק מרעישים.
   *
   * **פילטר שהמשתמש בחר במפורש תמיד מנצח את החילוץ.** אחרת בחירה
   * בממשק הייתה נדרסת ע"י ניחוש מהטקסט, וזה מרגיש כמו תקלה.
   */
  const parsed = state.q ? parseQuery(state.q) : null;

  // צ'יפ שהמשתמש הסיר חוזר להיות טקסט חופשי ולא פילטר
  const kept = new Set(state.keep ?? []);
  if (parsed && kept.size) {
    for (const chip of parsed.chips) {
      if (!kept.has(chip.key)) continue;
      delete parsed[chip.key];
      parsed.text = `${parsed.text} ${chip.source}`.trim();
    }
    parsed.chips = parsed.chips.filter((c) => !kept.has(c.key));
  }

  const inferred = parsed?.chips.length ? parsed : null;

  if (inferred) {
    const pushAttr = (key: string, kind: "values" | "range", value: unknown) => {
      const ids = byKey.get(key);
      if (!ids?.length) return;
      // לא דורסים פילטר שכבר הוגדר בממשק
      if (state.attrs[key]?.length || state.attrRanges[key]) return;
      if (kind === "values") {
        filters.push({ attributeIds: ids, kind: "values", values: [String(value)] });
      } else {
        const n = Number(value);
        filters.push({ attributeIds: ids, kind: "range", min: n, max: n });
      }
    };

    if (inferred.rooms !== undefined) pushAttr("rooms", "range", inferred.rooms);
    if (inferred.sqm !== undefined) pushAttr("size", "range", inferred.sqm);
    if (inferred.hand !== undefined) pushAttr("hand", "values", inferred.hand);
    if (inferred.make !== undefined) pushAttr("manufacturer", "values", inferred.make);

    if (inferred.yearMin !== undefined) {
      const ids = byKey.get("year");
      if (ids?.length && !state.attrRanges.year) {
        filters.push({
          attributeIds: ids,
          kind: "range",
          min: inferred.yearMin,
          max: inferred.yearMax ?? inferred.yearMin,
        });
      }
    }
  }

  return {
    // רק מה שלא חולץ נשאר לחיפוש החופשי
    q: inferred ? inferred.text || undefined : state.q,
    cities:
      state.cities.length
        ? state.cities
        : inferred?.city
          ? [inferred.city]
          : undefined,
    priceMin: state.priceMin ?? inferred?.priceMin,
    priceMax: state.priceMax ?? inferred?.priceMax,
    lat: state.lat,
    lng: state.lng,
    radiusKm: state.radiusKm,
    sort: state.sort,
    page: state.page,
    withImages: state.withImages || undefined,
    promotedOnly: state.promotedOnly || undefined,
    attributes: filters,
    ...extra,
  };
}

/** מספר הפילטרים הפעילים — מוצג כתג ליד כפתור "סינון". */
export function countActiveFilters(state: FilterState): number {
  let n = 0;
  if (state.cities.length) n += 1;
  if (state.priceMin !== undefined || state.priceMax !== undefined) n += 1;
  if (state.radiusKm !== undefined) n += 1;
  if (state.withImages) n += 1;
  if (state.promotedOnly) n += 1;
  n += Object.values(state.attrs).filter((v) => v.length).length;
  n += Object.values(state.attrRanges).filter(
    (r) => r.min !== undefined || r.max !== undefined,
  ).length;
  n += Object.values(state.attrBools).filter(Boolean).length;
  return n;
}
