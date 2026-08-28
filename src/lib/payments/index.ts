import { manualProvider } from "@/lib/payments/providers/manual";
import { noneProvider } from "@/lib/payments/providers/none";
import type { PaymentProvider } from "@/lib/payments/types";

export type { CheckoutRequest, CheckoutSession, PaymentProvider, VerificationResult } from "@/lib/payments/types";

/**
 * מרשם ספקי הסליקה.
 *
 * ## מה מוגדר כאן, ומה במפורש לא
 *
 * שני ספקים:
 *
 *   `none`   — ברירת המחדל. זורק שגיאה ברורה ואינו מאשר דבר.
 *   `manual` — העברה בנקאית, שמאושרת ידנית במסך הניהול.
 *
 * **אין כאן ספק כרטיסי אשראי.** לא בגלל שהזרימה חסרה — כל מה שסביב
 * בנוי ועובד: הזמנות, מע"מ, חשבוניות, מנויים, מכסות, החזרים ומסך
 * ניהול — אלא בגלל שאין מפתחות סליקה. מתאם שנכתב מול תיעוד ולא נבדק
 * ולו פעם אחת מול השרת של הספק הוא קוד שנראה עובד ואיש אינו יודע אם
 * שם השדה נכון, אם החתימה מחושבת נכון, ואם `verifyCallback` באמת
 * מאמת משהו. בתשלומים זה לא "יתגלה בבדיקה הבאה" אלא בהנהלת חשבונות.
 *
 * הוספת ספק כרטיסי אשראי היא קובץ אחד שמממש את `PaymentProvider`
 * ושורה אחת כאן. שום דבר אחר במערכת אינו משתנה — לא המודל, לא ה-UI,
 * ולא נתיב ההזמנות. ראה GROWTH.md סעיף F.
 */
const PROVIDERS: Record<string, PaymentProvider> = {
  none: noneProvider,
  manual: manualProvider,
};

/**
 * הספק הפעיל.
 *
 * ספק שהוגדר בסביבה אך חסרה לו תצורה **נופל חזרה ל-`none`** ואינו
 * נשאר פעיל-למחצה: מצב שבו `PAYMENT_PROVIDER=manual` בלי פרטי חשבון
 * היה מציג למשתמש מסך תשלום ריק.
 */
export function paymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER?.trim() || "none";
  const provider = PROVIDERS[id];
  if (!provider) {
    console.error(`[payments] ספק לא מוכר: ${id}`);
    return noneProvider;
  }
  return provider.isConfigured ? provider : noneProvider;
}

/** האם אפשר לגבות כרגע. המסכים משתמשים בזה כדי לא להציע מה שאין. */
export function paymentsEnabled(): boolean {
  return paymentProvider().isConfigured;
}
