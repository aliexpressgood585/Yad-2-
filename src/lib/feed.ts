/**
 * ייבוא מלאי — טבלה בפנים, מודעות בחוץ.
 *
 * אותו קוד משרת שני מסכים שנראים שונים לגמרי:
 *
 *   **העלאה מרוכזת** — הסוחר מעלה קובץ CSV פעם אחת.
 *   **ייבוא פיד** — הלוח מושך כתובת שוב ושוב.
 *
 * ההבדל היחיד ביניהם הוא מאיפה מגיע הטקסט. המיפוי, האימות, ההודעות
 * לשורה שנפלה והכתיבה למסד — זהים. פיצול שלהם לשני מימושים היה מבטיח
 * ששניים ייפרדו: אחד יתמוך בשדות דינמיים והשני לא, ואף אחד לא ישים לב
 * עד שסוחר יתלונן.
 *
 * ## אין כאן ספריית CSV
 *
 * המנתח למטה מטפל במה שקבצי מלאי אמיתיים מכילים — מרכאות, פסיקים בתוך
 * שדה, מרכאות כפולות ושורות חדשות בתוך שדה — וזה כל מה ש-RFC 4180
 * מגדיר. ספרייה הייתה מוסיפה תלות שלמה בשביל שלושים שורות.
 */

import type { AttributeType } from "@prisma/client";

/* -------------------------------------------------------------------------- */
/* ניתוח                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * מנתח CSV לפי RFC 4180.
 *
 * מטפל ב-BOM שאקסל בעברית מוסיף לכל קובץ שהוא שומר, ובשורות
 * ריקות בסוף. שדה מצוטט יכול להכיל פסיק, שורה חדשה, ומרכאה כפולה
 * שמייצגת מרכאה אחת.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;

    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // \r\n נספר כשבירה אחת
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * מנתח XML שטוח — פיד של פריטים שכל אחד מהם רשימת אלמנטים.
 *
 * מזהה את שם אלמנט הפריט לבד (`item`, `listing`, `car`, `ad`…), כדי
 * שסוחר לא יצטרך להסביר ללוח את מבנה הפיד שלו: המועמדים הם האלמנטים
 * שיש בתוכם אלמנטים אחרים, והנבחר הוא החוזר ביותר. בתיקו נבחר הפנימי
 * מביניהם — `<feed>` מכיל `<car>`, וזה `<car>` שהוא הפריט.
 *
 * **האיסוף אינו יכול להיות `matchAll` אחד.** ביטוי שתופס
 * `<name>…</name>` בולע את כל מה שבתוכו, ו-`matchAll` ממשיך מאחרי
 * ההתאמה — כלומר האלמנטים המקוננים לא נראים כלל. הבדיקה הראשונה
 * החזירה שורה אחת במקום שתיים בדיוק בגלל זה, ולכן כל שם נסרק בנפרד.
 *
 * `CDATA` נפרק, וישויות ה-XML הבסיסיות מפוענחות.
 */
export function parseXml(text: string): string[][] {
  const decode = (raw: string) =>
    raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();

  const body = text.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");

  // כל שם אלמנט שמופיע בקובץ, ולכל אחד הבלוקים שלו
  const names = new Set(
    [...body.matchAll(/<([A-Za-z_][\w.-]*)[\s>/]/g)].map((m) => m[1]!),
  );

  type Candidate = { name: string; blocks: { content: string; start: number }[] };
  const candidates: Candidate[] = [];

  for (const name of names) {
    const blocks = [
      ...body.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "g")),
    ].map((m) => ({ content: m[1]!, start: m.index ?? 0 }));

    // פריט הוא אלמנט שיש בתוכו אלמנטים; עלה אינו מועמד
    if (blocks.length && blocks.every((b) => /<[A-Za-z_]/.test(b.content))) {
      candidates.push({ name, blocks });
    }
  }

  if (!candidates.length) return [];

  candidates.sort(
    (a, b) =>
      b.blocks.length - a.blocks.length || (b.blocks[0]?.start ?? 0) - (a.blocks[0]?.start ?? 0),
  );

  const item = candidates[0]!;

  const parsed = item.blocks.map(({ content }) => {
    const fields = new Map<string, string>();
    for (const [, name, value] of content.matchAll(
      /<([A-Za-z_][\w.-]*)\b[^>]*>([\s\S]*?)<\/\1>/g,
    )) {
      // אלמנט שחוזר בתוך פריט (למשל <image>) נאסף למחרוזת אחת
      const previous = fields.get(name!);
      fields.set(name!, previous ? `${previous},${decode(value!)}` : decode(value!));
    }
    return fields;
  });

  const columns = [...new Set(parsed.flatMap((p) => [...p.keys()]))];
  if (!columns.length) return [];

  return [columns, ...parsed.map((p) => columns.map((c) => p.get(c) ?? ""))];
}

export function parseFeed(text: string, format: "CSV" | "XML"): string[][] {
  return format === "XML" ? parseXml(text) : parseCsv(text);
}

/* -------------------------------------------------------------------------- */
/* מיפוי                                                                       */
/* -------------------------------------------------------------------------- */

/** שדות הליבה של מודעה שאפשר למפות אליהם. */
export const CORE_FIELDS = [
  { key: "externalId", label: "מזהה אצל הסוחר", required: true },
  { key: "title", label: "כותרת", required: true },
  { key: "description", label: "תיאור", required: true },
  { key: "price", label: "מחיר", required: false },
  { key: "city", label: "עיר", required: true },
  { key: "neighborhood", label: "שכונה", required: false },
  { key: "images", label: "תמונות (מופרדות בפסיק)", required: false },
] as const;

export type CoreField = (typeof CORE_FIELDS)[number]["key"];

/**
 * מיפוי: שם שדה בלוח → שם העמודה בקובץ.
 *
 * הכיוון הזה ולא ההפוך, כי הלוח יודע מה הוא צריך והקובץ הוא מה
 * שהתקבל. שדה דינמי ממופה במפתח שלו (`manufacturer`, `year`…).
 */
export type FeedMapping = Record<string, string>;

/**
 * ניחוש מיפוי ראשוני מכותרות הקובץ.
 *
 * לא קסם ולא מודל: טבלת מילים נרדפות בעברית ובאנגלית. הסוחר רואה את
 * הניחוש ומתקן אותו במסך לפני שמשהו נכתב, ולכן ניחוש שגוי עולה קליק
 * ולא מודעה שגויה.
 */
const HEADER_SYNONYMS: Record<string, string[]> = {
  externalId: ["id", "sku", "code", "מזהה", "מקט", "מק״ט", "קוד", "reference", "ref"],
  title: ["title", "name", "כותרת", "שם", "תיאור קצר"],
  description: ["description", "desc", "details", "תיאור", "פרטים", "הערות"],
  price: ["price", "amount", "מחיר", "עלות"],
  city: ["city", "location", "עיר", "יישוב", "ישוב", "מיקום"],
  neighborhood: ["neighborhood", "area", "שכונה", "אזור"],
  images: ["image", "images", "photo", "photos", "picture", "תמונה", "תמונות"],
};

/** נרמול כותרת להשוואה — אותיות קטנות, בלי סימנים ובלי רווחים כפולים. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/["'׳״]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function guessMapping(
  headers: string[],
  attributeKeys: { key: string; label: string }[],
): FeedMapping {
  const mapping: FeedMapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  const match = (candidates: string[]): string | undefined =>
    normalized.find((h) => candidates.some((c) => h.norm === normalizeHeader(c)))?.raw ??
    normalized.find((h) => candidates.some((c) => h.norm.includes(normalizeHeader(c))))
      ?.raw;

  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    const found = match([field, ...synonyms]);
    if (found) mapping[field] = found;
  }

  for (const attr of attributeKeys) {
    const found = match([attr.key, attr.label]);
    if (found) mapping[attr.key] = found;
  }

  return mapping;
}

/* -------------------------------------------------------------------------- */
/* אימות שורה                                                                  */
/* -------------------------------------------------------------------------- */

export type AttributeSpec = {
  key: string;
  label: string;
  type: AttributeType;
  isRequired: boolean;
  /** ערכים מותרים ברשימה סגורה — התווית והערך גם יחד */
  values: { value: string; label: string }[];
};

export type ParsedRow = {
  /** מספר השורה בקובץ, כולל שורת הכותרות. מוצג לסוחר. */
  line: number;
  externalId: string;
  title: string;
  description: string;
  price: number | null;
  city: string;
  neighborhood: string | null;
  images: string[];
  attributes: Record<string, string | number | boolean>;
};

export type RowError = { line: number; field: string; message: string };

export type ParsedFeed = {
  rows: ParsedRow[];
  errors: RowError[];
  /** כותרות הקובץ, להצגה במסך המיפוי */
  headers: string[];
};

const MAX_ROWS = 2000;

/**
 * הופך טבלה גולמית לשורות מוכנות לכתיבה, עם שגיאה לכל שורה שנפלה.
 *
 * **שורה שנפלה אינה עוצרת את הייבוא.** קובץ של 800 רכבים שבו לשלושה
 * חסרה עיר צריך לייבא 797 ולהראות שלוש שורות אדומות עם מספר השורה
 * בקובץ — לא להיכשל כולו. סוחר שקיבל "שגיאה בקובץ" בלי מספר שורה
 * פותח את הקובץ באקסל ומחפש ידנית.
 */
export function mapRows(
  table: string[][],
  mapping: FeedMapping,
  attributes: AttributeSpec[],
): ParsedFeed {
  const [headerRow, ...dataRows] = table;
  const headers = headerRow ?? [];
  const index = new Map(headers.map((h, i) => [h, i]));

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  const read = (row: string[], field: string): string => {
    const column = mapping[field];
    if (!column) return "";
    const i = index.get(column);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  for (const [offset, row] of dataRows.slice(0, MAX_ROWS).entries()) {
    const line = offset + 2; // שורה 1 היא הכותרות
    const before = errors.length;

    const externalId = read(row, "externalId");
    const title = read(row, "title");
    const description = read(row, "description");
    const city = read(row, "city");
    const rawPrice = read(row, "price");

    if (!externalId) errors.push({ line, field: "externalId", message: "חסר מזהה" });
    if (title.length < 3) {
      errors.push({ line, field: "title", message: "כותרת קצרה מדי (לפחות 3 תווים)" });
    }
    if (description.length < 10) {
      errors.push({
        line,
        field: "description",
        message: "תיאור קצר מדי (לפחות 10 תווים)",
      });
    }
    if (!city) errors.push({ line, field: "city", message: "חסרה עיר" });

    let price: number | null = null;
    if (rawPrice) {
      // "₪ 84,000" ו-"84000.00" הם אותו מספר
      const digits = rawPrice.replace(/[^\d.-]/g, "");
      const value = Number(digits);
      if (!Number.isFinite(value) || value < 0) {
        errors.push({ line, field: "price", message: `מחיר לא תקין: "${rawPrice}"` });
      } else {
        price = Math.round(value);
      }
    }

    const parsedAttributes: Record<string, string | number | boolean> = {};
    for (const attr of attributes) {
      const raw = read(row, attr.key);
      if (!raw) {
        if (attr.isRequired) {
          errors.push({ line, field: attr.key, message: `חסר ${attr.label}` });
        }
        continue;
      }

      if (attr.type === "NUMBER") {
        const value = Number(raw.replace(/[^\d.-]/g, ""));
        if (!Number.isFinite(value)) {
          errors.push({ line, field: attr.key, message: `${attr.label}: "${raw}" אינו מספר` });
          continue;
        }
        parsedAttributes[attr.key] = value;
        continue;
      }

      if (attr.type === "BOOLEAN") {
        const truthy = ["1", "true", "yes", "כן", "יש", "y"];
        const falsy = ["0", "false", "no", "לא", "אין", "n"];
        const norm = raw.toLowerCase();
        if (truthy.includes(norm)) parsedAttributes[attr.key] = true;
        else if (falsy.includes(norm)) parsedAttributes[attr.key] = false;
        else {
          errors.push({
            line,
            field: attr.key,
            message: `${attr.label}: "${raw}" אינו כן/לא`,
          });
        }
        continue;
      }

      if (attr.values.length) {
        /*
         * התאמה לפי התווית או לפי הערך, בשני הכיוונים. פיד של יבואן
         * כותב "טויוטה" ופיד של מערכת ניהול כותב "toyota", ושניהם
         * מתכוונים לאותו דבר.
         */
        const norm = normalizeHeader(raw);
        const found = attr.values.find(
          (v) => normalizeHeader(v.label) === norm || normalizeHeader(v.value) === norm,
        );
        if (!found) {
          errors.push({
            line,
            field: attr.key,
            message: `${attr.label}: "${raw}" אינו ערך מוכר`,
          });
          continue;
        }
        parsedAttributes[attr.key] = found.value;
        continue;
      }

      parsedAttributes[attr.key] = raw;
    }

    if (errors.length > before) continue;

    rows.push({
      line,
      externalId,
      title,
      description,
      price,
      city,
      neighborhood: read(row, "neighborhood") || null,
      images: read(row, "images")
        .split(/[,;|\s]+/)
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//.test(u))
        .slice(0, 10),
      attributes: parsedAttributes,
    });
  }

  if (dataRows.length > MAX_ROWS) {
    errors.push({
      line: MAX_ROWS + 2,
      field: "file",
      message: `הקובץ מכיל ${dataRows.length} שורות. מיובאות ${MAX_ROWS} הראשונות.`,
    });
  }

  return { rows, errors, headers };
}

/** קובץ CSV לדוגמה, להורדה מהמסך. */
export function sampleCsv(attributes: AttributeSpec[]): string {
  const columns = [
    ...CORE_FIELDS.map((f) => f.key),
    ...attributes.filter((a) => a.isRequired).map((a) => a.key),
  ];

  const example = columns.map((c) => {
    switch (c) {
      case "externalId":
        return "A-1001";
      case "title":
        return "טויוטה קורולה 2019";
      case "description":
        return "רכב במצב מצוין, טופל במוסך מורשה, תיעוד מלא.";
      case "price":
        return "84000";
      case "city":
        return "תל אביב-יפו";
      case "neighborhood":
        return "פלורנטין";
      case "images":
        return "https://example.com/1.jpg,https://example.com/2.jpg";
      default: {
        const attr = attributes.find((a) => a.key === c);
        if (!attr) return "";
        if (attr.type === "NUMBER") return "2019";
        if (attr.type === "BOOLEAN") return "כן";
        return attr.values[0]?.label ?? "";
      }
    }
  });

  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${columns.join(",")}\n${example.map(escape).join(",")}\n`;
}
