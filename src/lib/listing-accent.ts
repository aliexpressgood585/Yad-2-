/**
 * צבע ההדגשה של מודעה — נגזר מהתמונה שלה.
 *
 * מקור הצבע הוא ה-blurhash שכבר שמור על כל תמונה, ולכן אין כאן קריאת
 * רשת, אין קנבס ואין עיבוד תמונה: ארבעת התווים הראשונים אחרי הכותרת
 * מקודדים את הצבע הממוצע של התמונה (רכיב ה-DC), וזה בדיוק מה שצריך.
 *
 * **הצבע נוגע בשני מקומות בלבד** — מסגרת שורת המודעה וההילה שמתחתיה.
 * כל השאר נשאר בפלטה של המכשיר. מודעה מרגישה משלה, והאתר לא משנה
 * זהות בין דף לדף.
 *
 * שני שומרים, ושניהם חובה:
 *
 *   **רצפת רוויה** — תמונה עכורה מחזירה חום-אפור, וחום-אפור על שלדה
 *   גרפיטית נראה כמו לכלוך ולא כמו סימון. מתחת ל-`GREY_CUTOFF` אין צבע
 *   בכלל; מעליו הרוויה מורמת אל תוך הטווח.
 *
 *   **בדיקת ניגודיות מול הרקע** — הבהירות מותאמת עד שהצבע עובר יחס
 *   `MIN_CONTRAST` מול הקרקע. הסף הוא 3.0 — הסף של WCAG לרכיב ממשק
 *   שאינו טקסט, וזה בדיוק מה שהמסגרת הזו. בלי הבדיקה גוון כחול כהה
 *   היה נעלם על גרפיט וגוון צהוב היה נעלם על עצם, ושניהם היו נראים
 *   כמו באג רנדום ולא ככלל.
 *
 * הבהירות מחושבת פעמיים, פעם לכל קרקע, כי אותה בהירות לא יכולה לעבור
 * גם מול גרפיט וגם מול עצם — ולוח שמחשב את זה פעם אחת היה מציג צבע
 * תקין בפנים אחת ובלתי-נראה בשנייה.
 */

const DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function decode83(value: string): number {
  let result = 0;
  for (const char of value) {
    const index = DIGITS.indexOf(char);
    if (index === -1) return Number.NaN;
    result = result * 83 + index;
  }
  return result;
}

/** ערוץ ליניארי (כפי ש-blurhash שומר) → sRGB בטווח 0–1. */
function linearToSrgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export type Hsl = { h: number; s: number; l: number };

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h, s, l };
}

/** HSL בטווח 0–1 → sRGB בטווח 0–1. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** בהירות יחסית לפי WCAG 2.1, מערך sRGB בטווח 0–1. */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** יחס ניגודיות בין שתי בהירויות יחסיות. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * גבולות הריסון.
 *
 * הרוויה גבוהה יותר מהסבב הקודם (14%–42%) כי הצבע כבר לא יושב בהילה
 * מטושטשת מאחורי גלריה אלא על קו מסגרת ברוחב פיקסל אחד. קו דק ברוויה
 * של 14% פשוט נקרא כאפור.
 */
const GREY_CUTOFF = 0.08;
const MIN_SATURATION = 0.22;
const MAX_SATURATION = 0.55;

/** הסף של WCAG לרכיב ממשק שאינו טקסט. המסגרת היא בדיוק זה. */
export const MIN_CONTRAST = 3;

/** בהירות הקרקעות שמולן נבדק הצבע — גרפיט #16181B ועצם #E6E2D6. */
export const GROUND_LUMINANCE = {
  instrument: relativeLuminance(0x16 / 255, 0x18 / 255, 0x1b / 255),
  day: relativeLuminance(0xe6 / 255, 0xe2 / 255, 0xd6 / 255),
} as const;

/**
 * הבהירות הנמוכה ביותר (על קרקע כהה) או הגבוהה ביותר (על קרקע בהירה)
 * שעדיין עוברת את סף הניגודיות, בגוון וברוויה נתונים.
 *
 * חיפוש ליניארי בצעדי אחוז ולא נוסחה סגורה: יחס הניגודיות אינו מונוטוני
 * בצורה נוחה לאורך HSL (הרוויה משנה את הבהירות היחסית), וטבלה של 100
 * צעדים נפתרת בשבריר מיקרו-שנייה ומחושבת ממילא פעם אחת לכל מודעה.
 */
function fitLightness(h: number, s: number, l: number, ground: number): number | null {
  const contrastAt = (candidate: number) => {
    const [r, g, b] = hslToRgb(h, s, candidate);
    return contrastRatio(relativeLuminance(r, g, b), ground);
  };

  if (contrastAt(l) >= MIN_CONTRAST) return l;

  // קרקע כהה → מבהירים; קרקע בהירה → מכהים. בכל מקרה מתרחקים ממנה.
  const step = ground < 0.18 ? 0.01 : -0.01;
  for (let i = 1; i <= 100; i++) {
    const candidate = l + step * i;
    if (candidate <= 0.06 || candidate >= 0.96) break;
    if (contrastAt(candidate) >= MIN_CONTRAST) return candidate;
  }
  return null;
}

export type ListingAccent = {
  /** ערך HSL מוכן ל-CSS על קרקע הגרפיט */
  instrument: string;
  /** ערך HSL מוכן ל-CSS על קרקע העצם */
  day: string;
};

/**
 * צבע ההדגשה מתוך blurhash, או `null` כשאין ממה לגזור.
 *
 * מוחזרות מחרוזות HSL (ולא אובייקט צבע) כי היעד הוא משתנה CSS אחד לכל
 * פנים, שממנו נגזרות גם השקיפויות — בדיוק כמו שאר הטוקנים.
 */
export function accentFromBlurhash(hash: string | null | undefined): ListingAccent | null {
  if (!hash || hash.length < 6) return null;

  const dc = decode83(hash.slice(2, 6));
  if (!Number.isFinite(dc)) return null;

  const r = linearToSrgb(((dc >> 16) & 255) / 255);
  const g = linearToSrgb(((dc >> 8) & 255) / 255);
  const b = linearToSrgb((dc & 255) / 255);

  const { h, s, l } = rgbToHsl(r, g, b);

  // תמונה אפורה לגמרי לא מקבלת רוויה מלאכותית — פשוט אין לה צבע
  if (s < GREY_CUTOFF) return null;

  const fittedS = Math.min(MAX_SATURATION, Math.max(MIN_SATURATION, s));

  /*
   * הבהירות נכפית לרצועה לפני בדיקת הניגודיות, ולא רק אחריה.
   *
   * הצבע הממוצע של תמונה נוטה להיות בהיר מאוד (רוב תמונת מוצר היא רקע
   * בהיר), ובהירות של 93% עוברת ניגודיות מול גרפיט בקלות — אבל היא
   * כמעט לבן, וכל המודעות היו מקבלות מסגרת באותו לובן חיוור שנבדל רק
   * בגוון שאי אפשר לראות. הרצועה שומרת שהמסגרת תיקרא כצבע.
   *
   * המיקום בתוך הרצועה עדיין נגזר מהתמונה: תמונה כהה מקבלת את הקצה
   * הנמוך שלה ותמונה בהירה את הגבוה.
   */
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const instrument = fitLightness(
    h,
    fittedS,
    clamp(l, 0.45, 0.68),
    GROUND_LUMINANCE.instrument,
  );
  const day = fitLightness(h, fittedS, clamp(l, 0.26, 0.46), GROUND_LUMINANCE.day);
  if (instrument === null || day === null) return null;

  const hue = Math.round(h * 360);
  const sat = Math.round(fittedS * 100);

  return {
    instrument: `${hue} ${sat}% ${Math.round(instrument * 100)}%`,
    day: `${hue} ${sat}% ${Math.round(day * 100)}%`,
  };
}

/**
 * משתני ה-CSS של צבע המודעה, מוכנים ל-`style` של האלמנט.
 *
 * שני משתנים ולא אחד: `globals.css` בוחר ביניהם לפי הפנים הפעילה,
 * כי אותה בהירות אינה יכולה לעבור ניגודיות מול שתי הקרקעות.
 */
export function accentStyle(
  hash: string | null | undefined,
): Record<string, string> | undefined {
  const accent = accentFromBlurhash(hash);
  if (!accent) return undefined;
  return {
    "--accent-instrument": accent.instrument,
    "--accent-day": accent.day,
  };
}
