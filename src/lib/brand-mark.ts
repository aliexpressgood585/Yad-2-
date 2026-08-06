/**
 * הסימן של כדאי — גאומטריה אחת, שני מרנדררים.
 *
 * הקובץ הזה הוא **מקור האמת היחיד** לצורת הסימן. הרכיב ב-React מצייר
 * ממנו, וסקריפט האייקונים (`scripts/generate-icons.ts`) מייצר ממנו את
 * קובצי ה-PNG. בלי זה הלוגו והפאביקון נפרדים בהחלטה הראשונה ששוכחים
 * להעתיק — וזה בדיוק מה שקרה בגרסה הקודמת.
 *
 * ------------------------------------------------------------------
 * מה הסימן מראה
 *
 * שורת קווים של מכשיר מדידה, ומחוג ענבר אחד. זה בדיוק הרכיב שיושב על
 * כל מודעה בלוח (`PriceMeter`): הסקאלה מראה את טווח המחירים של מודעות
 * דומות, והמחוג מראה איפה המחיר הזה יושב בתוכו.
 *
 * **המחוג אינו במרכז.** זה כל ההבדל בין "סקאלה" לבין "כדאי":
 * סקאלה עם מחוג במרכז מציגה מכשיר. סקאלה עם מחוג עמוק בקצה הזול
 * מציגה **פסק דין** — ומה שהמותג מוכר הוא התשובה, לא המדידה.
 *
 * הקצה הזול הוא הימני, כי כך בדיוק עובד `PriceMeter` ב-RTL:
 * `inset-inline-start: 0%` הוא האחוזון ה-0, והוא נמצא מימין. סימן
 * שהמחוג בו יושב בצד השני מהרכיב האמיתי הוא סימן ששיקר.
 * ------------------------------------------------------------------
 */

/** מרחב הציור. יחסי 28×20 — רחב, כמו לוחית מכשיר ולא כמו אייקון ריבועי. */
export const MARK_VIEWBOX = { width: 28, height: 20 } as const;

/**
 * קו הבסיס שכל הקווי סקאלה יושבות עליו.
 *
 * הקווים מצוירים ב-`stroke-linecap: butt` ולא `square`: קצה מרובע
 * מאריך כל קו בחצי ממשקלו לכל כיוון, והמחוג עבה מהקווים — כלומר הוא
 * היה יורד מתחת לקו הבסיס שלהן. הפרש של רבע יחידה, וזה בדיוק ההפרש
 * שבין סימן מכויל לסימן מצויר.
 */
const BASELINE = 17;

/**
 * קווים ראשיים — כל רבע של הסקאלה, בדיוק כמו
 * `repeating-linear-gradient(... 25%)` ב-`.price-scale`.
 */
export const MARK_MAJOR_TICKS = [2, 8, 14, 20, 26] as const;

/**
 * קווי משנה — באמצע כל רבע.
 *
 * חסרה כאן אחת: הקו שבין 20 ל-26. שם עומד המחוג, והוא תופס את
 * מקומה. המקצב האפור נשבר בנקודה אחת בלבד, והנקודה הזאת היא הענבר.
 */
export const MARK_MINOR_TICKS = [5, 11, 17] as const;

/**
 * מיקום המחוג: 12.5% מהקצה הזול.
 *
 * לא על קו ראשי — מחוג של מכשיר אמיתי כמעט אף פעם לא נוחת בדיוק על
 * גרדואציה, ומחוג שכן נוחת נראה כמו איור של סקאלה במקום כמו קריאה.
 * ולא בקצה עצמו (26), כי מחוג צמוד לקיר נקרא כמכשיר תקוע. גם
 * `PriceMeter` עצמו מהדק ל-1%–99% מאותה סיבה.
 */
export const MARK_NEEDLE_X = 23;

/** גובה הקווים. יחס המשנה לראשית זהה ליחס שב-`.price-scale`. */
const MAJOR_TOP = 7;
const MINOR_TOP = 12;

/** ראש המחוג — מעוין, בדיוק כמו `.price-scale-needle::after`. */
const NEEDLE_TOP = 3;
const NEEDLE_HEAD = 3.4;

/** גובה ראש המחוג באלכסון — כמה הוא באמת מטפס מעל `NEEDLE_TOP`. */
export const MARK_NEEDLE_HEAD_REACH = (NEEDLE_HEAD * Math.SQRT2) / 2;

export type MarkDensity = "full" | "compact";

export type MarkGeometry = {
  ticks: { x: number; y1: number; y2: number; major: boolean }[];
  needle: { x: number; y1: number; y2: number };
  head: { x: number; y: number; size: number };
  baseline: number;
};

/**
 * הגאומטריה בצפיפות מבוקשת.
 *
 * `compact` — רק הקווים הראשיים, בלי קווי המשנה.
 *
 * הסימן במלואו הוא תשעה אלמנטים ברוחב 28 יחידות, כלומר רווח של 3
 * יחידות בין קו לקו. בלוגו של הכותרת (24 פיקסלים) ובפאביקון זה
 * פחות משלושה פיקסלים, והאנטי-אליאסינג ממרח את השורה לכתם אפור.
 *
 * ההסרה היא של קווי המשנה בלבד — הרווח האפור עולה ל-6 יחידות
 * והשורה נשארת חדה. **המחוג לא זז.** הוא נשאר ב-23, גם כשאין קו סקאלה
 * שתופסת את מקומו, כי המיקום שלו הוא כל המשמעות ולא הצפיפות סביבו.
 *
 * המחוג עצמו לא נפגע מהצפיפות: הוא נבדל מהקווים בצבע ולא ברווח,
 * וענבר על גרפיט לא מתמזג גם כשהוא צמוד. שלושה קווים חופשיים נקראים נכון.
 */
export function markGeometry(density: MarkDensity = "full"): MarkGeometry {
  const ticks =
    density === "full"
      ? [
          ...MARK_MAJOR_TICKS.map((x) => ({ x, y1: MAJOR_TOP, y2: BASELINE, major: true })),
          ...MARK_MINOR_TICKS.map((x) => ({ x, y1: MINOR_TOP, y2: BASELINE, major: false })),
        ]
      : MARK_MAJOR_TICKS.map((x) => ({ x, y1: MAJOR_TOP, y2: BASELINE, major: true }));

  return {
    ticks: ticks.sort((a, b) => a.x - b.x),
    needle: { x: MARK_NEEDLE_X, y1: NEEDLE_TOP, y2: BASELINE },
    head: { x: MARK_NEEDLE_X, y: NEEDLE_TOP, size: NEEDLE_HEAD },
    baseline: BASELINE,
  };
}

/** צבעי הסימן. שווים בערכם לטוקנים `--scale-plate/--scale-hair/--needle`. */
export const MARK_COLORS = {
  plate: "#17191c",
  hair: "#3c4148",
  needle: "#ffae00",
} as const;

/**
 * הסימן כמחרוזת SVG — לשימוש מחוץ ל-React (יצירת אייקונים, OG).
 *
 * הרכיב ב-React אינו משתמש במחרוזת הזאת אלא מצייר מאותה גאומטריה,
 * כדי שהצבעים שם יישארו טוקנים חיים ולא ערכים קפואים: הלוחית משתנה
 * בין החוגה הבהירה לכהה, וקובץ עם צבע קשיח היה נשבר במעבר.
 */
export function markSvg({
  size = 512,
  density = "full",
  /** שוליים כאחוז מהצלע — נדרש לאייקון maskable (אזור בטוח 80%). */
  padding = 0,
  plate = MARK_COLORS.plate,
}: {
  size?: number;
  density?: MarkDensity;
  padding?: number;
  plate?: string;
} = {}): string {
  const g = markGeometry(density);
  /*
   * קווי סקאלה הם שערות ולא עמודות. במשקל שבו הקו רחב כמו חצי מהרווח שלידו
   * הסימן מפסיק להיראות כמו סקאלה ומתחיל להיראות כמו תרשים עמודות —
   * וזה בדיוק המקום שאליו נופלים רוב הסימנים בקטגוריה.
   */
  const stroke = density === "compact" ? 1.1 : 0.9;
  const needleStroke = density === "compact" ? 1.6 : 1.3;

  /*
   * הציור נשאר ביחס 28×20 גם כשהקנבס ריבועי: הסימן ממורכז אנכית
   * ולא נמתח. סימן מתוח הוא סימן אחר.
   */
  const inner = 1 - padding * 2;
  const drawW = size * inner;
  const drawH = (drawW * MARK_VIEWBOX.height) / MARK_VIEWBOX.width;
  const offsetX = (size - drawW) / 2;
  const offsetY = (size - drawH) / 2;
  const scale = drawW / MARK_VIEWBOX.width;

  const lines = g.ticks
    .map(
      (t) =>
        `<line x1="${t.x}" x2="${t.x}" y1="${t.y1}" y2="${t.y2}" stroke="${MARK_COLORS.hair}" stroke-width="${stroke}" stroke-linecap="butt"/>`,
    )
    .join("");

  const half = g.head.size / 2;
  const head = `<rect x="${g.head.x - half}" y="${g.head.y - half}" width="${g.head.size}" height="${g.head.size}" fill="${MARK_COLORS.needle}" transform="rotate(45 ${g.head.x} ${g.head.y})"/>`;

  const needle = `<line x1="${g.needle.x}" x2="${g.needle.x}" y1="${g.needle.y1}" y2="${g.needle.y2}" stroke="${MARK_COLORS.needle}" stroke-width="${needleStroke}" stroke-linecap="butt"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${plate}"/>`,
    `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">`,
    lines,
    needle,
    head,
    `</g></svg>`,
  ].join("");
}
