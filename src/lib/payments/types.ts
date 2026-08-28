import type { Order } from "@prisma/client";

/**
 * הממשק אל ספק הסליקה.
 *
 * זו הנקודה היחידה במערכת שנוגעת בכסף אמיתי, וזו הסיבה שהיא ממשק
 * ולמה יש בו בדיוק שתי פונקציות: יצירת תשלום ואימות התוצאה. כל שאר
 * המערכת — הזמנות, חשבוניות, מנויים, מכסות, מסך הניהול — אינה יודעת
 * מי הספק ולא משתנה כשמחליפים אותו.
 *
 * **מה שאסור לספק לעשות: להצליח בלי לגבות.** ספק שאינו מוגדר חייב
 * לזרוק שגיאה ברורה, ולא להחזיר "שולם". תשלום מזויף שנראה כאילו הוא
 * עובד הוא הדבר הגרוע ביותר שאפשר לכתוב כאן — הוא נותן קידום, פותח
 * מנוי, ומנפיק חשבונית על כסף שלא התקבל.
 */

/** מה שהמערכת מוסרת לספק כדי לפתוח תשלום. */
export type CheckoutRequest = {
  order: Pick<
    Order,
    "id" | "number" | "amountAgorot" | "vatAgorot" | "currency" | "description"
  >;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  /** לאן להחזיר את המשתמש אחרי תשלום מוצלח */
  returnUrl: string;
  /** לאן להחזיר אותו אם ביטל */
  cancelUrl: string;
  /** לאן הספק שולח את אישור התשלום */
  callbackUrl: string;
};

/**
 * התוצאה של פתיחת תשלום.
 *
 *   `redirect`  — יש לשלוח את המשתמש לכתובת של הספק.
 *   `instructions` — אין דף תשלום; המשתמש מקבל הוראות והתשלום מאושר
 *                    ידנית. זה המסלול של העברה בנקאית.
 */
export type CheckoutSession =
  | { mode: "redirect"; url: string; providerRef: string | null }
  | { mode: "instructions"; title: string; body: string; providerRef: string | null };

/** תוצאת אימות של הודעה שהגיעה מהספק. */
export type VerificationResult = {
  orderId: string;
  paid: boolean;
  providerRef: string | null;
  reason?: string;
};

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /**
   * האם הספק מוכן לגבות. `false` פירושו שחסרה תצורה, והמערכת תסרב
   * ליצור הזמנה במקום לפתוח תשלום שלא ייגמר.
   */
  readonly isConfigured: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * מאמת הודעה שהגיעה מהספק ומחזיר מה קרה להזמנה.
   *
   * חייב לאמת שההודעה באמת מהספק — חתימה, סוד משותף, או קריאה חוזרת
   * אליו. נתיב callback שמאמין לגוף הבקשה הוא כפתור "שלם לי" פתוח
   * לאינטרנט.
   */
  verifyCallback(payload: unknown, headers: Headers): Promise<VerificationResult>;
}
