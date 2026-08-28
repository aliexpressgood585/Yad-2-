import { ApiError } from "@/lib/api";
import { agorotToShekels } from "@/lib/plans";
import { formatPrice } from "@/lib/format";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * העברה בנקאית — תשלום שמאושר ידנית.
 *
 * זה אינו "מוק של סליקה" אלא מסלול תשלום אמיתי שלוחות ישראליים
 * משתמשים בו בפועל למנויי סוחרים: הסוחר מקבל פרטי חשבון ומספר הזמנה,
 * מעביר, ומנהל מסמן את ההזמנה כשולמה אחרי שראה את הכסף בבנק.
 *
 * ההבדל מזיוף תשלום הוא בדיוק אחד ומכריע: **אף הזמנה אינה הופכת
 * ל"שולם" מעצמה.** `createCheckout` מחזיר הוראות ומשאיר את ההזמנה
 * `PENDING`, והמעבר ל-`PAID` דורש פעולה של אדם במסך הניהול, שנרשמת
 * ב-`AuditLog` עם מי אישר ומתי.
 *
 * המסלול נדלק רק כשהוגדרו פרטי חשבון: `PAYMENT_PROVIDER=manual`
 * יחד עם `PAYMENT_BANK_DETAILS`. בלעדיהם אין מה להציג למשתמש, ולכן
 * הספק אינו נחשב מוגדר.
 */

const details = process.env.PAYMENT_BANK_DETAILS?.trim() ?? "";

export const manualProvider: PaymentProvider = {
  id: "manual",
  label: "העברה בנקאית",
  isConfigured: details.length > 0,

  async createCheckout({ order }) {
    if (!details) {
      throw new ApiError(
        503,
        "התשלום אינו זמין כרגע. נסו שוב מאוחר יותר או פנו אלינו.",
        "PAYMENTS_UNAVAILABLE",
      );
    }

    return {
      mode: "instructions",
      title: `הזמנה מספר ${order.number} — ${formatPrice(agorotToShekels(order.amountAgorot))}`,
      body: [
        details,
        "",
        `נא לציין בהעברה את מספר ההזמנה: ${order.number}`,
        "ההזמנה תופעל אחרי שההעברה תיקלט, בדרך כלל תוך יום עסקים.",
      ].join("\n"),
      providerRef: null,
    };
  },

  /**
   * אין callback להעברה בנקאית — הבנק אינו מודיע לנו דבר.
   *
   * זו אינה חוסר אלא ההגדרה של המסלול: האישור מגיע מאדם שראה את הכסף,
   * דרך `/api/admin/orders`. נתיב callback שהיה מאשר כאן בלי אימות
   * הוא בדיוק ההיפך מהמטרה.
   */
  async verifyCallback() {
    throw new ApiError(
      400,
      "מסלול ההעברה הבנקאית אינו מקבל אישורים אוטומטיים",
      "NO_CALLBACK",
    );
  },
};
