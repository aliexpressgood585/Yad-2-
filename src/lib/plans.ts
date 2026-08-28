/**
 * תמחור — מנויי סוחרים, מע"מ, וסכומים באגורות.
 *
 * ## למה אגורות ולא שקלים
 *
 * כסף בנקודה צפה הוא באג שמתגלה בחשבונית. `0.1 + 0.2` אינו `0.3`,
 * וסכום מע"מ שמחושב מ-float יוצא אגורה מהחשבון פעם באלף — כלומר
 * במסמך שיש לו תוקף משפטי. כל סכום במערכת הוא מספר שלם של אגורות,
 * וההמרה לתצוגה קורית במקום אחד.
 */

/**
 * שיעור המע"מ בישראל.
 *
 * נשמר על כל הזמנה בנפרד (`Order.vatRate`) ולא נקרא מכאן בזמן הצגת
 * חשבונית: כששיעור המע"מ משתנה, חשבוניות שכבר הונפקו אינן משתנות
 * איתו. הערך כאן הוא מה שיחול על הזמנה **חדשה**.
 */
export const VAT_RATE = 0.18;

/** מחירי הלוח מוצגים לצרכן כולל מע"מ, כמקובל בישראל. */
export function vatFromGross(grossAgorot: number, rate = VAT_RATE): number {
  return Math.round(grossAgorot - grossAgorot / (1 + rate));
}

export function shekelsToAgorot(shekels: number): number {
  return Math.round(shekels * 100);
}

export function agorotToShekels(agorot: number): number {
  return agorot / 100;
}

export type DealerPlan = {
  id: string;
  name: string;
  description: string;
  /** מחיר חודשי בשקלים, כולל מע"מ */
  priceIls: number;
  /** מכסת מודעות פעילות לחנות. `null` = ללא הגבלה. */
  listingQuota: number | null;
  features: string[];
};

/**
 * שלוש חבילות ולא שש.
 *
 * המכסה היא ההבדל היחיד שנמדד, וכל שאר ההבדלים נגזרים ממנה. חבילה
 * רביעית באמצע היא שאלה שכל סוחר צריך לענות עליה בלי שיש לו מידע
 * להחליט — והתוצאה היא שהוא לא בוחר כלום.
 *
 * המכסה חלה על **החנות** ולא על האדם: היא סופרת את כל המלאי של העסק,
 * כולל מודעות שסוכנים פרסמו בשמו.
 */
export const DEALER_PLANS: DealerPlan[] = [
  {
    id: "starter",
    name: "בסיסי",
    description: "לעסק קטן שמנהל מלאי קבוע",
    priceIls: 149,
    listingQuota: 25,
    features: [
      "עד 25 מודעות פעילות",
      "עמוד עסק ציבורי",
      "דשבורד ביצועי מלאי",
      "העלאה מרוכזת מקובץ",
    ],
  },
  {
    id: "pro",
    name: "מקצועי",
    description: "לסוכנות עם מלאי מתחלף וצוות",
    priceIls: 399,
    listingQuota: 120,
    features: [
      "עד 120 מודעות פעילות",
      "ייבוא פיד אוטומטי יומי",
      "ניהול צוות עם הרשאות",
      "כל מה שבחבילה הבסיסית",
    ],
  },
  {
    id: "unlimited",
    name: "ללא הגבלה",
    description: "למלאי גדול שאין לו תקרה",
    priceIls: 899,
    listingQuota: null,
    features: [
      "מודעות פעילות ללא הגבלה",
      "כמה פידים במקביל",
      "כל מה שבחבילה המקצועית",
    ],
  },
];

export function planById(id: string): DealerPlan | undefined {
  return DEALER_PLANS.find((p) => p.id === id);
}

/**
 * המכסה של חנות ללא מנוי.
 *
 * לא אפס: עסק שנרשם צריך להצליח לפרסם ולראות שהלוח עובד לפני שהוא
 * משלם. מכסה חינמית שאין בה מספיק מקום כדי להתרשם היא חסם רכישה,
 * לא מנוף.
 */
export const FREE_BUSINESS_QUOTA = 5;

/** אורך תקופת מנוי בימים. */
export const SUBSCRIPTION_PERIOD_DAYS = 30;
