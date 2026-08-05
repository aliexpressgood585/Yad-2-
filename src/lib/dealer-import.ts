/**
 * ייבוא מרוכז של מודעות מקובץ CSV.
 *
 * סוחר עם 80 רכבים לא יפרסם אותם אחד-אחד באשף בן ארבעה שלבים, וזו
 * הסיבה היחידה שהמסך הזה קיים. הכול כאן נגזר מכך:
 *
 *   **שורה שגויה לא מפילה את הקובץ.** קובץ של 80 שורות שנדחה בגלל
 *   שורה 34 הוא קובץ שהסוחר יתקן וישלח שוב, ויגלה שגם שורה 51 שגויה.
 *   כל שורה נבדקת בנפרד, והתשובה היא רשימה מלאה של הבעיות.
 *
 *   **תמיד תצוגה מקדימה לפני יצירה.** ייבוא הוא פעולה שקשה לבטל,
 *   ו-80 מודעות שגויות באוויר הן נזק אמיתי למוניטין של הסוחר.
 *
 * הקובץ טהור ואינו נוגע במסד — כדי שיהיו לו בדיקות.
 */

/** העמודות המחייבות. שמות בעברית, כי הסוחר מייצא מאקסל בעברית. */
export const REQUIRED_COLUMNS = ["כותרת", "תיאור", "מחיר", "עיר"] as const;

/** עמודות מוכרות שאינן מאפיין דינמי. */
const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, "קטגוריה", "טלפון", "שכונה"]);

export type ImportRow = {
  /** מספר השורה בקובץ כפי שהסוחר רואה אותו, כולל שורת הכותרות */
  line: number;
  title: string;
  description: string;
  price: number;
  city: string;
  neighborhood?: string;
  phone?: string;
  categorySlug?: string;
  /** כל עמודה שאינה מוכרת נחשבת מאפיין דינמי */
  attributes: Record<string, string>;
};

export type RowError = { line: number; column: string; message: string };

export type ParseResult = {
  rows: ImportRow[];
  errors: RowError[];
  /** שמות העמודות כפי שנקראו מהקובץ */
  columns: string[];
};

/**
 * מפרק שורת CSV אחת, כולל שדות במרכאות עם פסיקים בתוכם.
 *
 * נכתב ידנית ולא דרך ספרייה: התלות היחידה שנחסכת כאן קטנה מהתלות
 * שהיא מוסיפה, והכלל היחיד שאינו טריוויאלי הוא מרכאה כפולה בתוך שדה
 * מצוטט (`""`), שמייצגת מרכאה אחת.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(field.trim());
      field = "";
    } else field += ch;
  }

  out.push(field.trim());
  return out;
}

/**
 * המרת מחיר מטקסט חופשי.
 *
 * סוחרים מייצאים מאקסל, ואקסל מוסיף מפרידי אלפים וסימן מטבע.
 * `Number("₪104,500")` הוא `NaN`, וזו הייתה שורה שנדחית בלי סיבה
 * אמיתית. `null` מוחזר רק כשבאמת אין מספר.
 */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[₪$€\s,]/g, "").replace(/ /g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

const MIN_TITLE = 10;
const MIN_DESCRIPTION = 30;
const MAX_PRICE = 100_000_000;

/**
 * מפרק ובודק קובץ שלם.
 *
 * מחזיר גם שורות תקינות וגם שגיאות — **תמיד את שתיהן.** המסך מציג
 * את מה שייווצר לצד מה שנדחה, והסוחר מחליט אם לייבא את התקינות עכשיו
 * או לתקן ולשלוח שוב.
 */
export function parseImport(csv: string): ParseResult {
  const errors: RowError[] = [];
  const rows: ImportRow[] = [];

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, column: "", message: "הקובץ ריק" }], columns: [] };
  }

  const columns = parseCsvLine(lines[0]!).map((c) => c.replace(/^﻿/, ""));

  for (const required of REQUIRED_COLUMNS) {
    if (!columns.includes(required)) {
      errors.push({ line: 1, column: required, message: `חסרה עמודת חובה "${required}"` });
    }
  }
  if (errors.length) return { rows, errors, columns };

  const index = (name: string) => columns.indexOf(name);

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cells = parseCsvLine(lines[i]!);
    const get = (name: string) => (index(name) >= 0 ? (cells[index(name)] ?? "") : "");

    const title = get("כותרת");
    const description = get("תיאור");
    const price = parsePrice(get("מחיר"));
    const city = get("עיר");

    const rowErrors: RowError[] = [];

    if (title.length < MIN_TITLE) {
      rowErrors.push({
        line,
        column: "כותרת",
        message: `כותרת קצרה מדי (${title.length} תווים, נדרשים ${MIN_TITLE})`,
      });
    }
    if (description.length < MIN_DESCRIPTION) {
      rowErrors.push({
        line,
        column: "תיאור",
        message: `תיאור קצר מדי (${description.length} תווים, נדרשים ${MIN_DESCRIPTION})`,
      });
    }
    if (price === null) {
      rowErrors.push({ line, column: "מחיר", message: `"${get("מחיר")}" אינו מחיר תקין` });
    } else if (price > MAX_PRICE) {
      rowErrors.push({ line, column: "מחיר", message: "המחיר גבוה מהמותר" });
    }
    if (!city) {
      rowErrors.push({ line, column: "עיר", message: "חסרה עיר" });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    const attributes: Record<string, string> = {};
    for (const col of columns) {
      if (KNOWN_COLUMNS.has(col)) continue;
      const value = get(col);
      if (value) attributes[col] = value;
    }

    rows.push({
      line,
      title,
      description,
      price: price!,
      city,
      neighborhood: get("שכונה") || undefined,
      phone: get("טלפון") || undefined,
      categorySlug: get("קטגוריה") || undefined,
      attributes,
    });
  }

  return { rows, errors, columns };
}

/**
 * מוצא כפילויות בתוך הקובץ עצמו.
 *
 * ייצוא מאקסל מכיל שורות כפולות לעיתים קרובות — סוחר שמייצא פעמיים
 * ומדביק את שתי התוצאות. אותה כותרת עם אותו מחיר היא כמעט תמיד טעות,
 * וזול יותר לומר לו מראש מאשר להסביר אחר כך למה יש לו 160 מודעות.
 */
export function findDuplicates(rows: ImportRow[]): RowError[] {
  const seen = new Map<string, number>();
  const out: RowError[] = [];

  for (const row of rows) {
    const key = `${row.title}::${row.price}`;
    const first = seen.get(key);
    if (first !== undefined) {
      out.push({
        line: row.line,
        column: "כותרת",
        message: `כפילות של שורה ${first} — אותה כותרת ואותו מחיר`,
      });
    } else {
      seen.set(key, row.line);
    }
  }

  return out;
}

/** דוגמת CSV להורדה, כדי שהסוחר יראה את הפורמט במקום לנחש אותו. */
export const SAMPLE_CSV = [
  "כותרת,תיאור,מחיר,עיר,שכונה,קטגוריה,יצרן,שנה,קילומטראז'",
  '"טויוטה קורולה הייבריד 1.8","רכב במצב מצוין, יד ראשונה מחברה, טופל במוסך מורשה בלבד",104500,פתח תקווה,,private-cars,טויוטה,2021,82400',
  '"מאזדה 3 סקייאקטיב","שמור היטב, ללא תאונות, כל הטיפולים בזמן ותיעוד מלא",89000,חיפה,,private-cars,מאזדה,2020,61200',
].join("\n");
