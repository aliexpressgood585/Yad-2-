import { handleError, ok, ApiError } from "@/lib/api";
import { failOrder, fulfillOrder } from "@/lib/orders";
import { paymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * אישור תשלום מספק הסליקה.
 *
 * הנתיב **אינו מאמין לגוף הבקשה**. הוא מוסר אותו ל-`verifyCallback`
 * של הספק, שאחראי לאמת חתימה או לשאול את הספק ישירות. נתיב שמקבל
 * `{"orderId":"…","paid":true}` ומאמין לו הוא כפתור "שלם לי" פתוח
 * לאינטרנט.
 *
 * הספק הפעיל היחיד כרגע — העברה בנקאית — אינו מקבל אישורים אוטומטיים
 * ולכן זורק כאן. הנתיב קיים כדי שהוספת ספק כרטיסי אשראי לא תדרוש
 * לגעת בכלום מלבד קובץ הספק. ראה `src/lib/payments/index.ts`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: requested } = await params;
    const provider = paymentProvider();

    // ספק שאינו הפעיל אינו מורשה לאשר כלום, גם אם הכתובת נכונה
    if (requested !== provider.id) {
      throw new ApiError(404, "ספק לא מוכר");
    }

    const contentType = req.headers.get("content-type") ?? "";
    const payload = contentType.includes("json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));

    const result = await provider.verifyCallback(payload, req.headers);

    if (result.paid) {
      const applied = await fulfillOrder(result.orderId, {
        providerRef: result.providerRef,
      });
      return ok({ received: true, applied });
    }

    await failOrder(result.orderId, result.reason ?? "התשלום נדחה");
    return ok({ received: true, applied: false });
  } catch (err) {
    return handleError(err);
  }
}
