import { UNIQUE_CITIES } from "@/lib/cities";
import { normalize, tokenize } from "@/lib/search/normalize";
import { MULTI_WORD_TERMS, synonymsOf } from "@/lib/search/synonyms";

/**
 * הבנת שאילתה: חילוץ פילטרים מטקסט חופשי.
 *
 * `"דירת 3 חד' בת״א עד 6000"` →
 *   { rooms: 3, city: "תל אביב-יפו", priceMax: 6000, text: "דירה" }
 *
 * מבוסס חוקים ולא מודל: החיפוש נמצא בנתיב החם של כל בקשה, וקריאה
 * למודל שם הייתה מוסיפה מאות מילישניות ונקודת כשל חיצונית. חוקים גם
 * ניתנים להסבר למשתמש — וזה תנאי לכך שיוכל להסיר חילוץ שגוי.
 *
 * כל מה שלא חולץ נשאר ב-`text` ועובר ל-FTS.
 */

export type ParsedQuery = {
  /** מה שנותר אחרי החילוץ, לחיפוש חופשי */
  text: string;
  rooms?: number;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  yearMin?: number;
  yearMax?: number;
  hand?: number;
  sqm?: number;
  make?: string;
  /** מה חולץ, לתצוגה כצ'יפים ניתנים להסרה */
  chips: ParsedChip[];
};

export type ParsedChip = {
  /** מפתח הפילטר שהצ'יפ מייצג — הסרתו מחזירה את המילים לטקסט */
  key: keyof Omit<ParsedQuery, "text" | "chips">;
  label: string;
  /** המילים המקוריות שנצרכו, כדי להחזירן בהסרה */
  source: string;
};

/**
 * גבול מילה בעברית.
 *
 * `\b` של JavaScript מוגדר מול `\w`, שאינו כולל אותיות עבריות — ולכן
 * `/\bמיליון\b/` פשוט לא מתאים לעולם. כל הביטויים כאן משתמשים
 * בגבולות מפורשים במקום.
 */
const B = "(?:^|[\\s])";
const E = "(?=[\\s]|$)";

/** תחיליות עבריות שנדבקות למילה: "בתל אביב", "לירושלים", "מחיפה". */
const PREFIX = "(?:[בלמהושכ]?)";

/** מכפילי סכום: "1.5 מיליון" → 1,500,000 */
const MULTIPLIERS: { words: string[]; factor: number }[] = [
  { words: ["מיליון", "מליון", "m"].map(normalize), factor: 1_000_000 },
  { words: ["אלף", "k"].map(normalize), factor: 1000 },
];

/** קבוצת המכפילים כחלופה לביטוי רגולרי, מנורמלת. */
const MULTIPLIER_ALT = MULTIPLIERS.flatMap((m) => m.words).join("|");

/** ערים ממוינות לפי אורך יורד — "קריית אתא" לפני "אתא". */
const CITY_INDEX = UNIQUE_CITIES.map((c) => ({
  name: c.name,
  normalized: normalize(c.name),
})).sort((a, b) => b.normalized.length - a.normalized.length);

/** יצרני רכב לזיהוי בשאילתה. */
const MAKES = [
  "טויוטה", "יונדאי", "מאזדה", "קיה", "סקודה", "פולקסווגן", "מיצובישי",
  "ניסאן", "הונדה", "סובארו", "שברולט", "פורד", "רנו", "פיג'ו", "סיטרואן",
  "מרצדס", "אאודי", "טסלה", "סוזוקי", "אופל", "סיאט", "צ'רי", "במוו",
  "איווקו", "איסוזו",
].map((m) => ({ display: m, normalized: normalize(m) }));

/** מגן על תווים מיוחדים לפני הכנסה לביטוי רגולרי. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** מסיר ביטוי מהטקסט פעם אחת, ומחזיר את הטקסט שנותר. */
function consume(text: string, phrase: string): string {
  return text.replace(phrase, " ").replace(/\s+/g, " ").trim();
}

/** מפרש מספר עם מכפיל אופציונלי שצמוד אליו. */
function readAmount(raw: string, rest: string): number {
  const base = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(base)) return NaN;
  const token = normalize(rest);
  for (const { words, factor } of MULTIPLIERS) {
    if (words.includes(token)) return Math.round(base * factor);
  }
  return base;
}

export function parseQuery(input: string): ParsedQuery {
  // עובדים על הצורה המטוקנת: שם כבר "שלושה"→3 ו"חדרים"→"חדר",
  // כך שהחוקים למטה מתמודדים עם צורה קנונית אחת בלבד.
  let text = ` ${tokenize(input).join(" ")} `;
  const chips: ParsedChip[] = [];
  const out: ParsedQuery = { text: "", chips };

  const add = (
    key: ParsedChip["key"],
    label: string,
    source: string,
  ) => {
    chips.push({ key, label, source });
    text = consume(text, source);
  };

  // --- חדרים: "3 חד" / "3 חדרים" / "שלושה חדרים" ---------------------
  // הנרמול כבר הפך "שלושה" ל-3 ו"חדרים" ל"חדר".
  const roomsMatch = text.match(new RegExp(`(\\d+(?:\\.\\d)?)\\s*(?:חדר|חד)${E}`));
  if (roomsMatch) {
    out.rooms = Number(roomsMatch[1]);
    add("rooms", `${out.rooms} חדרים`, roomsMatch[0]);
  }

  // --- מ"ר --------------------------------------------------------------
  const sqmMatch = text.match(new RegExp(`(\\d{2,4})\\s*(?:מר|מטר רבוע|sqm)${E}`));
  if (sqmMatch) {
    out.sqm = Number(sqmMatch[1]);
    add("sqm", `${out.sqm} מ"ר`, sqmMatch[0]);
  }

  // --- יד ---------------------------------------------------------------
  const handMatch = text.match(new RegExp(`${B}יד\\s*(1|2|3|ראשונה|שניה|שנייה|שלישית)${E}`));
  if (handMatch) {
    const raw = handMatch[1]!;
    out.hand = raw === "1" || raw === "ראשונה" ? 1 : raw === "3" || raw === "שלישית" ? 3 : 2;
    add("hand", `יד ${out.hand}`, handMatch[0]);
  }

  // --- שנת ייצור --------------------------------------------------------
  const yearRange = text.match(
    new RegExp(`${B}(19\\d{2}|20\\d{2})\\s*(?:עד|)\\s*(19\\d{2}|20\\d{2})${E}`),
  );
  if (yearRange) {
    out.yearMin = Number(yearRange[1]);
    out.yearMax = Number(yearRange[2]);
    add("yearMin", `${out.yearMin}–${out.yearMax}`, yearRange[0]);
  } else {
    const year = text.match(new RegExp(`${B}(19[89]\\d|20[0-4]\\d)${E}`));
    if (year) {
      out.yearMin = Number(year[1]);
      out.yearMax = out.yearMin;
      add("yearMin", String(out.yearMin), year[0]);
    }
  }

  // --- מחיר עליון: "עד X" / "מתחת ל X" / "X ומטה" ------------------------
  const maxMatch = text.match(
    new RegExp(`${B}(?:עד|מתחת ל|לא יותר מ|max)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${MULTIPLIER_ALT})?`),
  );
  if (maxMatch) {
    const amount = readAmount(maxMatch[1]!, maxMatch[2] ?? "");
    if (Number.isFinite(amount)) {
      out.priceMax = amount;
      add("priceMax", `עד ₪${amount.toLocaleString("he-IL")}`, maxMatch[0]);
    }
  }

  // --- מחיר תחתון: "מ X" / "מעל X" --------------------------------------
  const minMatch = text.match(
    new RegExp(`${B}(?:מעל|החל מ|מ)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${MULTIPLIER_ALT})?`),
  );
  if (minMatch) {
    const amount = readAmount(minMatch[1]!, minMatch[2] ?? "");
    // סף: מספר קטן אחרי "מ" הוא בדרך כלל חלק ממילה ולא מחיר
    if (Number.isFinite(amount) && amount >= 100) {
      out.priceMin = amount;
      add("priceMin", `מ-₪${amount.toLocaleString("he-IL")}`, minMatch[0]);
    }
  }

  // --- עיר: קיצור או שם מלא --------------------------------------------
  // הקיצורים מגיעים מהמילון ("תא" → "תל אביב"), ולכן בודקים גם את
  // השקילויות של כל צירוף רב-מילי לפני חיפוש שם עיר מלא.
  for (const phrase of MULTI_WORD_TERMS) {
    if (!text.includes(phrase)) continue;
    const city = CITY_INDEX.find((c) =>
      synonymsOf(phrase).some((s) => s === c.normalized),
    );
    if (city) {
      out.city = city.name;
      add("city", city.name, phrase);
      break;
    }
  }

  if (!out.city) {
    // כל צורות הכתיבה של כל עיר, ארוכות קודם, כדי ש"קריית אתא"
    // תיבדק לפני "אתא".
    const candidates = CITY_INDEX.flatMap((c) =>
      [c.normalized, ...synonymsOf(c.name)].map((form) => ({ city: c.name, form })),
    ).sort((a, b) => b.form.length - a.form.length);

    for (const { city, form } of candidates) {
      if (form.length < 2) continue;
      const m = text.match(new RegExp(`${B}${PREFIX}${esc(form)}${E}`));
      if (m) {
        out.city = city;
        add("city", city, m[0].trim());
        break;
      }
    }
  }

  // --- יצרן -------------------------------------------------------------
  for (const make of MAKES) {
    const hit = synonymsOf(make.normalized)
      .sort((a, b) => b.length - a.length)
      .find((s) => new RegExp(`${B}${PREFIX}${esc(s)}${E}`).test(text));
    if (hit) {
      out.make = make.display;
      const m = text.match(new RegExp(`${B}${PREFIX}${esc(hit)}${E}`))!;
      add("make", make.display, m[0].trim());
      break;
    }
  }

  /*
   * תחיליות יתומות.
   *
   * "בתל אביב" → העיר נצרכה והשאירה "ב" בודדת. אות בודדת ב-FTS היא
   * רעש שמצמצם תוצאות בלי להוסיף מידע, ולכן היא מוסרת.
   */
  out.text = text
    .split(" ")
    .filter((t) => t.length > 1)
    .join(" ")
    .trim();
  return out;
}

/**
 * מסיר צ'יפ אחד ומחזיר את השאילתה כטקסט — כך שהסרה בלחיצה מחזירה
 * את המילים המקוריות לחיפוש החופשי במקום לאבד אותן.
 */
export function removeChip(parsed: ParsedQuery, key: ParsedChip["key"]): string {
  const removed = parsed.chips.find((c) => c.key === key);
  const kept = parsed.chips.filter((c) => c.key !== key);
  return [parsed.text, removed?.source, ...kept.map((c) => c.source)]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** מילות החיפוש שנותרו, מורחבות בשקילויות. */
export function freeTextTerms(parsed: ParsedQuery): string[] {
  return tokenize(parsed.text);
}
