/**
 * טריות מודעה — "עדיין רלוונטי?"
 *
 * ## הבעיה
 *
 * ההודעה הנפוצה ביותר בכל לוח מודעות ישראלי היא "עדיין רלוונטי?".
 * היא נשלחת אלפי פעמים ביום, היא לא מקדמת אף עסקה, והיא נשלחת דווקא
 * מפני שאין דרך אחרת לדעת. מוכר שמכר לפני שבועיים לא טורח למחוק, וכל
 * קונה הבא משלם על זה בהודעה ובהמתנה.
 *
 * ## הפתרון
 *
 * המוכר מאשר בלחיצה אחת, והמודעה נושאת חותמת טריות גלויה. קונה שרואה
 * "אושר היום" לא שואל, וקונה שרואה "לא אושר 40 יום" יודע לְמה הוא
 * נכנס לפני שהוא כותב.
 *
 * ## למה זה חלק מכיוון "מכשיר"
 *
 * זו עוד קריאה ולא עוד תג. הטריות היא נתון על המודעה בדיוק כמו המחיר
 * או הקילומטראז', והיא נמדדת ולא מוצהרת: `availabilityAt` נכתב רק
 * כשהמוכר לוחץ, ולא כשהוא עורך מחיר. **עריכה אינה אישור.**
 *
 * הקובץ טהור ואינו נוגע במסד — כדי שיהיו לו בדיקות.
 */

/** מעבר לזה מודעה נחשבת לא מאומתת, והתג הופך לאזהרה. */
export const STALE_DAYS = 30;

/** מתחת לזה לא מציגים "אושר" בכלל — מודעה חדשה טרייה מעצם היותה. */
export const FRESH_ENOUGH_DAYS = 3;

/**
 * כל כמה זמן מותר לבקש אישור מאותו מוכר על אותה מודעה.
 *
 * בלי הגבלה, מודעה פופולרית מייצרת עשרות בקשות ביום ומוכר אחד מקבל
 * הצפה — כלומר בדיוק הבעיה שהפיצ'ר בא לפתור, רק בכיוון ההפוך.
 */
export const ASK_COOLDOWN_HOURS = 20;

export type Freshness =
  | { kind: "new" }
  | { kind: "confirmed"; days: number }
  | { kind: "stale"; days: number };

/**
 * מצב הטריות של מודעה.
 *
 * `publishedAt` משמש כברירת מחדל כשאין אישור: מודעה שפורסמה אתמול לא
 * צריכה אישור, ומודעה בת חודשיים שמעולם לא אושרה היא בדיוק המקרה
 * שהקונה צריך לראות.
 */
export function freshnessOf(input: {
  availabilityAt?: Date | null;
  publishedAt?: Date | null;
  now?: Date;
}): Freshness {
  const now = input.now ?? new Date();
  const reference = input.availabilityAt ?? input.publishedAt ?? null;

  if (!reference) return { kind: "new" };

  const days = Math.floor((now.getTime() - reference.getTime()) / 86_400_000);

  if (days < 0) return { kind: "new" };
  if (days >= STALE_DAYS) return { kind: "stale", days };
  if (!input.availabilityAt && days < FRESH_ENOUGH_DAYS) return { kind: "new" };

  return { kind: "confirmed", days };
}

/** תיאור קצר בעברית, לתג על המודעה. */
export function freshnessLabel(state: Freshness): string {
  switch (state.kind) {
    case "new":
      return "מודעה חדשה";
    case "confirmed":
      if (state.days === 0) return "אושר היום";
      if (state.days === 1) return "אושר אתמול";
      return `אושר לפני ${state.days} ימים`;
    case "stale":
      return `לא אושר ${state.days} ימים`;
  }
}

/**
 * האם מותר לבקש אישור עכשיו.
 *
 * מוחזר גם כמה זמן נשאר, כדי שהממשק יוכל לומר למה הכפתור כבוי במקום
 * להשאיר אותו כבוי בלי הסבר.
 */
export function canAsk(lastAskedAt: Date | null | undefined, now = new Date()):
  | { allowed: true }
  | { allowed: false; hoursLeft: number } {
  if (!lastAskedAt) return { allowed: true };

  const elapsedHours = (now.getTime() - lastAskedAt.getTime()) / 3_600_000;
  if (elapsedHours >= ASK_COOLDOWN_HOURS) return { allowed: true };

  return { allowed: false, hoursLeft: Math.ceil(ASK_COOLDOWN_HOURS - elapsedHours) };
}

/**
 * האם המוכר צריך תזכורת יזומה.
 *
 * `true` רק כשהמודעה פעילה ולא אושרה מעל הסף. ההבדל מ-"מודעה שעומדת
 * לפוג" הוא שכאן אין תאריך תפוגה מתקרב — המודעה תקפה עוד שבועות,
 * והבעיה היא שאיש לא יודע אם היא אמיתית.
 */
export function needsNudge(input: {
  availabilityAt?: Date | null;
  publishedAt?: Date | null;
  now?: Date;
}): boolean {
  return freshnessOf(input).kind === "stale";
}
