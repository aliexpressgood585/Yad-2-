/**
 * המותג — מקור אמת יחיד.
 *
 * כל מחרוזת שמזהה את הלוח מגיעה מכאן: כותרות, manifest, תמונות OG,
 * הודעות SMS ומייל, כותרת תחתונה, דפי מדיניות. אין שם מותג כתוב
 * קשיח בשום מקום אחר בקוד.
 *
 * הפרויקט שינה שם שלוש פעמים לפני שהגיע לכאן, וכל שינוי נגע בעשרות
 * קבצים. הקובץ הזה הוא מה שמונע את הפעם הבאה.
 */

/**
 * כתובת הבסיס של האתר.
 *
 * הסדר חשוב: משתנה מפורש גובר תמיד, אבל אם שכחו להגדיר אותו ב-Vercel
 * עדיין מקבלים כתובת נכונה במקום `localhost` — שהיה שולח `og:url`
 * ל-localhost בכל שיתוף בוואטסאפ ובפייסבוק.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` הוא הדומיין היציב של הפרויקט ולא של
 * הפריסה הבודדת, ולכן קישורים ששותפו לא נשברים בפריסה הבאה.
 */
function resolveDomain(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const BRAND = {
  /**
   * כדאי — פסק הדין, לא הכלי.
   *
   * מה שהלוח עושה הוא למדוד: כמה המחיר הזה שווה מול השוק, וכמה זמן
   * ייקח למכור בו. מה שהמשתמש רוצה לדעת בסוף המדידה הוא מילה אחת —
   * כדאי או לא כדאי. השם הוא התשובה ולא התהליך.
   */
  name: "כדאי",
  tagline: "עכשיו אתה יודע",
  description:
    "לוח מודעות ישראלי שמודד — רכב, נדל\"ן, יד שנייה, דרושים ועוד. לכל מודעה סקאלה שמראה איפה המחיר יושב מול השוק, וכמה זמן ייקח למכור.",
  domain: resolveDomain(),
} as const;
