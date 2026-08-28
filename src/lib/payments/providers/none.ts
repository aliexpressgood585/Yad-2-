import { ApiError } from "@/lib/api";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * ברירת המחדל: אין סליקה.
 *
 * הספק הזה קיים כדי שהמערכת תיכשל **בקול** ולא בשקט. בלעדיו הדרך
 * הקלה הייתה להחזיר "שולם" כשאין תצורה, ואז קידום מופעל, מנוי נפתח
 * וחשבונית מונפקת על כסף שלא התקבל — וזה מתגלה בהנהלת חשבונות ולא
 * בקוד.
 *
 * ההודעה מנוסחת למשתמש ולא למפתח, כי היא מגיעה למסך: אדם שלוחץ
 * "קידום מודעה" צריך להבין שהאתר אינו יכול לגבות ממנו עכשיו, לא
 * לראות "provider not configured".
 */
export const noneProvider: PaymentProvider = {
  id: "none",
  label: "אין סליקה",
  isConfigured: false,

  async createCheckout() {
    throw new ApiError(
      503,
      "התשלום אינו זמין כרגע. נסו שוב מאוחר יותר או פנו אלינו.",
      "PAYMENTS_UNAVAILABLE",
    );
  },

  async verifyCallback() {
    throw new ApiError(503, "אין ספק סליקה מוגדר", "PAYMENTS_UNAVAILABLE");
  },
};
