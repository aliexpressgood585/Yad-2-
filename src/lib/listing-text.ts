import { createHash } from "crypto";

/** גרשיים וגרשים בעברית שיש לנרמל לפני אינדוקס. */
const QUOTES = /["'`׳״]/g;

/**
 * מנרמל טקסט עברי לצורך חיפוש: מסיר ניקוד, מאחד גרשיים,
 * ומצמצם רווחים. חייב להיות זהה בזמן אינדוקס ובזמן שאילתה.
 */
export function normalizeHebrew(input: string): string {
  return input
    .normalize("NFKD")
    // ניקוד וטעמים
    .replace(/[֑-ׇ]/g, "")
    .replace(QUOTES, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * בונה את מחרוזת החיפוש המאוחסנת בעמודת `searchText`.
 * כוללת כותרת (במשקל כפול), תיאור, מיקום, קטגוריה וערכי שדות דינמיים.
 */
export function buildSearchText(input: {
  title: string;
  description: string;
  city: string;
  neighborhood?: string | null;
  categoryNames: string[];
  attributeLabels?: string[];
}): string {
  const parts = [
    input.title,
    input.title, // הכותרת נספרת פעמיים כדי להעדיף התאמות בכותרת
    input.description,
    input.city,
    input.neighborhood ?? "",
    ...input.categoryNames,
    ...(input.attributeLabels ?? []),
  ];
  return normalizeHebrew(parts.join(" ")).slice(0, 8000);
}

/**
 * טביעת אצבע לזיהוי מודעות כפולות.
 * מבוססת על כותרת + מחיר + 200 התווים הראשונים של התיאור,
 * כך ששינויים קוסמטיים לא ישברו את הזיהוי.
 */
export function contentFingerprint(input: {
  title: string;
  description: string;
  price: number | null;
  categoryId: string;
}): string {
  const base = [
    normalizeHebrew(input.title),
    normalizeHebrew(input.description).slice(0, 200),
    input.price ?? "",
    input.categoryId,
  ].join("|");
  return createHash("sha256").update(base).digest("hex").slice(0, 32);
}

/** מפרק שאילתת חיפוש למילים משמעותיות. */
export function tokenizeQuery(q: string): string[] {
  return normalizeHebrew(q)
    .split(" ")
    .filter((t) => t.length >= 2)
    .slice(0, 10);
}

/**
 * מילים נרדפות בין עברית לאנגלית. משתמשים מחפשים "אייפון" אבל
 * המודעה כתובה "iPhone" — ההרחבה גורמת לשתי הצורות למצוא זו את זו.
 */
const SYNONYMS: Record<string, string[]> = {
  אייפון: ["iphone", "apple"],
  איפון: ["iphone", "apple"],
  אפל: ["apple", "iphone", "macbook"],
  סמסונג: ["samsung", "galaxy"],
  שיאומי: ["xiaomi", "redmi"],
  מקבוק: ["macbook", "apple"],
  לנובו: ["lenovo"],
  אסוס: ["asus"],
  פלייסטיישן: ["playstation", "ps5", "sony"],
  אקסבוקס: ["xbox"],
  נינטנדו: ["nintendo", "switch"],
  בוש: ["bosch"],
  אלקטרה: ["electra"],
  טסלה: ["tesla"],
  יונדאי: ["hyundai"],
  מאזדה: ["mazda"],
  איקאה: ["ikea"],
  נייק: ["nike"],
  אדידס: ["adidas"],
  זארה: ["zara"],
  לפטופ: ["מחשב", "נייד", "laptop"],
  מקרר: ["מקרר"],
  רכב: ["רכב", "מכונית", "אוטו"],
  אוטו: ["רכב", "מכונית"],
  מכונית: ["רכב", "אוטו"],
  דירה: ["דירת", "דירות"],
  דירת: ["דירה", "דירות"],
  בית: ["בית", "בתים"],
  אופניים: ["אופניים", "אופני"],
};

/** מרחיב מילות חיפוש במילים נרדפות (ללא כפילויות). */
export function expandSynonyms(terms: string[]): string[] {
  const out = new Set(terms);
  for (const t of terms) {
    for (const syn of SYNONYMS[t] ?? []) out.add(syn);
  }
  return [...out].slice(0, 20);
}
