import { createHash, randomBytes } from "node:crypto";

import { BRAND } from "@/lib/brand";

/**
 * סליקה — שכבת הפשטה מעל ספק ישראלי.
 *
 * שני כללים שכל המימוש נשען עליהם:
 *
 * 1. **הלקוח לעולם אינו מאשר תשלום.** הדפדפן חוזר מדף הסליקה עם
 *    פרמטרים שאפשר לזייף בשורת הכתובת. ההפעלה נשענת אך ורק על אימות
 *    שרת-אל-שרת מול הספק (`verify`), עם הסכום והמזהה שאנחנו שמרנו.
 * 2. **הסכום נקבע אצלנו.** מה שמגיע מהלקוח הוא בחירת חבילה בלבד;
 *    המחיר נשלף מהקטלוג בשרת. אחרת אפשר לקנות חשיפה בשקל.
 *
 * הספק הנתמך הוא Tranzila, שהוא נפוץ בישראל ותומך בדף סליקה מתארח
 * (hosted page) — כלומר פרטי האשראי לא עוברים דרך השרת שלנו בכלל,
 * וזה מוריד את כל דרישות PCI מהפרויקט.
 */

export type PaymentProvider = "tranzila" | "none";

export type CheckoutRequest = {
  reference: string;
  amountIls: number;
  description: string;
  successUrl: string;
  failureUrl: string;
  email?: string;
};

export type VerifyResult =
  | { paid: true; externalId: string; amountIls: number; raw: unknown }
  | { paid: false; reason: string; raw?: unknown };

export function paymentProvider(): PaymentProvider {
  const p = process.env.PAYMENT_PROVIDER;
  return p === "tranzila" ? "tranzila" : "none";
}

export function paymentsConfigured(): boolean {
  return paymentProvider() !== "none" && Boolean(process.env.TRANZILA_TERMINAL);
}

/** מזהה הזמנה — אקראי ולא רץ, כדי שלא יהיה אפשר לנחש הזמנות של אחרים. */
export function newReference(): string {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
}

/**
 * כתובת דף הסליקה.
 *
 * Tranzila מקבל את הפרמטרים ב-query string של הדף המתארח. `sum`
 * ו-`currency` הם מה שהלקוח יחויב, ו-`myid` הוא המזהה שלנו שחוזר
 * בקריאה החוזרת ומאפשר לקשור תשלום להזמנה.
 */
export function checkoutUrl(req: CheckoutRequest): string {
  if (paymentProvider() !== "tranzila") {
    throw new Error("PAYMENT_PROVIDER אינו מוגדר");
  }
  const terminal = process.env.TRANZILA_TERMINAL;
  if (!terminal) throw new Error("TRANZILA_TERMINAL חסר");

  const params = new URLSearchParams({
    sum: String(req.amountIls),
    currency: "1", // 1 = שקל
    cred_type: "1",
    myid: req.reference,
    pdesc: req.description,
    lang: "il",
    success_url_address: req.successUrl,
    fail_url_address: req.failureUrl,
    company: BRAND.name,
    ...(req.email ? { email: req.email } : {}),
  });

  return `https://direct.tranzila.com/${terminal}/iframenew.php?${params.toString()}`;
}

/**
 * אימות שרת-אל-שרת מול הספק.
 *
 * זו הפונקציה שקובעת אם שילמו. היא מדברת עם Tranzila ישירות, לא עם
 * הלקוח, ומשווה את הסכום שהספק מדווח לסכום שאנחנו ציפינו לו — תשלום
 * בסכום אחר אינו תשלום, גם אם הספק אישר אותו.
 */
export async function verifyPayment(
  reference: string,
  expectedIls: number,
): Promise<VerifyResult> {
  if (paymentProvider() !== "tranzila") {
    return { paid: false, reason: "PAYMENT_PROVIDER אינו מוגדר" };
  }

  const terminal = process.env.TRANZILA_TERMINAL;
  const key = process.env.TRANZILA_API_KEY;
  const secret = process.env.TRANZILA_API_SECRET;
  if (!terminal || !key || !secret) {
    return { paid: false, reason: "פרטי הגישה של הספק חסרים" };
  }

  /*
   * Tranzila חותם בקשות עם nonce וחותמת זמן. החתימה היא
   * sha256 של המפתח עם ה-nonce ועם הזמן — בלעדיה הבקשה נדחית,
   * וזה מה שמונע התחזות מול ה-API שלהם.
   */
  const time = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const accessKey = createHash("sha256").update(`${secret}${time}${nonce}`).digest("hex");

  try {
    const res = await fetch("https://api.tranzila.com/v1/transaction/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-tranzila-api-app-key": key,
        "X-tranzila-api-request-time": time,
        "X-tranzila-api-nonce": nonce,
        "X-tranzila-api-access-token": accessKey,
      },
      body: JSON.stringify({ terminal_name: terminal, myid: reference }),
    });

    const raw = (await res.json().catch(() => null)) as {
      error_code?: number;
      transactions?: { transaction_id?: string; sum?: number | string; processor_response_code?: string }[];
    } | null;

    if (!res.ok || !raw) return { paid: false, reason: `HTTP ${res.status}`, raw };

    const tx = raw.transactions?.[0];
    if (!tx) return { paid: false, reason: "לא נמצאה עסקה למזהה הזה", raw };

    // "000" הוא קוד ההצלחה של מסלקות ישראליות
    if (tx.processor_response_code !== "000") {
      return { paid: false, reason: `העסקה נדחתה (${tx.processor_response_code})`, raw };
    }

    const amount = Math.round(Number(tx.sum));
    if (!Number.isFinite(amount) || amount !== expectedIls) {
      return { paid: false, reason: `הסכום שחויב (${tx.sum}) אינו הסכום שהוזמן`, raw };
    }

    return { paid: true, externalId: String(tx.transaction_id ?? reference), amountIls: amount, raw };
  } catch (error) {
    return { paid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
