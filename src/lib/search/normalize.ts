/**
 * נרמול עברית לחיפוש.
 *
 * כל שאילתה וכל מודעה עוברות דרך `normalize()` לפני אינדוקס ולפני
 * חיפוש. אם שני הצדדים לא עוברים בדיוק את אותו נרמול, החיפוש נשבר
 * בשקט — ולכן זו הפונקציה היחידה שמותר לה לגעת בטקסט לפני האינדקס.
 *
 * העברית מציבה כאן בעיות שאין באנגלית:
 *   אותיות סופיות   — "ירושלים" מול "ירושלימ" אחרי חיתוך
 *   גרשיים          — "ת״א", "ת"א", "ת'א", "תא" הם אותו דבר
 *   כתיב מלא/חסר    — "מזגן"/"מזגון", "דירה"/"דירא"
 *   ספרות מילוליות  — "3 חדרים" מול "שלושה חדרים"
 *
 * הצורה המקורית נשמרת תמיד לתצוגה; המנורמלת משמשת רק להתאמה.
 */

/** גרשיים, גרשים ומקפים בכל הווריאציות שמופיעות בטקסט עברי. */
const QUOTE_CHARS = /["'`׳״“”‘’]/g;
const DASH_CHARS = /[-‒–—―−]/g;

/** סופיות → רגילות. מוחל על כל אות בטקסט, לא רק בסוף מילה. */
const FINAL_LETTERS: Record<string, string> = {
  ם: "מ",
  ן: "נ",
  ץ: "צ",
  ף: "פ",
  ך: "כ",
};

/**
 * מספרים במילים.
 *
 * כולל צורת זכר ונקבה, כי "שלוש חדרים" ו"שלושה חדרים" נכתבים שניהם
 * בפועל. הכיוון מילה → ספרה בלבד: הספרה היא הצורה הקנונית.
 */
const WORD_NUMBERS: Record<string, string> = {
  אחד: "1", אחת: "1",
  שניים: "2", שתיים: "2", שני: "2", שתי: "2",
  שלושה: "3", שלוש: "3",
  ארבעה: "4", ארבע: "4",
  חמישה: "5", חמש: "5",
  שישה: "6", שש: "6",
  שבעה: "7", שבע: "7",
  שמונה: "8",
  תשעה: "9", תשע: "9",
  עשרה: "10", עשר: "10",
};

/**
 * כתיב מלא/חסר ושיכולי אותיות נפוצים.
 *
 * מוחל אחרי פיצול למילים, על מילה שלמה בלבד — החלפה בתוך מילה הייתה
 * הופכת "מזגן" ל"מזגן" גם בתוך "ממזגן" ופוגעת בדיוק.
 */
const SPELLING: Record<string, string> = {
  מזגון: "מזגן",
  דירת: "דירה",
  דירות: "דירה",
  חדרים: "חדר",
  חדר: "חדר",
  מטר: "מר",
  מטרים: "מר",
  שכירות: "השכרה",
  להשכרה: "השכרה",
  למכירה: "מכירה",
  מכירת: "מכירה",
};

/**
 * מנרמל טקסט לצורת ההתאמה.
 * הפעולות מסודרות מהגסה לעדינה; שינוי הסדר משנה תוצאה.
 */
export function normalize(input: string): string {
  if (!input) return "";

  let s = input.normalize("NFKD");

  // ניקוד וטעמי מקרא
  s = s.replace(/[֑-ׇ]/g, "");

  // גרשיים נמחקים ולא מוחלפים ברווח: "ת״א" חייב להפוך ל"תא" ולא
  // ל"ת א", אחרת הקיצור מתפרק לשתי אותיות חסרות משמעות.
  s = s.replace(QUOTE_CHARS, "");

  // מקף נמחק רק כשהוא מחבר אותיות בודדות — "י-ם" הוא קיצור של
  // ירושלים, אבל "תל אביב-יפו" הוא שני שמות ולא מילה אחת.
  s = s
    .replace(/(?<=(^|\s)\p{L})[-‒–—―−](?=\p{L}(\s|$))/gu, "")
    .replace(DASH_CHARS, " ");

  s = s.toLowerCase();

  // אותיות סופיות
  s = s.replace(/[םןץףך]/g, (c) => FINAL_LETTERS[c] ?? c);

  // כל מה שאינו אות, ספרה או נקודה עשרונית → רווח
  s = s.replace(/[^\p{L}\p{N}.]/gu, " ");

  // נקודה נשמרת רק בין ספרות (1.5 מיליון), ולא בסוף משפט
  s = s.replace(/\.(?!\d)/g, " ").replace(/(?<!\d)\./g, " ");

  return s.replace(/\s+/g, " ").trim();
}

/**
 * המפות מנורמלות פעם אחת בטעינה.
 *
 * בלי זה הלוקאפ נכשל בשקט: `normalize` כבר החליף "חדרים" ל"חדרימ",
 * והמפתח במפה נשאר "חדרים".
 */
const SPELLING_NORMALIZED = new Map(
  Object.entries(SPELLING).map(([k, v]) => [normalize(k), normalize(v)]),
);

const WORD_NUMBERS_NORMALIZED = new Map(
  Object.entries(WORD_NUMBERS).map(([k, v]) => [normalize(k), v]),
);

/**
 * מילים שנראות כמספר אבל הן חלק משם מקום, ולכן לא מומרות.
 * "באר שבע" אינו "באר 7".
 */
const NUMBER_WORD_BLOCKLIST = new Set(
  ["באר שבע", "קרית שמונה", "קריית שמונה", "תל שבע"].map(normalize),
);

/** מנרמל ומפצל למילים, כולל תרגום כתיב. */
export function tokenize(input: string): string[] {
  const text = normalize(input);
  const blocked = [...NUMBER_WORD_BLOCKLIST].some((p) => text.includes(p));

  return text
    .split(" ")
    .filter(Boolean)
    .map((t) => (blocked ? t : (WORD_NUMBERS_NORMALIZED.get(t) ?? t)))
    .map((t) => SPELLING_NORMALIZED.get(t) ?? t);
}

/** נרמול מלא כמחרוזת אחת — מה שנשמר בעמודת החיפוש. */
export function normalizeForIndex(input: string): string {
  return tokenize(input).join(" ");
}

/**
 * וריאציות כתיב של אותה מילה, לשימוש בהרחבת שאילתה.
 * מחזיר את המילה עצמה תמיד, גם כשאין לה וריאציה.
 */
export function spellingVariants(term: string): string[] {
  const out = new Set<string>([term]);

  // ו/וו ו-י/יי — כתיב מלא מול חסר
  if (term.includes("וו")) out.add(term.replace(/וו/g, "ו"));
  else if (term.includes("ו")) out.add(term.replace(/ו/g, "וו"));
  if (term.includes("יי")) out.add(term.replace(/יי/g, "י"));
  else if (term.includes("י")) out.add(term.replace(/י/g, "יי"));

  return [...out];
}
