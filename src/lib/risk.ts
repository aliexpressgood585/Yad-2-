/**
 * ציון הסיכון של מודעה.
 *
 * המשקלים כתובים כאן במקום אחד ולא מפוזרים כמספרים בתוך היוריסטיקות,
 * משתי סיבות: אפשר לכייל אותם בלי לגעת בלוגיקת הזיהוי, ואפשר להסביר
 * למנהל מדוע מודעה קיבלה ציון מסוים.
 *
 * המערכת **לא חוסמת אוטומטית**. ציון גבוה שולח לתור מודרציה ומציג
 * אזהרה עניינית לגולש. חסימה אוטומטית על סמך יוריסטיקה פוגעת במוכרים
 * לגיטימיים — מוכר שמוכר בזול כי הוא עובר דירה נראה בדיוק כמו נוכל.
 */

/** משקל כל אות סיכון בציון הסופי (0–100). */
export const RISK_WEIGHTS = {
  /** ניסוחים שמאפיינים הונאת תשלום־מראש */
  SUSPICIOUS_TEXT: 30,
  /** מחיר חורג כלפי מטה מעל 3 סטיות תקן מהחציון בקטגוריה */
  PRICE_OUTLIER: 35,
  /** אותן תמונות מופיעות במודעה אחרת (perceptual hash) */
  DUPLICATE_IMAGES: 25,
  /** תוכן זהה למודעה קיימת */
  DUPLICATE_CONTENT: 10,
  /** חשבון חדש מאוד עם ריבוי מודעות */
  NEW_ACCOUNT_BURST: 20,
  /**
   * הטלפון או המוכר הופיעו בדיווחים שמנהל אישר.
   *
   * המשקל הגבוה במערכת, וגבוה מ-RISK_WARN_AT בכוונה: זה האות היחיד
   * שמקורו בבן אדם שכבר נתקל בפריט, ולא ביוריסטיקה. הוא לבדו מצדיק
   * אזהרה פומבית.
   */
  PRIOR_REPORTS: 55,
  /** מוכר לא מאומת */
  UNVERIFIED_SELLER: 10,
} as const;

export type RiskCode = keyof typeof RISK_WEIGHTS;

/**
 * ספי הפעולה.
 *
 * REVIEW  — נכנס לתור המודרציה
 * WARN    — מוצג באנר אזהרה לגולש
 *
 * WARN גבוה מ-REVIEW בכוונה: מודעה נבדקת הרבה לפני שמזהירים עליה
 * פומבית, כי אזהרה שגויה פוגעת במוכר תמים.
 */
export const RISK_REVIEW_AT = 30;
export const RISK_WARN_AT = 50;

export type RiskLevel = "clear" | "review" | "warn";

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_WARN_AT) return "warn";
  if (score >= RISK_REVIEW_AT) return "review";
  return "clear";
}

/**
 * מחשב ציון מתוך קודי האותות שנמצאו.
 *
 * הציון אינו סכום פשוט: שני אותות חלשים אינם מעידים כמו אות חזק אחד,
 * ולכן כל אות אחרי הראשון נכנס בתשומה פוחתת. בלי זה מודעה תמימה עם
 * שלושה אותות של 10 נקודות הייתה חוצה את סף המודרציה.
 */
export function computeRiskScore(codes: RiskCode[]): number {
  const weights = [...new Set(codes)]
    .map((c) => RISK_WEIGHTS[c])
    .sort((a, b) => b - a);

  let score = 0;
  for (const [i, w] of weights.entries()) {
    score += w * (i === 0 ? 1 : 0.6 ** i);
  }
  return Math.min(100, Math.round(score));
}

/** הסבר קריא לציון, לתצוגה בפאנל הניהול. */
export function explainRisk(codes: RiskCode[]): string {
  const labels: Record<RiskCode, string> = {
    SUSPICIOUS_TEXT: "ניסוחי הונאה",
    PRICE_OUTLIER: "מחיר חריג",
    DUPLICATE_IMAGES: "תמונות משוכפלות",
    DUPLICATE_CONTENT: "תוכן משוכפל",
    NEW_ACCOUNT_BURST: "חשבון חדש עם ריבוי מודעות",
    PRIOR_REPORTS: "דיווחים קודמים",
    UNVERIFIED_SELLER: "מוכר לא מאומת",
  };
  return [...new Set(codes)].map((c) => labels[c]).join(" · ");
}
