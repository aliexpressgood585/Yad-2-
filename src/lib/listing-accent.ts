/**
 * צבע ההדגשה של מודעה — נגזר מהתמונה שלה.
 *
 * מקור הצבע הוא ה-blurhash שכבר שמור על כל תמונה, ולכן אין כאן קריאת
 * רשת, אין קנבס ואין עיבוד תמונה: ארבעת התווים הראשונים אחרי הכותרת
 * מקודדים את הצבע הממוצע של התמונה (רכיב ה-DC), וזה בדיוק מה שצריך.
 *
 * **הצבע נוגע בשני מקומות בדף המודעה בלבד** — הילה מאחורי הגלריה וקו
 * ההדגשה מתחת למחיר. כל השאר נשאר בפלטה. מודעה מרגישה משלה, והאתר
 * לא משנה זהות בין דף לדף.
 *
 * הריסון הוא העיקר כאן. תמונה של רכב אדום מחזירה אדום זועק, ותמונה
 * חשוכה מחזירה כמעט שחור — שניהם היו הופכים את הדף לרועש או למלוכלך.
 * לכן הרוויה והבהירות נכפות לטווח צר: מספיק כדי שיהיה הבדל בין מודעה
 * למודעה, לא מספיק כדי להתחרות בירוק השילוט שהוא צבע הפעולה היחיד.
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

/** גבולות הריסון. מחוץ להם צבע התמונה מפסיק להיות רמז והופך לרעש. */
const MIN_SATURATION = 0.14;
const MAX_SATURATION = 0.42;
const MIN_LIGHTNESS = 0.34;
const MAX_LIGHTNESS = 0.56;

/**
 * צבע ההדגשה מתוך blurhash, כמחרוזת ערכי HSL לשימוש ב-CSS
 * (`hsl(var(--listing-accent))`), או `null` כשאין ממה לגזור.
 *
 * מוחזרת מחרוזת ולא אובייקט כי היעד הוא משתנה CSS אחד שממנו נגזרות גם
 * השקיפויות — בדיוק כמו שאר הטוקנים ב-`globals.css`.
 */
export function accentFromBlurhash(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null;

  const dc = decode83(hash.slice(2, 6));
  if (!Number.isFinite(dc)) return null;

  const r = linearToSrgb(((dc >> 16) & 255) / 255);
  const g = linearToSrgb(((dc >> 8) & 255) / 255);
  const b = linearToSrgb((dc & 255) / 255);

  const { h, s, l } = rgbToHsl(r, g, b);

  // תמונה אפורה לגמרי לא מקבלת רוויה מלאכותית — היא פשוט אין לה צבע
  if (s < 0.04) return null;

  const clampedS = Math.min(MAX_SATURATION, Math.max(MIN_SATURATION, s));
  const clampedL = Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, l));

  return `${Math.round(h * 360)} ${Math.round(clampedS * 100)}% ${Math.round(clampedL * 100)}%`;
}
